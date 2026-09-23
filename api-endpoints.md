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
> `flow: "none"` chỉ dành cho `screen_view` ở màn `home` — lúc đó người dùng chưa chọn luồng nào. Xem `event-taxonomy.md` mục 1.

Field do **server tự gắn**, client gửi lên cũng bị bỏ qua:
- `platform: "web"` — vì vậy request body không chứa field này, dù document trong Firestore có (xem `db-design.md`).
- `created_at: FieldValue.serverTimestamp()` — luôn dùng giờ server, không tin giờ máy client.

Route dùng **whitelist**: chỉ lấy đúng 8 field ở bảng trên từ body, mọi field lạ khác bị loại bỏ im lặng (không trả lỗi).

**Response lỗi (400)** — thiếu field bắt buộc hoặc sai kiểu:
```json
{ "error": "Missing required field: flow" }
{ "error": "Invalid value for flow: expected \"ride\" | \"food\"" }
```

**Response lỗi (401)** — chỉ xuất hiện khi biến `EVENTS_WRITE_KEY` được đặt ở BE:
```json
{ "error": "Thiếu hoặc sai khoá ghi event" }
```

Xem mục "Khoá `x-gsm-key`" ở cuối tài liệu này.

### 2. Lấy toàn bộ event của 1 session
```
GET /api/events?session_id=abc-123
```
File: `apps/api/src/routes/events.routes.ts`, handler `GET`.

**Response (200):** mảng document, sắp xếp theo `step_index` tăng dần — dùng cho phân tích & replay.

> **Thứ tự `step_index` KHÔNG còn xấp xỉ thứ tự thời gian.** `select_flow` luôn mang `step_index: 0` (`event-taxonomy.md` mục 1), kể cả khi người dùng bấm tab đổi luồng ở giữa phiên — event đó vì thế nhảy lên đầu mảng. Muốn đọc đúng dòng thời gian thì sắp lại theo `created_at`:
> ```bash
> curl -s "localhost:3000/api/events?session_id=$SID" | jq 'sort_by(.created_at)'
> ```

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
| `flat` | `1` \| `true` | Trải `properties` thành cột `prop_<tên>` ở cấp cao nhất |
| `limit` | số nguyên > 0 | Chặn số document trả về. Vắng = trả hết |

#### `flat=1` — cho công cụ BI đọc JSON trực tiếp

```
GET /api/events?flat=1
```

`properties` là map lồng nhau và **mỗi loại event có bộ khoá khác nhau**. Power BI / Tableau đọc thẳng JSON sẽ dựng một cột kiểu Record mà người dùng phải tự bấm Expand, và expand ra không đều giữa các dòng.

`flat=1` trả về bảng phẳng: 10 field top-level giữ nguyên, `properties` biến thành các cột `prop_<tên>`. **Mọi dòng có cùng tập khoá**, khoá thiếu là `null` — phần này mới là phần quan trọng: nếu để mỗi dòng chỉ mang khoá của riêng nó thì Power BI suy kiểu bảng bằng cách đọc vài dòng đầu, và `prop_final_price` (chỉ xuất hiện ở `confirm_ride`, một event hiếm trong dòng sự kiện) có thể không lọt vào mẫu — lúc đó cột đó **biến mất khỏi bảng mà không báo gì**.

Tiền tố `prop_` **cố ý trùng** với `analysis/fetch_events.py`, nên hai đường đọc dữ liệu cho ra cùng tên cột và biểu đồ Power BI nói về cùng một thứ với biểu đồ matplotlib.

> **`limit` đi vào query Firestore, không cắt sau khi lấy về** — mỗi document đọc lên là một lượt đọc tính vào hạn mức (free tier 50.000/ngày). Ngoại lệ duy nhất là nhánh `user_id` (sắp trong bộ nhớ): ở đó không thể limit phía Firestore vì "200 document đầu theo thứ tự tuỳ ý" không phải "200 document đầu theo thời gian".

> **Hạn mức đọc là thứ chặn trước tiên khi nối BI.** Một lần refresh toàn bộ ≈ số document trong collection. Với ~7.800 document: 1 lần/ngày = thoải mái, 6 lần/ngày = sát trần 50.000, mỗi giờ = vượt gần 4 lần. Dùng `from=` để chỉ kéo phần mới nếu cần refresh dày.

