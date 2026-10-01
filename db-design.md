# db-design.md — GSM ride-booking simulation

## Nguyên tắc thiết kế
Firestore là **NoSQL document database** — không có bảng/cột cố định như Postgres. Dữ liệu tổ chức theo **collection** (giống "thư mục") chứa nhiều **document** (giống 1 file JSON). Project này chỉ cần **1 collection**: `events`.

Vì Firestore document vốn đã linh hoạt (thêm field nào cũng được, không cần khai báo trước), ta **không cần** kỹ thuật "cột `properties` JSONB" như ở thiết kế Postgres trước theo đúng nghĩa kỹ thuật — nhưng vẫn nên gom các field đặc thù theo từng flow vào 1 field `properties` dạng map, để giữ cấu trúc gọn và dễ đọc, nhất quán giữa 2 luồng.

## Cấu trúc document trong collection `events`
```
events (collection)
 └─ {auto-id} (document)
     ├─ session_id: string
     ├─ user_id: string
     ├─ flow: "ride" | "food" | "none"   // "none" chi o man home
     ├─ event_name: string
     ├─ screen_name: string
     ├─ previous_screen: string | null
     ├─ step_index: number
     ├─ platform: string          // "web"
     ├─ properties: map           // field đặc thù theo loại event
     └─ created_at: timestamp     // Firestore server timestamp
```

### `user_id` = số điện thoại đăng nhập

Từ khi có đăng nhập, `user_id` là số điện thoại dạng **E.164** (`+84912345678`), do **server** gán từ cookie `gsm_auth` — không phải giá trị client tự sinh. Event cũ trước khi có đăng nhập vẫn mang `mock-user-*` và **không được gộp** vào tài khoản nào.

> Số điện thoại là **dữ liệu cá nhân** và nằm thẳng trong mọi event. Đừng xuất collection `events` ra ngoài nhóm; nếu cần chia sẻ, băm `user_id` trước.

## Collection `users`

```
users/{phone}              ← doc id = E.164
  phone: string
  created_at: timestamp    (lần đăng nhập đầu)
  last_login_at: timestamp
```

Ghi **best effort** sau khi xác thực mã (`lib/server/services/user.service.ts`) — Firestore hết quota thì vẫn đăng nhập được, chỉ thiếu dòng sổ sách.

Mã OTP **không** lưu ở Firestore: thử thách (hash của mã + hạn + nonce) nằm trong cookie httpOnly `gsm_otp` được ký HMAC. Lý do: đăng nhập là bắt buộc, không được để hết quota free tier chặn cửa.

## Ví dụ document — luồng Đặt xe
```json
{
  "session_id": "abc-123",
  "user_id": "+84912345678",
  "flow": "ride",
  "event_name": "select_vehicle",
  "screen_name": "vehicle_selection",
  "previous_screen": "pickup_confirm",
  "step_index": 3,
  "platform": "web",
  "properties": { "vehicle_type": "bike" },
  "created_at": "2026-09-15T10:12:03Z"
}
```

## Ví dụ document — luồng Food
```json
{
  "session_id": "abc-124",
  "user_id": "+84987654321",
  "flow": "food",
  "event_name": "add_to_cart",
  "screen_name": "food_item_detail",
  "previous_screen": "food_menu",
  "step_index": 3,
  "platform": "web",
  "properties": {
    "item_id": "banh-mi-01",
    "item_name": "Bánh mì thịt nướng",
    "price": 35000,
    "quantity": 1,
    "cart_size_after": 1,
    "cart_total_after": 35000
  },
  "created_at": "2026-09-15T10:14:20Z"
}
```

## Ví dụ document — `confirm_ride` với địa chỉ tự tìm

Event kết thúc funnel ride, và là **nguồn duy nhất** dựng nên một dòng ở màn `/history`:

```json
{
  "session_id": "abc-125",
  "user_id": "+84987654321",
  "flow": "ride",
  "event_name": "confirm_ride",
  "screen_name": "ride_confirm",
  "previous_screen": "promo_selection",
  "step_index": 5,
  "platform": "web",
  "properties": {
    "address_id": "osm-R198437",
    "address_label": "Hồ Hoàn Kiếm",
    "address_source": "search",
    "pickup_id": "pickup-current",
    "pickup_label": "Vị trí hiện tại",
    "vehicle_id": "veh-bike",
    "vehicle_type": "bike",
    "promo_id": null,
    "base_price": 35000,
    "discount_amount": 0,
    "final_price": 35000,
    "payment_method": "cash"
  },
  "created_at": "2026-09-15T10:20:11Z"
}
```

> `address_id` ở đây **không** thuộc tập `addr-*` của `mock-data.md` — người dùng tự tìm địa chỉ qua `GET /api/places`, id là `osm-<osm_type><osm_id>`. Vì vậy `address_label` phải được ghi kèm: **không có bảng nào tra id đó ra tên**. `address_source` cho biết nên gom nhóm theo id (`preset`) hay theo nhãn (`search`).

> Giá trị `screen_name`, `previous_screen`, `step_index` và cấu trúc `properties` của **mọi** event được quy định trong `event-taxonomy.md` — đó là nguồn sự thật, file này chỉ minh hoạ hình dạng document.

`platform` do `lib/server` tự gắn, **không** nằm trong request body (xem `api-endpoints.md`).

## Cách ghi 1 document (trong `lib/server/services/event.service.ts`, dùng Admin SDK)
```js
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const db = getFirestore();
await db.collection('events').add({
  session_id: 'abc-123',
  user_id: '+84912345678',
  flow: 'ride',
  event_name: 'select_vehicle',
  screen_name: 'vehicle_selection',
  previous_screen: 'pickup_confirm',
  step_index: 3,
  platform: 'web',
  properties: { vehicle_type: 'bike' },
  created_at: FieldValue.serverTimestamp(),
});
```
`.add()` tự sinh document id — không cần tự tạo id như `event_id` ở bản Postgres trước.

