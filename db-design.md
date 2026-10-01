# db-design.md — GSM ride-booking simulation

> **Database: Cloudflare D1** (SQLite) — gọi từ app bằng REST (`lib/server/db/d1.ts`). Trước 10/2026 dự án dùng Firestore; lý do và quá trình chuyển ở `docs/d1-schema-design.md`, `docs/firebase-audit.md`. File này mô tả **schema hiện tại**; DDL chính thức nằm ở `migrations/*.sql`.

## Nguyên tắc
- **Hai nhóm bảng:** bảng của **app** (`events`, `users`, do app ghi) và **11 bảng phân tích** (`dim_*`, `fact_*`, nạp từ `powerBI/*.csv`, chỉ đọc).
- Thay đổi schema = **migration mới** (`migrations/000N_*.sql`, `npx wrangler d1 migrations apply gsm-db --local` rồi `--remote`). Không sửa file migration đã áp, không `DROP` trên dữ liệu thật.
- Mọi SQL **tham số hoá** (`?` + params). Không bao giờ nối chuỗi.
- Hạn mức gói Free: **100.000 dòng ghi/ngày**, mỗi index tính thêm 1 lượt ghi/dòng → một event = 4 lượt ghi (1 dòng + 3 index). Hết hạn mức D1 từ chối cả đọc lẫn ghi.
- Kiểu dữ liệu: id/chuỗi `TEXT`; số nguyên (tiền VNĐ, đếm, `step_index`) `INTEGER`; số thực `REAL`; boolean `INTEGER` 0/1 (có `CHECK`); mọi thời điểm là `TEXT` ISO-8601 **UTC micro-giây cố định độ rộng** `YYYY-MM-DDTHH:MM:SS.ffffffZ` (so sánh chuỗi = so sánh thời gian).

## Bảng `events`

```
id               TEXT PK        ← 20 ký tự [A-Za-z0-9] do server sinh (id cũ của Firestore được giữ nguyên)
session_id       TEXT NOT NULL
user_id          TEXT NOT NULL  ← SĐT E.164 | anon-<uuid> (khách) | mock-user-* (event cũ)
flow             TEXT NOT NULL  ← CHECK IN ('ride','food','none')   ("none" chỉ ở màn home)
event_name       TEXT NOT NULL  ← 26 giá trị (lib/shared/types.ts) — không CHECK để thêm event không cần migration
screen_name      TEXT NOT NULL
previous_screen  TEXT NULL
step_index       INTEGER NOT NULL  ← CHECK >= 0
properties       TEXT NOT NULL DEFAULT '{}'  ← JSON (CHECK json_valid); khoá khác nhau theo event_name
platform         TEXT NOT NULL DEFAULT 'web' ← server gán
created_at       TEXT NOT NULL  ← server gán lúc ghi (UTC, µs)
seed_batch       TEXT NULL      ← CHỈ có ở event do scripts/seed-events.js sinh
```

Index: `idx_events_created_at (created_at, id)`, `idx_events_session_step (session_id, step_index)`, `idx_events_user_created_at (user_id, created_at)`. Bảng `WITHOUT ROWID`.

`properties` đọc bằng `json_extract(properties, '$.vehicle_type')`. Hình dạng từng `event_name` do `event-taxonomy.md` quy định — đó là nguồn sự thật, file này chỉ mô tả cột.

### `user_id`
Từ khi đăng nhập là SĐT dạng **E.164** (`+84912345678`), do **server** gán từ cookie `gsm_auth` — không phải giá trị client tự sinh. Khách chưa đăng nhập mang `anon-<uuid>` (client sinh, server chỉ nhận đúng dạng này); `confirm_ride`/`place_order` luôn có SĐT. Event rất cũ mang `mock-user-*` và không gộp được vào tài khoản nào.

> Số điện thoại là **dữ liệu cá nhân** và nằm thẳng trong mọi event. Đừng xuất bảng `events` ra ngoài nhóm; nếu cần chia sẻ, băm `user_id` trước. Đặt `ANALYTICS_TOKEN` để khoá `GET /api/events`.

### Ví dụ — luồng Đặt xe
```json
{
  "id": "yoz8j6LlYbb5GvufFtmM", "session_id": "abc-123", "user_id": "+84912345678",
  "flow": "ride", "event_name": "select_vehicle", "screen_name": "vehicle_selection",
  "previous_screen": "pickup_confirm", "step_index": 3, "platform": "web",
  "properties": { "vehicle_id": "veh-bike", "vehicle_type": "bike", "base_price": 30000, "distance_km": 3.8 },
  "created_at": "2026-09-15T10:12:03.482000Z"
}
```
### Ví dụ — `confirm_ride` / `place_order`
Hai event kết thúc funnel, **tự mô tả đủ một chuyến/đơn** (nguồn duy nhất dựng nên màn `/history`): `address_label`, `address_source`, giá, `payment_method`… Chi tiết khoá: `event-taxonomy.md`. `address_id` kiểu `osm-<type><id>` không có bảng nào tra ra tên → luôn ghi kèm `address_label`.

