# api-endpoints.md — GSM ride-booking simulation

## Nguyên tắc
API chỉ có 1 nhiệm vụ: ghi & đọc event, cộng bốn endpoint tra cứu dữ liệu thật. Implement bằng **Route Handler của Next.js App Router** (`app/api/**/route.ts`), gọi xuống `lib/server/`.

**Một địa chỉ duy nhất: `localhost:3000/api/...`** — cho cả trình duyệt lẫn curl/Postman/Python. Không còn cổng thứ hai, không còn proxy, nên mọi request từ app đều same-origin và không có preflight `OPTIONS`.

> Bản trước dùng Express chạy riêng ở cổng 4000, và tài liệu này từng phải mô tả *hai* địa chỉ. Path, method, request/response **giữ nguyên hình dạng** qua lần chuyển đó — chỉ công cụ và vị trí file đổi. Lý do gộp ở `ARCHITECTURE.md`.

## Danh sách endpoint

### 1. Ghi 1 event
```
POST /api/events
```
File: `app/api/events/route.ts` → `lib/server/validators/event.validator.ts` → `lib/server/services/event.service.ts`.

**Đăng nhập chỉ bắt buộc ở bước xác nhận.**
- **Có** cookie `gsm_auth` hợp lệ: `user_id` client gửi lên bị **ghi đè** bằng số điện thoại trong cookie (E.164, vd `+84912345678`) trước khi validate — client không giả mạo được người dùng.
- **Không** cookie (khách): chỉ nhận khi `user_id` có dạng `anon-<id>` (`isAnonUserId`, `lib/shared/phone.ts`), giá trị khác → `401 { "error": "Chưa đăng nhập" }`.
- `confirm_ride` và `place_order` (`AUTH_REQUIRED_EVENTS`) **luôn cần cookie** → khách nhận `401 { "error": "Cần đăng nhập để đặt" }`.
- `session_id` giữ nguyên qua lúc đăng nhập nên event `anon-…` và event `+84…` của cùng một lượt vẫn nối được.

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
`event_id` là id 20 ký tự `[A-Za-z0-9]` do server sinh (cùng dạng với auto-id cũ của Firestore; id của event đã migrate được giữ nguyên), không phải UUID.

> **Về `created_at` trong response:** là giá trị **thật** app đã ghi vào D1 (UTC, micro-giây cố định độ rộng, vd `2026-10-01T17:34:17.818000Z`) — app gán trước khi `INSERT`, không còn là giờ commit của database như thời `serverTimestamp()`. Không đọc lại dòng sau khi ghi.

**Validate — field bắt buộc và kiểu:**

| Field | Kiểu | Bắt buộc |
|---|---|---|
| `session_id` | string, khác rỗng | ✅ |
| `user_id` | string, khác rỗng | ✅ |
| `flow` | `"ride"` \| `"food"` \| `"none"` | ✅ |
| `event_name` | thuộc `EVENT_NAMES` trong `lib/shared` | ✅ |
| `screen_name` | khoá của `SCREENS` trong `lib/shared` | ✅ |
| `step_index` | number nguyên ≥ 0 | ✅ |
| `previous_screen` | `ScreenName` \| null | ❌ — mặc định `null` |
| `properties` | object | ❌ — mặc định `{}` |

> Validator **không** tự gõ lại danh sách `event_name`/`screen_name` — nó import từ `lib/shared`, cùng nguồn mà giao diện dùng để gọi. Hai bên vì thế không thể lệch nhau, và thêm một event mới chỉ phải sửa một chỗ.
>
> `flow: "none"` chỉ dành cho `screen_view` ở màn `home` — lúc đó người dùng chưa chọn luồng nào. Xem `event-taxonomy.md` mục 1.

Field do **server tự gắn**, client gửi lên cũng bị bỏ qua:
- `platform: "web"` — vì vậy request body không chứa field này, dù dòng trong D1 có (xem `db-design.md`).
- `created_at: FieldValue.serverTimestamp()` — luôn dùng giờ server, không tin giờ máy client.

Route dùng **whitelist**: chỉ lấy đúng 8 field ở bảng trên từ body, mọi field lạ khác bị loại bỏ im lặng (không trả lỗi).

**Response lỗi (400)** — thiếu field bắt buộc hoặc sai kiểu:
```json
{ "error": "Missing required field: flow" }
{ "error": "Invalid value for flow: expected \"ride\" | \"food\"" }
```

**Response lỗi (413)** — body vượt 64 kB (thay cho `express.json({ limit: '64kb' })` của bản cũ):
```json
{ "error": "Body quá lớn" }
```