## Cách đọc lại theo session (dùng cho phân tích/replay)
```js
const snapshot = await db.collection('events')
  .where('session_id', '==', 'abc-123')
  .orderBy('step_index')
  .get();

const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
```

## Field thứ 10: `seed_batch` — chỉ có ở dữ liệu giả lập

`scripts/seed-events.js` ghi thẳng vào collection `events` bằng `firebase-admin`, bỏ qua cả Next.js lẫn Express, để sinh hàng nghìn document trải theo ngày cho Power BI. Mỗi document nó sinh ra mang **thêm một field top-level**:

```
seed_batch: "seed-2026-09-22T07-41-12-345Z"   // chỉ có ở document do script sinh
```

Đây là lệch có chủ ý so với 9 field ở trên. Lý do: event do người thật click **không có** field này, nên tách dữ liệu giả khỏi dữ liệu thật chỉ là một điều kiện lọc, và dọn lại thì chính xác tuyệt đối — `node scripts/seed-events.js --clear` truy vấn bằng `.orderBy('seed_batch')`, mà Firestore **chỉ trả về document có field được orderBy**, nên event click tay nằm ngoài kết quả một cách tự nhiên, không cần điều kiện `!=` nào và không có cách nào xoá nhầm.

Script cũng phải tự gán `platform: 'web'` và `created_at: Timestamp.fromDate(...)` (thay vì `serverTimestamp()`) — hai việc mà `event.service.ts` làm hộ khi đi qua API, và `serverTimestamp()` thì sẽ dồn toàn bộ event vào đúng thời điểm chạy script, mất sạch trục thời gian.

Phân tích muốn **chỉ lấy dữ liệu thật** thì lọc `seed_batch` vắng mặt; muốn **chỉ lấy dữ liệu giả** thì lọc nó có mặt. `fetch_events.py` kéo hết cả hai và có `seed_batch` trong `TOP_LEVEL_FIELDS`, nên cột này ra thẳng `events.csv` — rỗng (`NaN`) ở mọi event do người thật click.

## Sink BigQuery cho `events`

`events` được đồng bộ **một chiều, tăng dần** sang BigQuery `gsm_analytics.fact_events` bằng `scripts/bigquery/sync-events.js` (schema và cách chạy: `docs/BIGQUERY_SETUP.md`). Firestore vẫn là nguồn sự thật; API `/api/events` không đổi. `event_id` = document ID Firestore, `seed_batch` được giữ để tách dữ liệu giả.

Checkpoint lưu ở doc `system/bigquery_events_sync` (`cursor` là Timestamp, `last_run_at`, `last_summary`). Đây là collection hệ thống của script, **không** phải dữ liệu app — đừng xoá khi chưa muốn đồng bộ lại từ đầu (xoá thì chạy `--backfill`).

## Collection `pbi_*` — dữ liệu Power BI

`scripts/import-powerbi.js` nạp 11 CSV trong `powerBI/` thành 11 collection `pbi_<tên file>` (`pbi_dim_user`, `pbi_fact_ride`, `pbi_fact_food`, `pbi_fact_promo_burn`…). Tách hẳn khỏi `events`/`users`: schema khác (user `U00001`, không phải SĐT) và không được trộn vào funnel.

- Doc id = khoá tự nhiên (`R0000001`, `U00001`, `WELCOME30-v1`, `20260601`; budget = `<month_start>_<service>_<hex_id>_<segment>`) → chạy lại là ghi đè, không nhân đôi.
- `session_start`, `event_datetime` là `Timestamp` (giờ VN, +07:00); các cột ngày còn lại giữ chuỗi `YYYY-MM-DD`; id luôn là chuỗi.
- Mỗi document có `import_batch`; `--clear` xoá đúng những document có field này.
- Gói Spark (20k write/ngày): mặc định mỗi lần ghi tối đa 18.000, tiến độ lưu ở `scripts/.import-powerbi-state.json` (gitignored) — chạy lại cùng lệnh để nạp tiếp (~8 ngày cho 137k document).

```bash
node scripts/import-powerbi.js --dry-run   # xem trước, không cần credential
node scripts/import-powerbi.js             # nạp tiếp
node scripts/import-powerbi.js --clear     # xoá toàn bộ pbi_*
```

## Lưu ý về index
Firestore tự tạo index đơn giản (theo 1 field), nhưng khi query kết hợp `where` + `orderBy` trên 2 field khác nhau (như ví dụ trên), hoặc nhiều `where` cùng lúc (lọc theo `flow` và khoảng `created_at`), Firestore sẽ **yêu cầu tạo composite index** — lần đầu chạy sẽ báo lỗi kèm link để tạo index đó ngay trên console, không cần tự đoán trước.

## Về danh sách 17 trường của mentor (chưa confirm)
Khi có list thật, chỉ cần thêm field vào object khi ghi document — không có bước "migrate schema" như SQL (`ALTER TABLE`). Field nào dùng để lọc/sắp xếp thường xuyên thì để ở top-level document (như `flow`, `session_id`), field đặc thù ít dùng để lọc thì gom vào `properties`.

Cụ thể phải sửa: `EventPayload` trong `lib/shared/types.ts`, rồi `lib/server/validators/event.validator.ts` (whitelist hiện chỉ lấy đúng 8 field — field mới không thêm vào đây sẽ bị loại im lặng).

Quy trình chi tiết khi list được chốt: xem `event-taxonomy.md` mục 6.