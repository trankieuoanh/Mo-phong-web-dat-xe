# api-endpoints.md — GSM ride-booking simulation

## Nguyên tắc
API vẫn chỉ có 1 nhiệm vụ: ghi & đọc event. Implement bằng **Express** trong `apps/api` — path, method, request/response giữ nguyên hình dạng, chỉ đổi công cụ và vị trí file.

**Hai địa chỉ, cùng một API:**

| Gọi từ | URL | Ghi chú |
|---|---|---|
| Trình duyệt (app) | `localhost:3000/api/...` | Qua proxy `rewrites` của Next.js — same-origin, không preflight |
| curl / Postman / Python | `localhost:4000/api/...` | Gọi thẳng `apps/api`, được `cors()` cho phép |

Trong app **luôn** dùng đường thứ nhất: `fetch('/api/events')`. Gọi thẳng cổng 4000 từ trình duyệt sẽ kích hoạt preflight `OPTIONS` và làm mất `confirm_ride` / `place_order` — lý do đầy đủ ở `techstack.md`.

## Danh sách endpoint

### 1. Ghi 1 event
```
POST /api/events
```
File: `apps/api/src/routes/events.routes.ts` → `validators/event.validator.ts` → `services/event.service.ts`.

**Request body:**
```json
{
  "session_id": "abc-123",
  "user_id": "mock-user-1",
  "flow": "ride",
  "event_name": "select_vehicle",
  "screen_name": "vehicle_selection",
  "previous_screen": "pickup_confirm",
  "step_index": 3,
  "properties": { "vehicle_type": "bike" }
}
```

**Response (201):**
```json
{
  "event_id": "f8a2c1...",
  "created_at": "2026-09-15T10:12:03Z"
}
```
`event_id` giờ là Firestore document id tự sinh (từ `.add()`), không phải UUID tự tạo như bản Postgres.

> **Về `created_at` trong response:** document được ghi bằng `FieldValue.serverTimestamp()`, nên lúc `.add()` trả về, giá trị thật chưa tồn tại phía client. Response trả `new Date().toISOString()` tính tại route — **giá trị xấp xỉ**, lệch vài mili-giây. Giá trị chuẩn dùng cho phân tích là field `created_at` trong Firestore, không phải giá trị trong response này. Không đọc lại document sau khi ghi (tốn thêm 1 read mà client cũng bỏ qua response).

**Validate — field bắt buộc và kiểu:**

| Field | Kiểu | Bắt buộc |
|---|---|---|
| `session_id` | string, khác rỗng | ✅ |
| `user_id` | string, khác rỗng | ✅ |
| `flow` | `"ride"` \| `"food"` \| `"none"` | ✅ |
| `event_name` | thuộc `EVENT_NAMES` trong `@gsm/shared` | ✅ |
| `screen_name` | khoá của `SCREENS` trong `@gsm/shared` | ✅ |
| `step_index` | number nguyên ≥ 0 | ✅ |
| `previous_screen` | `ScreenName` \| null | ❌ — mặc định `null` |
| `properties` | object | ❌ — mặc định `{}` |

> Validator **không** tự gõ lại danh sách `event_name`/`screen_name` — nó import từ `@gsm/shared`, cùng nguồn mà `apps/web` dùng để gọi. Hai bên vì thế không thể lệch nhau, và thêm một event mới chỉ phải sửa một chỗ.
>
> `flow: "none"` dành cho `screen_view` và `back_to_home` ở màn `home` — lúc đó người dùng chưa chọn luồng nào. Xem `event-taxonomy.md` mục 2.

Field do **server tự gắn**, client gửi lên cũng bị bỏ qua:
- `platform: "web"` — vì vậy request body không chứa field này, dù document trong Firestore có (xem `db-design.md`).
- `created_at: FieldValue.serverTimestamp()` — luôn dùng giờ server, không tin giờ máy client.

Route dùng **whitelist**: chỉ lấy đúng 8 field ở bảng trên từ body, mọi field lạ khác bị loại bỏ im lặng (không trả lỗi).

**Response lỗi (400)** — thiếu field bắt buộc hoặc sai kiểu:
```json
{ "error": "Missing required field: flow" }
{ "error": "Invalid value for flow: expected \"ride\" | \"food\"" }
```

### 2. Lấy toàn bộ event của 1 session
```
GET /api/events?session_id=abc-123
```
File: `apps/api/src/routes/events.routes.ts`, handler `GET`.

**Response (200):** mảng document, sắp xếp theo `step_index` tăng dần — dùng cho phân tích & replay.

`created_at` được đổi sang **chuỗi ISO** ngay tại service. Timestamp của Firestore serialize ra JSON thành `{_seconds, _nanoseconds}` mà cả `jq` lẫn pandas đều không đọc được.

### 3. Lấy event theo user / flow / khoảng thời gian
```
GET /api/events?user_id=mock-user-1a2b3c4d
GET /api/events?flow=ride&from=2026-09-01&to=2026-09-15
```
Cùng file, cùng handler `GET`, chỉ khác điều kiện `where` khi query Firestore. Mọi param đều optional, kết hợp được.