### 2. Lấy toàn bộ event của 1 session
```
GET /api/events?session_id=abc-123
```
File: `app/api/events/route.ts`, handler `GET`.

**Response (200):** mảng document, sắp xếp theo `step_index` tăng dần — dùng cho phân tích & replay.

> **Thứ tự `step_index` KHÔNG còn xấp xỉ thứ tự thời gian.** `select_flow` luôn mang `step_index: 0` (`event-taxonomy.md` mục 1), kể cả khi người dùng bấm tab đổi luồng ở giữa phiên — event đó vì thế nhảy lên đầu mảng. Muốn đọc đúng dòng thời gian thì sắp lại theo `created_at`:
> ```bash
> curl -s "localhost:3000/api/events?session_id=$SID" | jq 'sort_by(.created_at)'
> ```

`created_at` trả về là **chuỗi ISO** UTC micro-giây (cột TEXT trong D1) — `jq` và pandas đọc thẳng được.

### 3. Lấy event theo user / flow / khoảng thời gian
```
GET /api/events?user_id=mock-user-1a2b3c4d
GET /api/events?flow=ride&from=2026-09-01&to=2026-09-15
```
Cùng file, cùng handler `GET`, chỉ khác điều kiện `WHERE` khi query D1. Mọi param đều optional, kết hợp được.

| Param | Kiểu | Ghi chú |
|---|---|---|
| `session_id` | string | 1 lượt đi qua funnel. Kết quả sắp theo `step_index` |
| `user_id` | string | **Bền qua nhiều phiên.** Nguồn dữ liệu cho màn `/history` |
| `flow` | `ride` \| `food` | |
| `from` / `to` | ISO date | |
| `flat` | `1` \| `true` | Trải `properties` thành cột `prop_<tên>` ở cấp cao nhất |
| `limit` | số nguyên > 0 | Chặn số document trả về. Vắng = trả hết |

#### `flat=1` — cho công cụ BI đọc JSON trực tiếp

```
GET /api/events?flat=1
```

`properties` là map lồng nhau và **mỗi loại event có bộ khoá khác nhau**. Power BI / Tableau đọc thẳng JSON sẽ dựng một cột kiểu Record mà người dùng phải tự bấm Expand, và expand ra không đều giữa các dòng.

`flat=1` trả về bảng phẳng: 10 field top-level giữ nguyên, `properties` biến thành các cột `prop_<tên>`. **Mọi dòng có cùng tập khoá**, khoá thiếu là `null` — phần này mới là phần quan trọng: nếu để mỗi dòng chỉ mang khoá của riêng nó thì Power BI suy kiểu bảng bằng cách đọc vài dòng đầu, và `prop_final_price` (chỉ xuất hiện ở `confirm_ride`, một event hiếm trong dòng sự kiện) có thể không lọt vào mẫu — lúc đó cột đó **biến mất khỏi bảng mà không báo gì**.

Tiền tố `prop_` **cố ý trùng** với `analysis/fetch_events.py`, nên hai đường đọc dữ liệu cho ra cùng tên cột và biểu đồ Power BI nói về cùng một thứ với biểu đồ matplotlib.

> **`limit` đi thẳng vào câu `SELECT … LIMIT ?`** — D1 chỉ đọc (và tính hạn mức đọc 5.000.000 dòng/ngày) đúng số dòng đó; kể cả khi lọc `user_id` (có `idx_events_user_created_at`).

> **Kích thước phản hồi mới là thứ chặn trước tiên khi nối BI.** Hạn mức đọc D1 rất rộng (5.000.000 dòng/ngày) nên không còn là vấn đề, nhưng hàm serverless của Vercel giới hạn thân phản hồi ~4,5 MB: `GET /api/events` không lọc với ~9.160 event ≈ 3,56 MB — sát trần. Dùng `from=`/`to=` (Power BI incremental refresh) để mỗi request chỉ kéo một khoảng ngày — xem `docs/POWERBI_D1.md`.