> **`user_id` cố ý không dùng `orderBy` của Firestore.** Một `where('user_id','==')` cộng một `orderBy('created_at')` trên field khác sẽ bị Firestore từ chối và bắt tạo composite index — tức người chạy dự án phải bấm link, đợi index build, rồi mới demo được. Dữ liệu một người dùng chỉ vài trăm document, nên service lấy về rồi **sắp xếp trong bộ nhớ**. Đổi lại là không phải cấu hình gì thêm sau khi clone.

### 3b. Tìm địa chỉ thật
```
GET /api/places?q=Hồ Gươm&limit=6
```
File: `apps/api/src/routes/places.routes.ts` → `validators/place.validator.ts` → `services/place.service.ts`.

Nguồn: **[Photon](https://photon.komoot.io/)** (komoot), chạy trên dữ liệu OpenStreetMap. Miễn phí, không API key.

> **Vì sao không còn dùng Nominatim.** Trên máy chạy dự án này, **toàn bộ `*.openstreetmap.org` không kết nối được** — cả `nominatim.openstreetmap.org` lẫn `tile.openstreetmap.org` — trong khi OSRM và mọi dịch vụ khác vẫn thông. Ô tìm địa chỉ vì thế im lặng không ra kết quả nào. Photon chạy trên đúng dữ liệu OSM, khác mỗi tên miền và hạ tầng, và **giữ nguyên `osm_type` + `osm_id`** nên `id` dạng `osm-N240109189` không đổi (`CLAUDE.md` quy tắc 5).

> **`bbox` là bắt buộc.** Photon chỉ *ưu tiên* theo `lat`/`lon` chứ không cắt, nên tìm "Hồ Gươm" trả về một tiệm ăn ở München ngay ở kết quả thứ hai. Nominatim trước đây chặn bằng `countrycodes=vn`; Photon không có tham số đó nên phải dùng khung bao Việt Nam `102.1,8.2,109.6,23.4`.

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

**Vì sao phải proxy qua `apps/api` chứ không gọi thẳng từ trình duyệt** — ba lý do, lý do đầu là chặn cứng:

1. Điều khoản OSM bắt buộc mỗi request mang `User-Agent` định danh, mà **trình duyệt không cho JavaScript đặt header đó**.
2. OSM giới hạn tuyệt đối **1 request/giây**. Chỉ ở server mới đặt được hàng đợi thật; debounce phía client là gợi ý, không phải bảo đảm.
3. Cache dùng chung. Gõ "Cầu Giấy" rồi xoá lùi sẽ hỏi lại đúng những query vừa hỏi.

**Lỗi (502)** khi Nominatim rớt / trả 429 / hết thời gian chờ:
```json
{ "error": "Không tìm được địa chỉ lúc này (upstream 429)" }
```
FE phải **suy biến êm**: hiện cảnh báo nhưng vẫn liệt kê 5 địa chỉ gợi ý để luồng đi tiếp được. Cùng tinh thần với `trackEvent().catch(() => {})` — hạ tầng lỗi không được kẹt người dùng.

Endpoint này **không chạm Firestore** và **không ghi event nào**: gõ phím không phải một bước funnel.

### 3b-bis. Tìm quán ăn quanh một toạ độ
```
GET /api/restaurants?lat=21.0369&lon=105.7856&radius=2000&limit=20
GET /api/restaurants?lat=21.0369&lon=105.7856&q=pho
```
File: **cùng** `apps/api/src/routes/places.routes.ts` → `validators/place.validator.ts` (`validateRestaurantQuery`) → **`services/overpass.service.ts`** (`searchRestaurants`).

Nguồn: **[Overpass API](https://overpass-api.de/)**, truy vấn thẳng cơ sở dữ liệu OpenStreetMap. Miễn phí, không API key.

> **Vì sao bỏ Nominatim ở đây — hai lý do, lý do thứ hai đúng cả khi mạng thông:**
>
> 1. `*.openstreetmap.org` không kết nối được từ máy chạy dự án (xem mục 3b).
> 2. **Nominatim là một *geocoder*, không phải chỉ mục POI.** `amenity=restaurant` là truy vấn có cấu trúc xếp theo "importance", nên nó trả về rất thưa — **6-hoặc-0 quán ngay giữa Cầu Giấy**. Overpass truy vấn theo bán kính và trả về **80 quán** ở đúng toạ độ đó. Đây là khác biệt về *đúng công cụ*, không phải về *máy chủ nào còn sống*.

**Response (200):** mảng `Restaurant` (`packages/shared/src/places.ts`) — `Place` cộng các tag OSM:
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
3. **`q` được lọc ở JS, KHÔNG gửi lên Overpass.** Overpass **từ chối** (406 Not Acceptable) các truy vấn có lớp ký tự tiếng Việt trong regex — đây là bộ lọc của hạ tầng trước nó, không sửa được bằng cách viết regex khéo hơn. Lọc ở JS dùng `normalizeVi` (đã có sẵn trong `@gsm/shared`) nên **gõ "pho" ra "Phở", "ca phe" ra "Cà Phê"** — bộ lọc phía Overpass không làm được việc đó. Thêm nữa, **khoá cache không chứa `q`**, nên mỗi phím gõ thêm không sinh một lời gọi Overpass mới: cả màn tìm kiếm chạy trên một lần tải duy nhất.
4. **Gate riêng, `minGapMs` 300ms.** Overpass không áp luật 1 request/giây của OSM; dùng chung gate với Photon/OSRM sẽ kéo cả tra địa chỉ lẫn tuyến đường chậm theo mà không có lý do gì.

> **Độ phủ tag vẫn thưa.** Nhiều quán không có `cuisine`, `opening_hours` hay `addr:*`. Mọi trường thêm đều optional, `address` lui về `"Chưa có địa chỉ chi tiết"`, và FE **không được lọc bỏ** quán thiếu tag. Quán **không có `name`** là trường hợp duy nhất bị loại — không hiển thị được.

**Lỗi (502)** khi Overpass rớt. FE hiện thông báo kèm nút "Thử lại" chứ **không** chặn màn menu — ba cách tìm món còn lại vẫn dùng được.

### 3b-ter. Toạ độ → địa chỉ thật (reverse geocode)
```
GET /api/reverse?lat=21.0369&lon=105.7856
```
File: `apps/api/src/routes/places.routes.ts` → `validators/place.validator.ts` (`validateReverseQuery`) → `services/photon.service.ts` (`reversePlace`).

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

Endpoint này **không chạm Firestore** và **không ghi event nào**.


### 3c. Tìm tuyến đường thật
```
GET /api/route?from=21.0369,105.7856&to=21.2189,105.8045
```
File: `apps/api/src/routes/route.routes.ts` → `validators/route.validator.ts` → `services/route.service.ts`.

**Response (200):** một `RouteResult` (kiểu ở `packages/shared/src/route.ts`)
```json
{ "distanceKm": 28.4, "durationMin": 38, "source": "osrm",
  "geometry": [[21.0369,105.7856], [21.0371,105.7859], "…vài trăm điểm…"] }
```

| Param | Kiểu | Bắt buộc |
|---|---|---|
| `from` | `"lat,lon"` — lat ∈ [-90,90], lon ∈ [-180,180] | ✅ |
| `to` | như trên | ✅ |

Nguồn: [OSRM](https://project-osrm.org/) `router.project-osrm.org`, hồ sơ `driving`. Miễn phí, không API key. Proxy qua `apps/api` vì cùng ba lý do với `/api/places`: đặt được `User-Agent`, giữ được hàng đợi, và cache dùng chung — `service` dùng lại **đúng cơ chế** đã viết trong `place.service.ts`.

**Lỗi (502)** khi OSRM rớt / quá thời gian chờ:
```json
{ "error": "Không tính được tuyến đường lúc này (upstream 429)" }
```

> **`router.project-osrm.org` là máy chủ demo công cộng, không cam kết uptime.** Vì vậy FE **bắt buộc có đường lui**: gặp 502 thì gọi `straightRoute()` trong `@gsm/shared` — nối thẳng hai điểm, quãng đường theo công thức haversine — rồi ghi `route_source: "straight"` vào event. Luồng đặt xe **không bao giờ bị chặn** vì một dịch vụ bên ngoài, và dữ liệu vẫn nói thật về việc con số đến từ đâu.

Endpoint này **không chạm Firestore** và **không ghi event nào**.

### 3d. Dò nhà cung cấp tile bản đồ
```
GET /api/tiles
```
File: `apps/api/src/routes/tiles.routes.ts` → `services/tiles.service.ts`. Không nhận tham số nào nên không có validator.

**Response (200):** tên các nhà cung cấp còn dùng được, **giữ nguyên thứ tự ưu tiên** trong `TILE_PROVIDERS` (`packages/shared/src/tiles.ts`)
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
| Stadia (`osm_bright`) | 495 B | sạch |
| CARTO | **1718 B** | có watermark |
| Stadia, referer bản deploy | 14.885 B | 401 — loại ở bước mã trạng thái |

Ngưỡng `PROBE_MAX_BYTES = 800` nằm giữa khe hở 495 → 1718. **Đổi tone bản đồ thì phải đo lại con số này** — tone có màu nặng hơn tone xám ngay cả ở giữa biển (`alidade_smooth` 156 B → `osm_bright` 495 B). Một nhà cung cấp bị loại khi **đã trả lời** mà tile quá lớn, sai `content-type`, hoặc trả mã lỗi.

> **Lỗi mạng KHÔNG phải là bằng chứng hỏng.** Không kết nối được thì nhà cung cấp đó vẫn được **giữ lại** trong danh sách. Việc của phép dò là *loại thứ đã chứng minh là hỏng*, không phải *chỉ nhận thứ đã chứng minh là tốt* — kết quả được cache 6 giờ, nên nếu một cú chớp mạng cũng đủ loại một nhà cung cấp thì danh sách dự phòng sẽ bị đầu độc cả buổi. Trường hợp nhà cung cấp chết thật thì `onError` ở FE vẫn bắt được.

**Lỗi (502)** khi bản thân phép dò thất bại. FE coi đây là *"không biết gì"* và lui về dùng nguyên cả bảng `TILE_PROVIDERS` — khác hẳn với `{"providers":[]}`, vốn có nghĩa *"đã dò, không nhà nào dùng được"*.

Endpoint này **không chạm Firestore** và **không ghi event nào**.

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

Hệ quả cần biết: khi deploy công khai, `POST /api/events` trở thành endpoint mở — bất kỳ ai cũng ghi được document rác vào collection `events` và làm hỏng số liệu phân tích.

Biện pháp đã chọn là **shared secret trong header** (mục ngay dưới). Hai lựa chọn còn lại từng cân nhắc: App Check gắn chặt vào Firebase SDK phía client mà dự án cố tình không có; rate limit theo IP thì chặt hơn nhưng cần thêm state, và `upstream.ts` đã cho thấy state trong bộ nhớ tiến trình là thứ phải tính kỹ. Shared secret là mức vừa đủ cho một app demo.

### Khoá `x-gsm-key`

Chỉ bật khi biến `EVENTS_WRITE_KEY` được đặt ở BE. **Không đặt = không kiểm tra**, và đó là mặc định khi chạy local — không ai phải cấu hình thêm để chạy dự án, `analysis/fetch_events.py` cũng không đổi gì.

| | |
|---|---|
| Áp cho | **cả `POST` lẫn `GET /api/events`** (`/history` đọc lại event qua cùng đường proxy) |
| Header | `x-gsm-key` |
| Sai hoặc thiếu | `401 { "error": "Thiếu hoặc sai khoá ghi event" }` |
| Ai gắn header | `apps/web/middleware.ts`, **ở tầng máy chủ** |

**Trình duyệt không bao giờ biết giá trị khoá.** Đây là điểm chính: `lib/track.ts` vẫn gọi `fetch('/api/events')` same-origin y như cũ, rồi máy chủ của `apps/web` mới gắn header trước khi chuyển tiếp sang `apps/api`. Mở DevTools cũng không thấy, đọc bundle cũng không có. Nếu gắn header trong `track.ts` thì khoá nằm trong JS tải về máy người dùng và hoàn toàn vô nghĩa — **đừng chuyển nó sang FE cho gọn**.

Các endpoint còn lại (`/api/places`, `/api/reverse`, `/api/restaurants`, `/api/route`, `/api/tiles`, `/api/health`) **không bị chặn**: chúng chỉ đọc dữ liệu công khai, không ghi gì, nên đóng lại không được lợi gì mà mất khả năng gọi thẳng để debug.

Vẫn nên giữ nguyên tắc **sinh xong dữ liệu phân tích rồi hãy deploy công khai**. Khoá chặn được bot và người tò mò, không chặn được người quyết tâm — họ vẫn mở được web và click thật.

## Lưu ý riêng cho Firestore
Credential Firebase Admin SDK (service account key) chỉ sống trong `apps/api` (`apps/api/.env`, đã gitignore). `apps/web` **không có `firebase-admin` trong `dependencies`** nên không import nổi — xem `CLAUDE.md` quy tắc 1.

Query kết hợp `where` + `orderBy` trên 2 field khác nhau sẽ bị Firestore từ chối **kèm một link tạo index sẵn trong thông báo lỗi**. Vì vậy `GET /api/events` trả nguyên văn message lỗi của Firestore thay vì nuốt đi — nó chứa đường dẫn cần đi (xem `db-design.md`).