| Param | Kiểu | Ghi chú |
|---|---|---|
| `session_id` | string | 1 lượt đi qua funnel. Kết quả sắp theo `step_index` |
| `user_id` | string | **Bền qua nhiều phiên.** Nguồn dữ liệu cho màn `/history` |
| `flow` | `ride` \| `food` | |
| `from` / `to` | ISO date | |

> **`user_id` cố ý không dùng `orderBy` của Firestore.** Một `where('user_id','==')` cộng một `orderBy('created_at')` trên field khác sẽ bị Firestore từ chối và bắt tạo composite index — tức người chạy dự án phải bấm link, đợi index build, rồi mới demo được. Dữ liệu một người dùng chỉ vài trăm document, nên service lấy về rồi **sắp xếp trong bộ nhớ**. Đổi lại là không phải cấu hình gì thêm sau khi clone.

### 3b. Tìm địa chỉ thật
```
GET /api/places?q=Hồ Gươm&limit=6
```
File: `apps/api/src/routes/places.routes.ts` → `validators/place.validator.ts` → `services/place.service.ts`.

**Response (200):** mảng `Place` (kiểu ở `packages/shared/src/places.ts`)
```json
[{ "id": "osm-N240109189", "label": "Hồ Hoàn Kiếm",
   "address": "Hàng Trống, Hoàn Kiếm, Hà Nội", "source": "search",
   "lat": 21.0287, "lon": 105.8524 }]
```

| Param | Kiểu | Bắt buộc |
|---|---|---|
| `q` | string, 2–120 ký tự | ✅ |
| `limit` | số nguyên 1–8, mặc định 6 | ❌ |

**Vì sao phải proxy qua `apps/api` chứ không gọi Nominatim thẳng từ trình duyệt** — ba lý do, lý do đầu là chặn cứng:

1. Điều khoản OSM bắt buộc mỗi request mang `User-Agent` định danh, mà **trình duyệt không cho JavaScript đặt header đó**.
2. OSM giới hạn tuyệt đối **1 request/giây**. Chỉ ở server mới đặt được hàng đợi thật; debounce phía client là gợi ý, không phải bảo đảm.
3. Cache dùng chung. Gõ "Cầu Giấy" rồi xoá lùi sẽ hỏi lại đúng những query vừa hỏi.

**Lỗi (502)** khi Nominatim rớt / trả 429 / hết thời gian chờ:
```json
{ "error": "Không tìm được địa chỉ lúc này (upstream 429)" }
```
FE phải **suy biến êm**: hiện cảnh báo nhưng vẫn liệt kê 5 địa chỉ gợi ý để luồng đi tiếp được. Cùng tinh thần với `trackEvent().catch(() => {})` — hạ tầng lỗi không được kẹt người dùng.

Endpoint này **không chạm Firestore** và **không ghi event nào**: gõ phím không phải một bước funnel.

### 4. Health check
```
GET /api/health
```
File: `apps/api/src/routes/health.routes.ts`. Response: `{ "status": "ok" }`. **Không chạm Firestore** — Firebase Admin khởi tạo trễ nên route này trả lời được cả khi chưa có credential. Dùng để test ở Phase 0, trước khi setup Firebase.

## Những gì KHÔNG có trong API này
- Không có endpoint đặt xe/đặt đồ ăn thật — chỉ lưu event xác nhận như mọi event khác.
- Không có endpoint cho địa chỉ/menu/khuyến mãi — dữ liệu tĩnh, hardcode trong client (xem `mock-data.md`).
- Không có authentication — `user_id` chỉ là giá trị test.

### Về việc không có authentication
Đây là **quyết định có chủ ý**, không phải thiếu sót: trong phạm vi 6 tuần, app chạy local (`next dev`) để demo, `user_id` là giá trị mock, dữ liệu không có gì nhạy cảm.

Hệ quả cần biết: nếu về sau deploy công khai lên Firebase Hosting, `POST /api/events` trở thành endpoint mở — bất kỳ ai cũng ghi được document rác vào collection `events` và làm hỏng số liệu phân tích. Khi đó cần bổ sung tối thiểu một trong các biện pháp: App Check, rate limit theo IP, hoặc một shared secret trong header. **Chỉ deploy công khai sau khi đã sinh xong dữ liệu phân tích**, hoặc không deploy công khai.

## Lưu ý riêng cho Firestore
Credential Firebase Admin SDK (service account key) chỉ sống trong `apps/api` (`apps/api/.env`, đã gitignore). `apps/web` **không có `firebase-admin` trong `dependencies`** nên không import nổi — xem `CLAUDE.md` quy tắc 1.

Query kết hợp `where` + `orderBy` trên 2 field khác nhau sẽ bị Firestore từ chối **kèm một link tạo index sẵn trong thông báo lỗi**. Vì vậy `GET /api/events` trả nguyên văn message lỗi của Firestore thay vì nuốt đi — nó chứa đường dẫn cần đi (xem `db-design.md`).