> **`GET /api/events` có cache 5 phút trong bộ nhớ server** (`lib/server/services/events-cache.ts`). Khoá cache = bộ tham số đi vào query D1 (`session_id`, `user_id`, `flow`, `from`, `to`, `limit`) — `flat` **không** nằm trong khoá, nên `?flat=1` và dạng lồng nhau dùng chung một lần đọc. Hệ quả cho Power BI: refresh đầu ≈ số dòng, mọi refresh trong 5 phút sau = **0 lượt đọc**, nhiều request cùng lúc khi cache trống/hết hạn chỉ sinh **một** query D1 (single-flight). Header `X-Cache: HIT|MISS|REFRESH|WAIT|STALE` cho biết request vừa rồi đi đường nào; body không đổi.
>
> - **Hết 5 phút KHÔNG có nghĩa là đọc lại toàn bộ** (`lib/server/services/events-sync.ts`). Với khoá không lọc `session_id`/`user_id`/`limit` — đúng đường Power BI gọi — server chỉ đọc dòng có `created_at >=` mốc lớn nhất đã thấy **lùi 5 giây** (≈ số event mới — cửa sổ gối đầu vì `created_at` do app gán), rồi `COUNT(*)` để đối chiếu. Lệch số lượng — tức có seed ghi lùi ngày hoặc có xoá ngoài API — thì mới đọc lại toàn bộ. Ngoài ra đối chiếu toàn bộ mỗi **24 giờ** (`EVENTS_FULL_RECONCILIATION_INTERVAL_MS`) để bắt thứ duy nhất `count()` không thấy: sửa tay bằng wrangler mà không đổi số lượng.
> - `COUNT(*)` với `flow=` quét `idx_events_created_at` rồi lọc `flow` — rẻ ở quy mô vài chục nghìn dòng (không có index riêng cho `flow`, xem `docs/d1-schema-design.md`).
> - Làm mới thất bại mà còn bản cũ → trả bản cũ (`STALE`); không có bản cũ → 500 như trước.
> - `POST /api/events` thành công chỉ xoá các khoá lọc theo **đúng** `session_id`/`user_id` vừa ghi (màn `/history` thấy ngay). Khoá rộng (không lọc, hoặc chỉ `flow`/`from`/`to`) chỉ hết hạn theo TTL — dữ liệu phân tích trễ tối đa 5 phút.
> - Cache sống trong **một tiến trình**: mất khi restart/redeploy, và trên Vercel mỗi instance có bản riêng. Bộ đếm hit/miss ở `GET /api/health` (`events_cache`).
> - `analysis/fetch_events.py` đọc **thẳng** D1 qua REST (phân trang keyset 2.000 dòng/trang), **không** đi qua cache này — mỗi lần chạy ≈ số dòng.

> **Lọc `user_id` sắp và `LIMIT` thẳng ở DB.** Thời Firestore, `where('user_id')` + `orderBy('created_at')` buộc phải tạo composite index nên service phải sắp trong bộ nhớ; với D1 có `idx_events_user_created_at (user_id, created_at)` nên ràng buộc đó không còn.

### 3b. Tìm địa chỉ thật
```
GET /api/places?q=Hồ Gươm&limit=6
```
File: `app/api/places/route.ts` → `lib/server/validators/place.validator.ts` → `lib/server/services/photon.service.ts`.