`platform` và `created_at` do `lib/server/services/event.service.ts` tự gắn, **không** nằm trong request body (xem `api-endpoints.md`).

## Bảng `users`
```
phone          TEXT PK        ← E.164
created_at     TEXT NOT NULL  ← lần đăng nhập đầu (không đổi)
last_login_at  TEXT NOT NULL
```
Upsert **best effort** sau khi xác thực mã (`user.service.ts`): D1 hết hạn mức thì vẫn đăng nhập được, chỉ thiếu dòng sổ sách. Mã OTP **không** lưu trong database: thử thách (hash của mã + hạn + nonce) nằm trong cookie httpOnly `gsm_otp` ký HMAC.

## 11 bảng phân tích (`dim_*`, `fact_*`)
Nạp từ `powerBI/*.csv` bằng `scripts/migrate-firebase-to-d1.js`; đọc qua `GET /api/analytics/<table>` (`api-endpoints.md` mục 4b). Cột và kiểu: `migrations/0002_analytics_schema.sql`.

| Bảng | Khoá chính | Nạp |
|---|---|---|
| `dim_region`, `dim_hex`, `dim_promo`, `dim_promo_cap_history`, `dim_date`, `dim_merchant`, `dim_user` | khoá tự nhiên | đủ |
| `fact_promo_budget` (324) | `month_start, service, hex_id, segment` | đủ |
| `fact_ride` (41.783) | `session_id` | đủ |
| `fact_food` | `session_id` | **tập con mock** (7.232/64.968) |
| `fact_promo_burn` | `burn_event_id` | **tập con mock** (3.000/26.040, chỉ các dòng có session tồn tại) |

Đây là dữ liệu **mô phỏng tĩnh**, tách hẳn khỏi `events` (user `U00001…`, không phải SĐT). Quy tắc tập con: `scripts/lib/mock-subset.js`; muốn nạp hết: `node scripts/migrate-firebase-to-d1.js --all-rows`. Khoá ngoại có hiệu lực (D1 bật `foreign_keys`) nên nạp theo thứ tự dim → fact.

## Cách ghi 1 event (trong `lib/server/services/event.service.ts`)
```ts
await d1Query(
  `INSERT INTO events (id, session_id, user_id, flow, event_name, screen_name, previous_screen,
                       step_index, properties, platform, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [id, p.session_id, p.user_id, p.flow, p.event_name, p.screen_name, p.previous_screen,
   p.step_index, JSON.stringify(p.properties), 'web', createdAt],
);
```

## Cách đọc lại theo session (replay / phân tích)
```sql
SELECT * FROM events WHERE session_id = ? ORDER BY step_index, created_at, id;
```
Hoặc `GET /api/events?session_id=<id>`; hoặc `analysis/fetch_events.py` → `output/events.csv`.

## Field `seed_batch` — chỉ có ở dữ liệu giả lập
`scripts/seed-events.js` ghi thẳng vào `events` (qua REST, bỏ qua Next.js) để sinh hàng nghìn event trải 90 ngày cho Power BI; mỗi dòng mang `seed_batch = "seed-<timestamp>"`. Event người thật click **không có** field này, nên tách dữ liệu giả khỏi thật chỉ là một điều kiện lọc (`seed_batch IS NULL`), và `--clear` xoá chính xác (`WHERE seed_batch IS NOT NULL`, tuỳ chọn `--batch`). Script tự gán `created_at` quá khứ và `platform='web'`. Lưu ý: 9.000 event seed = 36.000 lượt ghi — gần nửa hạn mức một ngày.

## Về danh sách 17 trường của mentor (chưa confirm)
Khi có list thật: field **dùng để lọc/sắp xếp thường xuyên** → thêm **cột** bằng migration (kèm index nếu cần, nhớ chi phí ghi); field đặc thù ít lọc → thêm khoá vào `properties` (không cần migration). Phải sửa: `EventPayload` trong `lib/shared/types.ts`, `lib/server/validators/event.validator.ts` (whitelist hiện chỉ lấy đúng 8 field — field mới không thêm vào đây sẽ bị loại im lặng), và `INSERT` trong `event.service.ts`. Quy trình: `event-taxonomy.md` mục 6.