Nguồn: **[Photon](https://photon.komoot.io/)** (komoot), chạy trên dữ liệu OpenStreetMap. Miễn phí, không API key.

> **Vì sao không còn dùng Nominatim.** Trên máy chạy dự án này, **toàn bộ `*.openstreetmap.org` không kết nối được** — cả `nominatim.openstreetmap.org` lẫn `tile.openstreetmap.org` — trong khi OSRM và mọi dịch vụ khác vẫn thông. Ô tìm địa chỉ vì thế im lặng không ra kết quả nào. Photon chạy trên đúng dữ liệu OSM, khác mỗi tên miền và hạ tầng, và **giữ nguyên `osm_type` + `osm_id`** nên `id` dạng `osm-N240109189` không đổi (`CLAUDE.md` quy tắc 5).

> **`bbox` là bắt buộc.** Photon chỉ *ưu tiên* theo `lat`/`lon` chứ không cắt, nên tìm "Hồ Gươm" trả về một tiệm ăn ở München ngay ở kết quả thứ hai. Nominatim trước đây chặn bằng `countrycodes=vn`; Photon không có tham số đó nên phải dùng khung bao Việt Nam `102.1,8.2,109.6,23.4`.

**Response (200):** mảng `Place` (kiểu ở `lib/shared/places.ts`)
```json
[{ "id": "osm-N240109189", "label": "Hồ Hoàn Kiếm",
   "address": "Hàng Trống, Hoàn Kiếm, Hà Nội", "source": "search",
   "lat": 21.0287, "lon": 105.8524 }]
```

| Param | Kiểu | Bắt buộc |
|---|---|---|
| `q` | string, 2–120 ký tự | ✅ |
| `limit` | số nguyên 1–8, mặc định 6 | ❌ |

**Vì sao phải proxy qua `lib/server` chứ không gọi thẳng từ trình duyệt** — ba lý do, lý do đầu là chặn cứng:

1. Điều khoản OSM bắt buộc mỗi request mang `User-Agent` định danh, mà **trình duyệt không cho JavaScript đặt header đó**.
2. OSM giới hạn tuyệt đối **1 request/giây**. Chỉ ở server mới đặt được hàng đợi thật; debounce phía client là gợi ý, không phải bảo đảm.
3. Cache dùng chung. Gõ "Cầu Giấy" rồi xoá lùi sẽ hỏi lại đúng những query vừa hỏi.

**Lỗi (502)** khi Nominatim rớt / trả 429 / hết thời gian chờ:
```json
{ "error": "Không tìm được địa chỉ lúc này (upstream 429)" }
```
FE phải **suy biến êm**: hiện cảnh báo nhưng vẫn liệt kê 5 địa chỉ gợi ý để luồng đi tiếp được. Cùng tinh thần với `trackEvent().catch(() => {})` — hạ tầng lỗi không được kẹt người dùng.

Endpoint này **không chạm database (D1)** và **không ghi event nào**: gõ phím không phải một bước funnel.

### 3b-bis. Tìm quán ăn quanh một toạ độ
```
GET /api/restaurants?lat=21.0369&lon=105.7856&radius=2000&limit=20
GET /api/restaurants?lat=21.0369&lon=105.7856&q=pho
```
File: **cùng** `app/api/places.routes.ts` → `validators/place.validator.ts` (`validateRestaurantQuery`) → **`services/overpass.service.ts`** (`searchRestaurants`).

Nguồn: **[Overpass API](https://overpass-api.de/)**, truy vấn thẳng cơ sở dữ liệu OpenStreetMap. Miễn phí, không API key.

> **Vì sao bỏ Nominatim ở đây — hai lý do, lý do thứ hai đúng cả khi mạng thông:**
>
> 1. `*.openstreetmap.org` không kết nối được từ máy chạy dự án (xem mục 3b).
> 2. **Nominatim là một *geocoder*, không phải chỉ mục POI.** `amenity=restaurant` là truy vấn có cấu trúc xếp theo "importance", nên nó trả về rất thưa — **6-hoặc-0 quán ngay giữa Cầu Giấy**. Overpass truy vấn theo bán kính và trả về **80 quán** ở đúng toạ độ đó. Đây là khác biệt về *đúng công cụ*, không phải về *máy chủ nào còn sống*.

**Response (200):** mảng `Restaurant` (`lib/shared/places.ts`) — `Place` cộng các tag OSM:
```json
[{ "id": "osm-N4510096889", "label": "Nhà Hàng Bò Đội Nón",
   "address": "60 Trần Đăng Ninh, Dịch Vọng, Cầu Giấy, Hà Nội", "source": "search",
   "lat": 21.0331, "lon": 105.7884,
   "cuisine": ["Lẩu_-_nướng_&_các_món_nhậu"], "openingHours": "09:00 - 23:30" }]
```

| Param | Kiểu | Bắt buộc |
|---|---|---|
| `lat` | số, −90..90 | ✅ |
| `lon` | số, −180..180 | ✅ |
| `limit` | số nguyên 1–30, mặc định 6 | ❌ |
| `radius` | số nguyên 200–5000 (mét), mặc định 1500 | ❌ |
| `q` | string, 2–120 ký tự — lọc theo **tên quán** | ❌ |

Truy vấn Overpass QL được dựng:
```
[out:json][timeout:25];
(nwr["amenity"~"restaurant|fast_food|cafe"](around:<radius>,<lat>,<lon>););
out center 80;
```

**Bốn quyết định, mỗi cái đều có lý do:**

1. **`restaurant|fast_food|cafe`**, không chỉ `restaurant` — người Việt gọi quán bánh mì, quán cà phê đều là "quán ăn", và lọc cứng theo `restaurant` cắt mất phần lớn quán thật.
2. **`nwr`** = node + way + relation. Quán lớn được vẽ là `way` (cả toà nhà) chứ không phải một điểm, nên chỉ lấy `node` sẽ bỏ sót đúng những quán dễ nhận ra nhất. `out center` cho mỗi phần tử một toạ độ tâm.
3. **`q` được lọc ở JS, KHÔNG gửi lên Overpass.** Overpass **từ chối** (406 Not Acceptable) các truy vấn có lớp ký tự tiếng Việt trong regex — đây là bộ lọc của hạ tầng trước nó, không sửa được bằng cách viết regex khéo hơn. Lọc ở JS dùng `normalizeVi` (đã có sẵn trong `lib/shared`) nên **gõ "pho" ra "Phở", "ca phe" ra "Cà Phê"** — bộ lọc phía Overpass không làm được việc đó. Thêm nữa, **khoá cache không chứa `q`**, nên mỗi phím gõ thêm không sinh một lời gọi Overpass mới: cả màn tìm kiếm chạy trên một lần tải duy nhất.
4. **Gate riêng, `minGapMs` 300ms.** Overpass không áp luật 1 request/giây của OSM; dùng chung gate với Photon/OSRM sẽ kéo cả tra địa chỉ lẫn tuyến đường chậm theo mà không có lý do gì.

> **Độ phủ tag vẫn thưa.** Nhiều quán không có `cuisine`, `opening_hours` hay `addr:*`. Mọi trường thêm đều optional, `address` lui về `"Chưa có địa chỉ chi tiết"`, và FE **không được lọc bỏ** quán thiếu tag. Quán **không có `name`** là trường hợp duy nhất bị loại — không hiển thị được.

**Lỗi (502)** khi Overpass rớt. FE hiện thông báo kèm nút "Thử lại" chứ **không** chặn màn menu — ba cách tìm món còn lại vẫn dùng được.

### 3b-ter. Toạ độ → địa chỉ thật (reverse geocode)
```
GET /api/reverse?lat=21.0369&lon=105.7856
```
File: `app/api/places.routes.ts` → `validators/place.validator.ts` (`validateReverseQuery`) → `services/photon.service.ts` (`reversePlace`).

**Response (200):** một `Place`, hoặc `null` khi Photon không biết chỗ đó là đâu.
```json
{ "id": "geo-current", "label": "Ngõ 1 Phố Phan Văn Trường",
  "address": "Cầu Giấy, Hà Nội", "source": "preset",
  "lat": 21.0369244, "lon": 105.7856271 }
```

| Param | Kiểu | Bắt buộc |
|---|---|---|
| `lat` | số, −90..90 | ✅ |
| `lon` | số, −180..180 | ✅ |

**Vì sao endpoint này tồn tại.** Không có nó, luồng food chỉ hiện được nhãn `"Vị trí hiện tại"` / `"Quanh vị trí của bạn"` — tức người dùng bấm **Đặt đơn mà không biết đơn giao tới đâu**. Một cái nhãn không phải là một địa chỉ.

`id` trả về luôn là `geo-current` và `source` là `preset` chứ không phải `osm-*`/`search`: điểm này đến từ GPS, không phải từ một lượt người dùng tự gõ tìm, và `address_source` trong `place_order` phải phản ánh đúng điều đó.

**FE dùng nó như một bước phụ, không chặn luồng:** toạ độ có trước và dùng được ngay (dải "Gần bạn" không phải chờ), nhãn địa chỉ đẹp hơn đến sau. Photon thất bại thì giữ nhãn mặc định và đi tiếp.

Endpoint này **không chạm database (D1)** và **không ghi event nào**.


### 3c. Tìm tuyến đường thật
```
GET /api/route?from=21.0369,105.7856&to=21.2189,105.8045
```
File: `app/api/route.routes.ts` → `validators/route.validator.ts` → `services/route.service.ts`.

**Response (200):** một `RouteResult` (kiểu ở `lib/shared/route.ts`)
```json
{ "distanceKm": 28.4, "durationMin": 38, "source": "osrm",
  "geometry": [[21.0369,105.7856], [21.0371,105.7859], "…vài trăm điểm…"] }
```

| Param | Kiểu | Bắt buộc |
|---|---|---|
| `from` | `"lat,lon"` — lat ∈ [-90,90], lon ∈ [-180,180] | ✅ |
| `to` | như trên | ✅ |

Nguồn: [OSRM](https://project-osrm.org/) `router.project-osrm.org`, hồ sơ `driving`. Miễn phí, không API key. Proxy qua `lib/server` vì cùng ba lý do với `/api/places`: đặt được `User-Agent`, giữ được hàng đợi, và cache dùng chung — `service` dùng lại **đúng cơ chế** đã viết trong `place.service.ts`.

**Lỗi (502)** khi OSRM rớt / quá thời gian chờ:
```json
{ "error": "Không tính được tuyến đường lúc này (upstream 429)" }
```

> **`router.project-osrm.org` là máy chủ demo công cộng, không cam kết uptime, có giới hạn tần suất và không có dữ liệu giao thông.** Khi lên production nên tự host OSRM và đặt `OSRM_BASE_URL` (mặc định vẫn là máy demo). Service thử lại **một lần** (sau 400 ms) với lỗi tạm thời (timeout mạng, 5xx, 429); `NoRoute` thì không thử lại. Route từ chối tuyến < 2 toạ độ (502).
>
> **Giao diện KHÔNG còn đường lui đường chim bay (từ 10/2026).** `lib/use-route.ts` chỉ trả tuyến OSRM thật hoặc `null` kèm `status` (`loading`/`error`); khi chưa có tuyến thật bản đồ **không vẽ đường nào** (hiện "Đang tính tuyến đường…" hoặc thẻ lỗi + nút **Thử lại**), và luồng đặt xe **bị chặn** ở `/ride/pickup` ("Chọn điểm đón này" khoá) cho tới khi có tuyến — vì giá và `confirm_ride` lấy từ quãng đường này. Do đó `route_source` của event mới luôn là `"osrm"`; `"straight"` chỉ còn ở dữ liệu cũ. Giao đồ ăn dùng cùng hook cho tuyến quán → khách nhưng **không chặn** đặt đơn (giá đơn không phụ thuộc quãng đường).

Endpoint này **không chạm database (D1)** và **không ghi event nào**.

### 3d. Dò nhà cung cấp tile bản đồ
```
GET /api/tiles
```
File: `app/api/tiles/route.ts` → `lib/server/services/tiles.service.ts`. Không nhận tham số nào nên không có validator.

**Response (200):** tên các nhà cung cấp còn dùng được, **giữ nguyên thứ tự ưu tiên** trong `TILE_PROVIDERS` (`lib/shared/tiles.ts`)
```json
{ "providers": ["stadia", "osmfr", "osmde"] }
```

> **Kết quả phụ thuộc `WEB_ORIGIN`, và đó là chủ ý.** Phép dò gửi `Referer: <phần tử đầu của WEB_ORIGIN>` vì Stadia phân quyền theo header đó. Chạy local thì danh sách còn cả ba như trên; trên bản deploy (với `WEB_ORIGIN` trỏ domain thật) thì Stadia trả 401 và kết quả rút còn `["osmfr", "osmde"]`. Cùng một đoạn code, hai kết luận khác nhau — vì sự thật ở hai nơi vốn khác nhau. Xem mục "Deploy" ở `setup.md`.

**Vì sao endpoint này tồn tại.** `MapCanvas.tsx` từ đầu đã có cơ chế đếm tile hỏng rồi nhảy sang nhà cung cấp dự phòng — nhưng nó dựa vào sự kiện `onError` của thẻ `<img>`, mà `onError` chỉ bắt được *"không tải được"*, không bắt được *"tải được nhưng sai"*.

Đó đúng là sự cố đã xảy ra: CARTO chuyển sang bắt buộc API key và bắt đầu in chữ **"API KEY REQUIRED"** chéo lên mọi tile — nhưng vẫn trả HTTP 200 kèm một file PNG hợp lệ. `onError` không bao giờ bắn, bộ đếm mãi bằng 0, và bản đồ hỏng ở cả hai luồng suốt nhiều ngày mà app không hề biết.

**Cách dò.** Tải một tile ở toạ độ `z13/6707/3740` — **giữa Biển Đông, không có một nét bản đồ nào**. Một tile biển sâu sạch gần như là một ô màu phẳng, nén xuống còn vài trăm byte; nhà cung cấp nào in chữ lên đó sẽ phình lên hơn một bậc độ lớn:

| Nhà cung cấp | Kích thước tile biển | Kết luận |
|---|---|---|
| `osmfr`, `osmde` | 103 B | sạch |
| Stadia (`alidade_smooth`, đang dùng) | 156 B | sạch |
| Stadia (`osm_bright`, tone cũ) | 495 B | sạch |
| CARTO | **1718 B** | có watermark |
| Stadia, referer bản deploy | 14.885 B | 401 — loại ở bước mã trạng thái |

Ngưỡng `PROBE_MAX_BYTES = 800` nằm giữa khe hở 495 → 1718 (`alidade_smooth` 156 B có thêm biên an toàn). **Đổi tone bản đồ thì phải đo lại con số này** — tone có màu nặng hơn tone xám ngay cả ở giữa biển (`alidade_smooth` 156 B → `osm_bright` 495 B). Một nhà cung cấp bị loại khi **đã trả lời** mà tile quá lớn, sai `content-type`, hoặc trả mã lỗi.

> **Lỗi mạng KHÔNG phải là bằng chứng hỏng.** Không kết nối được thì nhà cung cấp đó vẫn được **giữ lại** trong danh sách. Việc của phép dò là *loại thứ đã chứng minh là hỏng*, không phải *chỉ nhận thứ đã chứng minh là tốt* — kết quả được cache 6 giờ, nên nếu một cú chớp mạng cũng đủ loại một nhà cung cấp thì danh sách dự phòng sẽ bị đầu độc cả buổi. Trường hợp nhà cung cấp chết thật thì `onError` ở FE vẫn bắt được.

**Lỗi (502)** khi bản thân phép dò thất bại. FE coi đây là *"không biết gì"* và lui về dùng nguyên cả bảng `TILE_PROVIDERS` — khác hẳn với `{"providers":[]}`, vốn có nghĩa *"đã dò, không nhà nào dùng được"*.

Endpoint này **không chạm database (D1)** và **không ghi event nào**.

### 5. Đăng nhập bằng số điện thoại (mã SMS 6 số)

Files: `app/api/auth/*/route.ts` → `lib/server/validators/auth.validator.ts` → `lib/server/services/{otp,auth-token,sms}.service.ts`. Số điện thoại chuẩn hoá bằng `normalizeVnPhone()` (`lib/shared/phone.ts`): `0912 345 678`, `84912345678`, `+84912345678` đều thành `+84912345678`.

| Endpoint | Body | Kết quả |
|---|---|---|
| `POST /api/auth/send-code` | `{ "phone": "0912345678" }` | `200 { ok, phone, dev_code? }` · `400` số sai · `429 { retry_after }` gửi lại trong 60s |
| `POST /api/auth/verify` | `{ "phone": "...", "code": "123456" }` | `200 { phone }` + Set-Cookie `gsm_auth` (httpOnly, 30 ngày) · `401 { reason }` với `reason` ∈ `not_found` / `expired` / `too_many_attempts` / `wrong_code` |
| `GET /api/auth/me` | — | `200 { phone }` · `401` |
| `POST /api/auth/logout` | — | `200 { ok }`, xoá cookie |

- Mã sống **5 phút**, sai tối đa **5 lần** thì phải gửi lại mã. **Không dùng database:** `send-code` đặt cookie httpOnly `gsm_otp` (path `/api/auth`) chứa `{phone, hash(mã), hết hạn, nonce}` ký HMAC; `verify` kiểm cookie đó rồi xoá. Cooldown và đếm lần sai nằm trong bộ nhớ tiến trình — trên serverless nhiều instance thì giới hạn này lỏng hơn. `users/{phone}` ghi best effort.
- `dev_code` chỉ có khi `SMS_PROVIDER=mock` **và** (không phải production **hoặc** `SMS_MOCK_EXPOSE_CODE=true`). Production + mock mà thiếu cờ này thì không tin nào được gửi và mã cũng không hiện — không ai đăng nhập được.
- Cookie = `base64url(phone|hết hạn).HMAC-SHA256(AUTH_SECRET)`. Không lưu session ở DB; đổi `AUTH_SECRET` là đăng xuất mọi người.
- **Không còn `middleware.ts`**: khách duyệt mọi trang. Hộp thoại đăng nhập (`LoginModal`) chỉ hiện khi bấm Đặt xe / Đặt đơn (`requireLogin` trong `lib/app-context.tsx`). Chữ ký cookie kiểm ở `GET /api/auth/me` (401 → chỉ xoá bản sao SĐT, không chuyển trang) và `POST /api/events`.

### 4b. Đọc 11 bảng phân tích (Power BI) — `GET /api/analytics/<table>`

Database là **Cloudflare D1** (xem `docs/d1-schema-design.md`). 11 file CSV cũ trong `powerBI/` = 11 bảng, mỗi bảng một URL:
`dim_region`, `dim_hex`, `dim_promo`, `dim_promo_cap_history`, `dim_date`, `dim_merchant`, `dim_user`, `fact_promo_budget`, `fact_ride`, `fact_food`, `fact_promo_burn`. Tên khác → `404`.

| Tham số | Ý nghĩa |
|---|---|
| `limit` | 1–5000, mặc định 2000 |
| `after` | `next_cursor` của trang trước (phân trang keyset theo khoá chính — rẻ ở bảng 65k dòng) |
| `from`, `to` | chỉ `fact_ride`/`fact_food` (theo `session_start`) và `fact_promo_burn` (theo `event_datetime`); bảng khác → `400` |

Phản hồi `200 { "rows": [...], "next_cursor": "..." | null }`; cột boolean trả `true`/`false`. Thân phản hồi được cắt để luôn < 4 MB (giới hạn hàm Vercel) — `next_cursor` luôn trỏ đúng dòng kế tiếp. Chỉ đọc.

**Bảo vệ tuỳ chọn (`ANALYTICS_TOKEN`)** áp cho route này **và** `GET /api/events`: để trống = mở như trước; có giá trị = cần `Authorization: Bearer <token>` (`401` nếu thiếu/sai). Người đã đăng nhập vẫn đọc được lịch sử **của chính mình** (`GET /api/events?user_id=<SĐT của cookie>`) để `/history` không gãy.

### 4. Health check
```
GET /api/health
```
File: `app/api/health/route.ts`. Response: `{ "status": "ok" }`. **Không chạm D1** — cấu hình D1 đọc trễ nên route này trả lời được cả khi chưa có credential. Dùng để test ở Phase 0, trước khi cấu hình database.

## Những gì KHÔNG có trong API này
- Không có endpoint đặt xe/đặt đồ ăn thật — chỉ lưu event xác nhận như mọi event khác.
- Không có endpoint cho địa chỉ/menu/khuyến mãi — dữ liệu tĩnh, hardcode trong client (xem `mock-data.md`).
- `GET /api/events` **không** yêu cầu đăng nhập — analysis / Power BI gọi thẳng. Chỉ POST bị chặn.

### Về authentication
Ban đầu dự án cố ý không có đăng nhập (`user_id` là `mock-user-*`). Giờ có **đăng nhập bằng số điện thoại + mã SMS** (mục 5), bắt buộc ở bước xác nhận: `confirm_ride` / `place_order` cần cookie hợp lệ và mang `user_id` = số điện thoại; các event trước đó của khách mang `anon-<id>`. Server chỉ nhận đúng hai dạng `user_id` đó nên không ghi được document rác tuỳ ý — nhưng một người có số điện thoại (hay một id `anon-…` bất kỳ) vẫn ghi được event tuỳ ý.

Biện pháp đã chọn là **shared secret trong header** (mục ngay dưới). Hai lựa chọn còn lại từng cân nhắc: App Check gắn chặt vào Firebase SDK phía client mà dự án cố tình không có; rate limit theo IP thì chặt hơn nhưng cần thêm state, và `upstream.ts` đã cho thấy state trong bộ nhớ tiến trình là thứ phải tính kỹ. Shared secret là mức vừa đủ cho một app demo.

### Vì sao không còn khoá chia sẻ

Đã từng có một guard `x-gsm-key` ở `/api/events`, dựng cho bản hai process. Nó hoạt động được **chỉ nhờ** chặng server→server giữa hai app: header được gắn ở tầng máy chủ, sau khi request đã rời máy người dùng, nên trình duyệt không bao giờ biết giá trị khoá.

Gộp một project thì chặng đó biến mất. Trình duyệt gọi thẳng vào route handler, nên bất cứ thứ gì `lib/track.ts` gửi được thì người dùng cũng đọc được trong bundle — khoá chỉ còn là hàng rào hình thức. Nó đã được gỡ, và tài liệu ghi lại điều này để không ai dựng lại nó mà tưởng là đang bảo vệ được gì.

Muốn chặn thật thì cần thứ khác: rate limit theo IP có state ngoài bộ nhớ tiến trình, hoặc App Check. Cả hai đều ngoài phạm vi dự án 6 tuần.

## Database: Cloudflare D1

`POST/GET /api/events` **giữ nguyên hợp đồng** so với thời Firestore (cùng tham số, thứ tự, dạng JSON). Khác biệt: `created_at` chính xác tới **micro-giây** (`…03.067000Z`), `seed_batch` chỉ có ở event seed, và lọc `user_id` sắp/`limit` thẳng ở DB. Lỗi D1 trả `500 { "error": "Could not read events" | "Could not write event" | "Could not read table" }` — chi tiết ở log server (không bao giờ chứa token).

Credential D1 (`CLOUDFLARE_API_TOKEN`) chỉ sống trong `lib/server/db/d1.ts` (`.env.local`, đã gitignore). Mọi file trong `lib/server/` mở đầu bằng `import 'server-only'`, nên kéo một cái vào Client Component là build đỏ ngay — xem `CLAUDE.md` quy tắc 1. Thiết kế đầy đủ: `docs/d1-schema-design.md`.
