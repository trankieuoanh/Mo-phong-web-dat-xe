# d1-schema-design.md — Thiết kế schema Cloudflare D1

> **PHASE 2 + PHASE 3.** Chỉ là thiết kế; chưa tạo database, chưa có migration, chưa sửa code.
> Căn cứ: `docs/firebase-audit.md` và các quyết định đã chốt:
>
> | # | Quyết định |
> |---|---|
> | 1 | Giữ **Vercel**, gọi D1 bằng **REST API** của Cloudflare (không binding) |
> | 2 | **D1 là nguồn dữ liệu duy nhất** → pipeline BigQuery bị loại bỏ |
> | 3 | Dữ liệu `powerBI/*.csv` **nạp thẳng từ CSV vào D1** (bỏ phần đã nạp dở ở Firestore) |
> | 4 | Script ngoài app + `analysis/fetch_events.py` chuyển sang gọi D1 qua REST |

## 1. Giới hạn D1 ảnh hưởng thiết kế (đã đối chiếu tài liệu Cloudflare, 2026-10-01)

| Giới hạn (gói Free) | Giá trị | Hệ quả |
|---|---|---|
| Rows read / ngày | 5.000.000 | dư xa (events ~9k dòng, có cache 5 phút) |
| **Rows written / ngày** | **100.000** | nút thắt khi nạp CSV (xem mục 8) |
| Dung lượng 1 database | **500 MB** (Free) | ước tính toàn bộ dữ liệu < 100 MB — đủ |
| Bound parameters / câu lệnh | **100** | `fact_ride` (50 cột) và `fact_food` (55 cột) chỉ chèn được **1 dòng/câu lệnh** → dùng *batch* nhiều câu lệnh |
| Độ dài câu SQL | 100 KB | ok |
| Kích thước 1 dòng/chuỗi | 2 MB | `properties` JSON rất nhỏ |
| Cột / bảng | 100 | bảng lớn nhất 55 cột |
| Thời gian 1 câu lệnh | 30 giây | ok |
| Chỉ mục | mỗi index **cộng thêm 1 lượt ghi/dòng** | giữ số index ở mức tối thiểu |

REST API: `POST /accounts/{account_id}/d1/database/{database_id}/query`, header `Authorization: Bearer <token>`, body `{ "sql", "params" }` hoặc `{ "batch": [ {sql, params}, … ] }`; phản hồi có `meta.rows_read/rows_written`. Batch chạy **như một transaction** (tất cả hoặc không) — dùng được cho idempotency. Tài liệu không nêu rate limit/kích thước request của endpoint này → **phải đo thực tế ở PHASE 4/6** trước khi chốt cỡ batch.

## 2. Quy ước kiểu dữ liệu (SQLite/D1)

| Nguồn | Kiểu D1 | Lý do |
|---|---|---|
| chuỗi, id, mã, enum | `TEXT` | id luôn là chuỗi (vd `hex_id` = `864143687ffffff`) |
| số nguyên (tiền VNĐ, đếm, `step_index`, `date_key`) | `INTEGER` | tiền luôn nguyên (CLAUDE.md) |
| số thực (`distance_km`, toạ độ, tỉ lệ giảm) | `REAL` | |
| boolean (`True`/`False` trong CSV) | `INTEGER` + `CHECK (x IN (0, 1))` | SQLite không có kiểu BOOLEAN |
| **mọi thời điểm** | `TEXT` ISO-8601 **UTC, cố định độ rộng, micro-giây**: `YYYY-MM-DDTHH:MM:SS.ffffffZ` | so sánh chuỗi = so sánh thời gian; giữ cursor chính xác tới µs (Firestore nano-giây bị cắt còn µs — BigQuery cũng chỉ tới µs) |
| ngày thuần (`signup_date`, `start_date`, `month_start`) | `TEXT` `YYYY-MM-DD` | giữ như CSV |
| `properties` (map lồng nhau) | `TEXT` chứa JSON | `json_extract(properties, '$.vehicle_type')` khi cần; JSON chuẩn hoá bằng `JSON.stringify` |
| ô rỗng trong CSV | `NULL` | |

Cột `dim_date.campaign` chứa **nhãn** (`6.18`, `7.7`, `8.8`) nên phải là `TEXT`, không phải `REAL` — lưu ý vì `scripts/import-powerbi.js` hiện suy ra số cho nó.

## 3. Bảng ứng dụng (ghi bởi app)

### 3.1 `events` ← Firestore `events` (9.160 document)

| Cột | Kiểu | Null? | Mặc định | Ghi chú |
|---|---|---|---|---|
| `id` | TEXT | PK | — | **giữ nguyên Firestore document ID** (20 ký tự); event mới tự sinh cùng định dạng |
| `session_id` | TEXT | NOT NULL | | |
| `user_id` | TEXT | NOT NULL | | SĐT E.164 \| `anon-<uuid>` \| `mock-user-*`. **Không** FK (khách ẩn danh không có dòng ở `users`) |
| `flow` | TEXT | NOT NULL | | `CHECK (flow IN ('ride','food','none'))` |
| `event_name` | TEXT | NOT NULL | | 26 giá trị; **không** CHECK để thêm event mới không cần migration (`lib/shared/types.ts` vẫn là nguồn sự thật) |
| `screen_name` | TEXT | NOT NULL | | tương tự |
| `previous_screen` | TEXT | NULL | NULL | màn đầu = NULL |
| `step_index` | INTEGER | NOT NULL | | `CHECK (step_index >= 0)` |
| `properties` | TEXT (JSON) | NOT NULL | `'{}'` | `CHECK (json_valid(properties))` |
| `platform` | TEXT | NOT NULL | `'web'` | |
| `created_at` | TEXT (ISO µs) | NOT NULL | — | server gán lúc ghi; **không** mặc định để tránh ms thay vì µs |
| `seed_batch` | TEXT | NULL | NULL | chỉ event do `seed-events.js` sinh |

```sql
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  flow TEXT NOT NULL CHECK (flow IN ('ride', 'food', 'none')),
  event_name TEXT NOT NULL,
  screen_name TEXT NOT NULL,
  previous_screen TEXT,
  step_index INTEGER NOT NULL CHECK (step_index >= 0),
  properties TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(properties)),
  platform TEXT NOT NULL DEFAULT 'web',
  created_at TEXT NOT NULL,
  seed_batch TEXT
) WITHOUT ROWID;

CREATE INDEX idx_events_created_at      ON events (created_at, id);
CREATE INDEX idx_events_session_step    ON events (session_id, step_index);
CREATE INDEX idx_events_user_created_at ON events (user_id, created_at);
```

**Vì sao `WITHOUT ROWID` và chỉ 3 index:** mỗi event ghi tốn `1 + số index` lượt ghi trong hạn mức 100k/ngày. Bảng `WITHOUT ROWID` khoá TEXT không sinh thêm index ngầm cho khoá chính (rowid-table sẽ tốn thêm 1). 3 index phục vụ đúng 3 đường truy vấn ở mục 5 → mỗi event = **4 lượt ghi**; migrate 9.160 event = 36.640 lượt. Index `(flow, created_at)` và `(seed_batch)` **bỏ có chủ ý**: ở quy mô ~10k dòng, lọc `flow`/`seed_batch` quét `idx_events_created_at` vẫn rẻ (đọc ≪ 5M/ngày) và tiết kiệm 2 lượt ghi/event. Thêm lại bằng migration mới nếu số dòng lớn lên.

### 3.2 `users` ← Firestore `users` (2 document)

| Cột | Kiểu | Null? | Ghi chú |
|---|---|---|---|
| `phone` | TEXT | PK | E.164 |
| `created_at` | TEXT (ISO µs) | NOT NULL | lần đăng nhập đầu — **không đổi** khi đăng nhập lại |
| `last_login_at` | TEXT (ISO µs) | NOT NULL | |

```sql
CREATE TABLE users (
  phone TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  last_login_at TEXT NOT NULL
) WITHOUT ROWID;
```
`recordLogin` hiện là 2 lệnh Firestore (`create` rồi `set merge`); trên D1 thành **một** upsert:
`INSERT INTO users (phone, created_at, last_login_at) VALUES (?, ?, ?) ON CONFLICT(phone) DO UPDATE SET last_login_at = excluded.last_login_at` (giữ nguyên `created_at`).

### 3.3 Không migrate
- `otp_codes` (mồ côi, không còn code dùng).
- `system/bigquery_events_sync` và toàn bộ pipeline BigQuery (quyết định #2). Không cần bảng `sync_state`.
- Các collection `pbi_*` ở Firestore (quyết định #3): D1 nạp lại từ CSV.

## 4. Bảng phân tích Power BI ← `powerBI/*.csv` (nạp từ CSV, 11 bảng)

Tên bảng D1 **trùng tên file CSV** (`dim_user`, `fact_ride`…), không có tiền tố `pbi_` — không xung đột với `events`/`users` và khớp tên Power BI. Kiểu cột suy ra bằng cách quét **toàn bộ** dòng của từng CSV (không phỏng đoán); `NOT NULL` chỉ đặt cho cột không có ô rỗng nào.

Kết quả quét: **mọi khoá chính là duy nhất, mọi khoá ngoại đều khớp bảng dim** (0 vi phạm trên cả 24 quan hệ), và mọi `session_id` trong `fact_promo_burn` đều tồn tại trong `fact_ride`/`fact_food` (0 dòng mồ côi).

| Bảng | Số dòng | Số cột | Khoá chính | TEXT / INTEGER / REAL / boolean | Cột cho phép NULL |
|---|---:|---:|---|---|---:|
| `dim_region` | 1 | 3 | region_id | 3 / 0 / 0 / 0 | 0 |
| `dim_hex` | 18 | 7 | hex_id | 4 / 1 / 2 / 0 | 0 |
| `dim_promo` | 12 | 12 | promo_code | 8 / 2 / 1 / 1 | 0 |
| `dim_promo_cap_history` | 15 | 7 | cap_version_id | 4 / 2 / 1 / 0 | 0 |
| `dim_date` | 92 | 13 | date_key | 5 / 6 / 0 / 2 | 1 |
| `dim_merchant` | 400 | 7 | merchant_id | 5 / 1 / 1 / 0 | 0 |
| `dim_user` | 3.500 | 7 | user_id | 7 / 0 / 0 / 0 | 0 |
| `fact_promo_budget` | 324 | 6 | month_start, service, hex_id, segment | 5 / 1 / 0 / 0 | 0 |
| `fact_ride` | 41.783 | 50 | session_id | 21 / 15 / 9 / 5 | 16 |
| `fact_food` | 64.968 | 55 | session_id | 21 / 19 / 9 / 6 | 17 |
| `fact_promo_burn` | 26.040 | 21 | burn_event_id | 11 / 7 / 1 / 2 | 0 |

Thứ tự tạo/nạp: dim trước, fact sau (khoá ngoại). `fact_promo_burn.session_id` **không** đặt FK (trỏ tới hai bảng khác nhau tuỳ `service`).

```sql
CREATE TABLE dim_region (
  region_id TEXT PRIMARY KEY,
  region_name TEXT NOT NULL,
  tier TEXT NOT NULL
) WITHOUT ROWID;

CREATE TABLE dim_hex (
  hex_id TEXT PRIMARY KEY,
  region_id TEXT NOT NULL,
  nearest_district TEXT NOT NULL,
  center_lat REAL NOT NULL,
  center_lng REAL NOT NULL,
  hex_tier TEXT NOT NULL,
  h3_resolution INTEGER NOT NULL,
  FOREIGN KEY (region_id) REFERENCES dim_region(region_id)
) WITHOUT ROWID;

CREATE TABLE dim_promo (
  promo_code TEXT PRIMARY KEY,
  promo_name TEXT NOT NULL,
  service TEXT NOT NULL,
  vehicle_scope TEXT NOT NULL,
  discount_type TEXT NOT NULL,
  discount_target TEXT NOT NULL,
  discount_value REAL NOT NULL,
  max_discount INTEGER NOT NULL,
  min_order_value INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  has_cap_change INTEGER NOT NULL CHECK (has_cap_change IN (0, 1))
) WITHOUT ROWID;

CREATE TABLE dim_promo_cap_history (
  promo_code TEXT NOT NULL,
  cap_version_id TEXT PRIMARY KEY,
  effective_from TEXT NOT NULL,
  effective_to TEXT NOT NULL,
  discount_rate_or_value REAL NOT NULL,
  max_discount INTEGER NOT NULL,
  min_order_value INTEGER NOT NULL,
  FOREIGN KEY (promo_code) REFERENCES dim_promo(promo_code)
) WITHOUT ROWID;

CREATE TABLE dim_date (
  date_key INTEGER PRIMARY KEY,
  date TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  month_name TEXT NOT NULL,
  day INTEGER NOT NULL,
  weekday_no INTEGER NOT NULL,
  weekday_name TEXT NOT NULL,
  is_weekend INTEGER NOT NULL CHECK (is_weekend IN (0, 1)),
  week_of_year INTEGER NOT NULL,
  month_start TEXT NOT NULL,
  campaign TEXT,
  is_campaign_day INTEGER NOT NULL CHECK (is_campaign_day IN (0, 1))
) WITHOUT ROWID;

CREATE TABLE dim_merchant (
  merchant_id TEXT PRIMARY KEY,
  merchant_name TEXT NOT NULL,
  cuisine TEXT NOT NULL,
  hex_id TEXT NOT NULL,
  region_id TEXT NOT NULL,
  avg_rating REAL NOT NULL,
  avg_prep_min INTEGER NOT NULL,
  FOREIGN KEY (hex_id) REFERENCES dim_hex(hex_id),
  FOREIGN KEY (region_id) REFERENCES dim_region(region_id)
) WITHOUT ROWID;

CREATE TABLE dim_user (
  user_id TEXT PRIMARY KEY,
  segment TEXT NOT NULL,
  signup_date TEXT NOT NULL,
  home_region_id TEXT NOT NULL,
  home_hex_id TEXT NOT NULL,
  age_group TEXT NOT NULL,
  promo_group TEXT NOT NULL,
  FOREIGN KEY (home_hex_id) REFERENCES dim_hex(hex_id)
) WITHOUT ROWID;

CREATE TABLE fact_promo_budget (
  month_start TEXT,
  service TEXT,
  region_id TEXT NOT NULL,
  hex_id TEXT,
  segment TEXT,
  budget_vnd INTEGER NOT NULL,
  PRIMARY KEY (month_start, service, hex_id, segment),
  FOREIGN KEY (hex_id) REFERENCES dim_hex(hex_id)
) WITHOUT ROWID;

CREATE TABLE fact_ride (
  session_id TEXT PRIMARY KEY,
  date_key INTEGER NOT NULL,
  session_start TEXT NOT NULL,
  session_hour INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  segment TEXT NOT NULL,
  promo_group TEXT NOT NULL,
  region_id TEXT NOT NULL,
  hex_id TEXT NOT NULL,
  dropoff_hex_id TEXT NOT NULL,
  service_type TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  distance_km REAL NOT NULL,
  est_duration_min INTEGER NOT NULL,
  is_peak_hour INTEGER NOT NULL CHECK (is_peak_hour IN (0, 1)),
  is_rainy INTEGER NOT NULL CHECK (is_rainy IN (0, 1)),
  is_campaign_day INTEGER NOT NULL CHECK (is_campaign_day IN (0, 1)),
  surge_multiplier REAL NOT NULL,
  gmv_before_promo INTEGER NOT NULL,
  entry_point TEXT NOT NULL,
  n_promos_eligible INTEGER NOT NULL,
  best_eligible_discount INTEGER NOT NULL,
  promo_viewed INTEGER NOT NULL CHECK (promo_viewed IN (0, 1)),
  n_promos_viewed INTEGER NOT NULL,
  promo_removed_code TEXT,
  n_clicks INTEGER NOT NULL,
  time_on_price_screen_sec INTEGER NOT NULL,
  time_on_promo_screen_sec REAL,
  session_duration_sec INTEGER NOT NULL,
  time_to_confirm_sec REAL,
  promo_code TEXT,
  cap_version_id TEXT,
  discount_target TEXT,
  discount_type TEXT,
  discount_rate REAL,
  min_order_value REAL,
  discount_before_cap INTEGER NOT NULL,
  max_discount REAL,
  discount_shown_amount INTEGER NOT NULL,
  cap_applied INTEGER NOT NULL CHECK (cap_applied IN (0, 1)),
  cap_lost_amount INTEGER NOT NULL,
  session_outcome TEXT NOT NULL,
  drop_stage TEXT,
  wait_time_min REAL,
  cancel_by TEXT,
  cancel_reason TEXT,
  burn_amount INTEGER NOT NULL,
  amount_paid INTEGER NOT NULL,
  payment_method TEXT,
  driver_rating REAL,
  FOREIGN KEY (user_id) REFERENCES dim_user(user_id),
  FOREIGN KEY (hex_id) REFERENCES dim_hex(hex_id),
  FOREIGN KEY (dropoff_hex_id) REFERENCES dim_hex(hex_id),
  FOREIGN KEY (date_key) REFERENCES dim_date(date_key),
  FOREIGN KEY (promo_code) REFERENCES dim_promo(promo_code),
  FOREIGN KEY (cap_version_id) REFERENCES dim_promo_cap_history(cap_version_id)
) WITHOUT ROWID;

CREATE TABLE fact_food (
  session_id TEXT PRIMARY KEY,
  date_key INTEGER NOT NULL,
  session_start TEXT NOT NULL,
  session_hour INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  segment TEXT NOT NULL,
  promo_group TEXT NOT NULL,
  region_id TEXT NOT NULL,
  hex_id TEXT NOT NULL,
  merchant_id TEXT NOT NULL,
  merchant_hex_id TEXT NOT NULL,
  cuisine TEXT NOT NULL,
  num_items INTEGER NOT NULL,
  distance_km REAL NOT NULL,
  is_peak_hour INTEGER NOT NULL CHECK (is_peak_hour IN (0, 1)),
  is_rainy INTEGER NOT NULL CHECK (is_rainy IN (0, 1)),
  is_campaign_day INTEGER NOT NULL CHECK (is_campaign_day IN (0, 1)),
  food_subtotal INTEGER NOT NULL,
  delivery_fee INTEGER NOT NULL,
  surge_fee INTEGER NOT NULL,
  platform_fee INTEGER NOT NULL,
  gmv_before_promo INTEGER NOT NULL,
  topped_up_to_qualify INTEGER NOT NULL CHECK (topped_up_to_qualify IN (0, 1)),
  entry_point TEXT NOT NULL,
  n_promos_eligible INTEGER NOT NULL,
  best_eligible_discount INTEGER NOT NULL,
  promo_viewed INTEGER NOT NULL CHECK (promo_viewed IN (0, 1)),
  n_promos_viewed INTEGER NOT NULL,
  promo_removed_code TEXT,
  n_clicks INTEGER NOT NULL,
  time_on_price_screen_sec INTEGER NOT NULL,
  time_on_promo_screen_sec REAL,
  session_duration_sec INTEGER NOT NULL,
  time_to_confirm_sec REAL,
  promo_code TEXT,
  cap_version_id TEXT,
  discount_target TEXT,
  discount_type TEXT,
  discount_rate REAL,
  min_order_value REAL,
  discount_before_cap INTEGER NOT NULL,
  max_discount REAL,
  discount_shown_amount INTEGER NOT NULL,
  cap_applied INTEGER NOT NULL CHECK (cap_applied IN (0, 1)),
  cap_lost_amount INTEGER NOT NULL,
  session_outcome TEXT NOT NULL,
  drop_stage TEXT,
  prep_time_min REAL,
  cancel_by TEXT,
  cancel_reason TEXT,
  burn_amount INTEGER NOT NULL,
  amount_paid INTEGER NOT NULL,
  payment_method TEXT,
  delivery_time_min REAL,
  food_rating REAL,
  FOREIGN KEY (user_id) REFERENCES dim_user(user_id),
  FOREIGN KEY (hex_id) REFERENCES dim_hex(hex_id),
  FOREIGN KEY (merchant_id) REFERENCES dim_merchant(merchant_id),
  FOREIGN KEY (merchant_hex_id) REFERENCES dim_hex(hex_id),
  FOREIGN KEY (date_key) REFERENCES dim_date(date_key),
  FOREIGN KEY (promo_code) REFERENCES dim_promo(promo_code),
  FOREIGN KEY (cap_version_id) REFERENCES dim_promo_cap_history(cap_version_id)
) WITHOUT ROWID;

CREATE TABLE fact_promo_burn (
  burn_event_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  service TEXT NOT NULL,
  event_datetime TEXT NOT NULL,
  date_key INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  segment TEXT NOT NULL,
  promo_group TEXT NOT NULL,
  promo_code TEXT NOT NULL,
  cap_version_id TEXT NOT NULL,
  region_id TEXT NOT NULL,
  hex_id TEXT NOT NULL,
  gmv_before_promo INTEGER NOT NULL,
  discount_before_cap INTEGER NOT NULL,
  max_discount REAL NOT NULL,
  cap_applied INTEGER NOT NULL CHECK (cap_applied IN (0, 1)),
  cap_lost_amount INTEGER NOT NULL,
  reserved_burn INTEGER NOT NULL,
  is_trip_completed INTEGER NOT NULL CHECK (is_trip_completed IN (0, 1)),
  realized_burn INTEGER NOT NULL,
  wasted_burn INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES dim_user(user_id),
  FOREIGN KEY (hex_id) REFERENCES dim_hex(hex_id),
  FOREIGN KEY (date_key) REFERENCES dim_date(date_key),
  FOREIGN KEY (promo_code) REFERENCES dim_promo(promo_code),
  FOREIGN KEY (cap_version_id) REFERENCES dim_promo_cap_history(cap_version_id)
) WITHOUT ROWID;
```

Ghi chú:
- `WITHOUT ROWID` cho **mọi** bảng khoá TEXT: nạp 1 dòng = 1 lượt ghi (rowid-table tốn 2). Dòng của `fact_*` khá rộng (50–55 cột) nên đây là đánh đổi chấp nhận được để giữ 137k dòng trong ngân sách ghi.
- **Không có index phụ** trên bảng `dim_*`/`fact_*`: nạp một lần, đọc ít; Power BI/Python quét cả bảng. Thêm index sau khi nạp xong nếu truy vấn chậm.
- Khoá ngoại: D1 bật `foreign_keys`. Cần nạp đúng thứ tự; vi phạm sẽ làm cả batch thất bại (có lợi: không để lại dữ liệu nửa vời).
- Đây là bản phác thảo sinh tự động từ CSV; sẽ được chuyển thành file migration ở PHASE 5 và đối chiếu lại bằng script.

## 5. Ánh xạ truy vấn `GET /api/events` (hợp đồng giữ nguyên)

| Firestore hiện tại | SQL D1 (tham số hoá, `?`) |
|---|---|
| `where session_id ==` + `orderBy step_index` | `WHERE session_id = ? ORDER BY step_index, id` (dùng `idx_events_session_step`) |
| `where user_id ==` (sắp trong JS) | `WHERE user_id = ? ORDER BY created_at, id` (dùng `idx_events_user_created_at`) — không còn lý do sắp trong bộ nhớ, và `limit` đẩy xuống DB được |
| `where flow ==` | `AND flow = ?` |
| `created_at >= from` / `<= to` | `AND created_at >= ?` / `<= ?` — tham số là chuỗi ISO µs |
| `orderBy created_at` mặc định | `ORDER BY created_at, id` |
| `limit` | `LIMIT ?` |
| `fetchSince(cursor)` (`created_at >= cursor`) | `WHERE … AND created_at >= ? ORDER BY created_at, id` |
| `countUpTo(cursor)` (`count()`) | `SELECT COUNT(*) FROM events WHERE … AND created_at <= ?` |
| `?flat=1` | giữ `flatten()` ở JS; không đổi |
| tie-break theo document ID | `id` đã nằm trong khoá sắp xếp → cùng thứ tự với `compareDocs` của `events-sync.ts` |

Dạng phản hồi giữ nguyên: `{ id, session_id, …, properties: <object>, created_at: <ISO string> }`. `properties` được `JSON.parse` lại; `created_at` trả đúng chuỗi ISO (hiện là `toDate().toISOString()` = ms; sau migration có µs — **chênh nhỏ**, xem rủi ro R4).

**`events-sync.ts` / `events-cache.ts` / `query-cache.ts` giữ nguyên logic**; chỉ `firestoreSource()` trong `event.service.ts` được viết lại thành `d1Source()`. `SyncTimestamp {seconds, nanoseconds}` giữ nguyên, thêm hai hàm đổi `ISO ↔ SyncTimestamp` (nanoseconds luôn là bội của 1000).

## 6. Realtime
Không có `onSnapshot` nào trong app → **không cần** phương án thay thế. `/history` và Power BI vẫn là GET + cache 5 phút. Không thêm polling/WebSocket.

## 7. Ghi từ app qua REST

| Thao tác | Số lệnh REST | Ghi chú |
|---|---:|---|
| `POST /api/events` | 1 (`INSERT INTO events …`, 12 tham số) | `id` sinh ở server (20 ký tự `[A-Za-z0-9]` bằng `crypto.randomInt`), `created_at` = giờ server dạng ISO µs (JS cho ms → đệm `000`); tốn 4 lượt ghi |
| `GET /api/events` | 1 (sau cache) | cache TTL 5 phút giữ nguyên |
| đăng nhập | 1 upsert `users` | best effort như cũ: lỗi D1 không chặn đăng nhập |

Bảo mật: mọi SQL **tham số hoá**; không nối chuỗi. Token Cloudflare chỉ có quyền *D1 Edit* trên đúng một account, chỉ đọc từ biến môi trường phía server; **không** tiền tố `NEXT_PUBLIC_`; mã chạm D1 nằm trong `lib/server/` có `import 'server-only'` (CLAUDE.md quy tắc 1, 2).

## 8. Ngân sách ghi (gói Free 100.000 dòng/ngày)

| Hạng mục | Dòng | Lượt ghi/dòng | Tổng |
|---|---:|---:|---:|
| `events` (9.160, 3 index) | 9.160 | 4 | 36.640 |
| 7 bảng `dim_*` | 4.038 | 1 | 4.038 |
| `fact_promo_budget` | 324 | 1 | 324 |
| `fact_ride` | 41.783 | 1 | 41.783 |
| `fact_food` | 64.968 | 1 | 64.968 |
| `fact_promo_burn` | 26.040 | 1 | 26.040 |
| **Tổng** | | | **≈ 173.800** |

→ không nạp được trong một ngày ở gói Free: cần **~2 ngày** (script nạp có `--limit` mặc định ≈ 90.000/lần chạy và tự nhớ tiến độ, như `import-powerbi.js` hiện nay), hoặc nâng gói. Ngày 1 nên nạp `events` + toàn bộ `dim_*` + `fact_promo_budget` (≈ 41.000) rồi bắt đầu `fact_*`. Cộng thêm lượng ghi sống của app trong những ngày đó (mỗi event = 4 lượt).

## 9. Rà soát rủi ro (PHASE 3)

| # | Rủi ro | Mức | Biện pháp |
|---|---|---|---|
| R1 | **Power BI không có connector D1 trực tiếp** → đọc qua API của app (đã chốt, mục 10–12). | Trung bình | Incremental refresh + endpoint `/api/analytics/<table>`; viết lại `docs/POWERBI_BIGQUERY.md` thành tài liệu Power BI-D1 ở PHASE 7. |
| R11 | Phản hồi Vercel giới hạn ~4,5 MB; `GET /api/events` hiện sát giới hạn. | Cao | Phân vùng theo ngày (incremental refresh) + `limit`/`next_cursor`. |
| R2 | REST API thêm 1 hop/độ trễ cho mỗi `POST /api/events`; chưa có số rate limit. | Trung bình | Đo ở PHASE 4; chọn region D1 gần region Vercel; `trackEvent` vốn không chặn UI (`keepalive`, nuốt lỗi). |
| R3 | Hết hạn mức ghi (100k/ngày) → D1 từ chối truy vấn, **kể cả ghi event của app**. | Trung bình | Nạp CSV chia ngày, **không chạy nạp lớn cùng lúc với demo**; script dừng khi chạm `--limit`. |
| R4 | `created_at` Firestore nano-giây → µs; giá trị trả về của API đổi từ ms sang µs (`…03.067Z` → `…03.067000Z`). | Thấp | Cursor/so sánh vẫn đúng (cố định độ rộng); ghi trong tài liệu API. Nếu UI so sánh chuỗi chính xác thì kiểm ở PHASE 8. |
| R5 | Event seed lùi ngày: cursor tăng dần của `events-sync.ts` không thấy → đã có cơ chế đối chiếu `COUNT(*)` và reconcile 24h. | Thấp | Giữ nguyên. |
| R6 | `import-powerbi.js` hiện suy `dim_date.campaign` thành số. | Thấp | Script D1 mới dùng schema cố định theo mục 4, không suy kiểu động. |
| R7 | File CSV đã đổi tên (`fact_ride.csv`, `fact_food.csv`, không còn `(1)`); `scripts/import-powerbi.js` còn trỏ tên cũ. | Thấp | Script mới dùng tên mới. |
| R8 | Dữ liệu cá nhân (`user_id` = SĐT) nằm trong D1. | Trung bình | Giới hạn quyền token; không xuất `events` ra ngoài nhóm (đã có cảnh báo ở `db-design.md`). |
| R9 | Migration không có rollback ngoài Firestore còn nguyên. | Thấp | Giữ Firestore nguyên cho tới khi verify xong (PHASE 11). |
| R10 | Kích thước batch REST chưa rõ. | Trung bình | Bắt đầu 25–50 câu lệnh/batch, đo, tăng dần. |

## 10. Quyết định bổ sung (người dùng đã trả lời)

| # | Câu hỏi | Quyết định |
|---|---|---|
| 1 | Power BI lấy dữ liệu thế nào? | **Không dùng CSV.** Đọc qua `GET /api/events?flat=1`, muốn event mới vào Power BI mà **không đọc lại toàn bộ** → xem mục 11. Thêm endpoint đọc `dim_*`/`fact_*` từ D1 (mục 12). |
| 2 | Tài khoản Cloudflare | Đã có tài khoản; D1 database **`gsm-db` đã tạo trên web**; **chưa** đăng nhập `wrangler`. |
| 3 | 3 index + `WITHOUT ROWID` | **Đồng ý.** |
| 4 | Thời gian nạp | **~2 ngày** (gói Free), không nâng gói. |

## 11. Power BI chỉ đọc bản ghi mới (không quét lại toàn bộ)

Có hai tầng tối ưu, độc lập nhau:

**Tầng DB (đã có sẵn nhờ thiết kế):** `GET /api/events?from=<ISO>` đã được ánh xạ thành `created_at >= ?` trên `idx_events_created_at`. SQLite chỉ đọc đúng các dòng khớp nên `rows_read ≈ số dòng trả về` — truy vấn "chỉ dòng mới" **không** quét cả bảng. (Khác Firestore: hạn mức đọc D1 là 5.000.000/ngày so với 50.000, nên ngay cả đọc lại toàn bộ ~10k event vài trăm lần mỗi ngày vẫn còn rất xa hạn mức.)

**Tầng Power BI — Incremental refresh:** Power BI Service (Import mode) có sẵn cơ chế *incremental refresh*: chia bảng thành các phân vùng theo ngày, lần refresh chỉ tải lại phân vùng gần nhất (vd 1–2 ngày cuối), phân vùng cũ giữ nguyên. Cách nối với API hiện có:
1. Tạo hai tham số bắt buộc `RangeStart`, `RangeEnd` (kiểu Date/Time).
2. Truy vấn Web: `Web.Contents("https://<app>/api/events", [Query=[flat="1", from=DateTime.ToText(RangeStart,"yyyy-MM-ddTHH:mm:ss"), to=DateTime.ToText(RangeEnd,"yyyy-MM-ddTHH:mm:ss")]])` — dùng tham số `Query` (không nối chuỗi vào URL) để Power BI cho phép làm mới trên Service.
3. Lọc thêm trong M `created_at >= RangeStart and created_at < RangeEnd` (Power BI yêu cầu nửa mở): API hiện tại coi `to` là **bao gồm** (`<=`), nên bước lọc M này loại dòng trùng ở biên giữa hai phân vùng.
4. Đặt chính sách: lưu 90 ngày (khớp dải dữ liệu seed), làm mới 1–2 ngày gần nhất.
*Điều kiện:* incremental refresh yêu cầu giấy phép Power BI Pro/Premium Per User/Premium cho **Service**; ở Desktop miễn phí thì chỉ làm mới toàn bộ (vẫn rẻ nhờ D1 + cache 5 phút).

**Giới hạn kích thước phản hồi:** hàm serverless của Vercel giới hạn thân phản hồi ~4,5 MB. `events` hiện ~9.160 dòng ≈ 3,5–4 MB ở dạng `flat=1` → **đã sát giới hạn** và sẽ vượt khi dữ liệu tăng. Phân vùng theo ngày của incremental refresh (mỗi request chỉ một khoảng ngày) giải quyết luôn vấn đề này; thêm vào đó endpoint nên hỗ trợ `limit` + con trỏ phân trang (mục 12) cho ai không dùng incremental refresh.

## 12. Endpoint đọc `dim_*`/`fact_*`

11 file CSV = **11 bảng** trong D1 (đúng như mục 4). Chỉ cần **một** route động chứ không phải 11 route:

`GET /api/analytics/<table>` — `<table>` thuộc danh sách trắng cố định 11 tên (`dim_region`, `dim_hex`, `dim_promo`, `dim_promo_cap_history`, `dim_date`, `dim_merchant`, `dim_user`, `fact_promo_budget`, `fact_ride`, `fact_food`, `fact_promo_burn`); tên khác → 404. Tên bảng **không bao giờ** đi từ request thẳng vào SQL; tra từ bảng trắng.

| Tham số | Ý nghĩa |
|---|---|
| `limit` | mặc định 5.000, tối đa 10.000 (giữ phản hồi < 4,5 MB) |
| `after` | con trỏ phân trang theo khoá chính (keyset, `WHERE pk > ? ORDER BY pk`) — không dùng OFFSET để rẻ ở bảng 65k dòng |
| `from`, `to` | chỉ cho bảng có cột thời gian (`fact_ride`/`fact_food` theo `session_start`, `fact_promo_burn` theo `event_datetime`) → incremental refresh được |
| phản hồi | `{ rows: [...], next_cursor: "..." \| null }`, kiểu cột đúng schema (boolean trả `true/false`, không phải 0/1) |

Bảng dim nhỏ (≤ 3.500 dòng) lấy một lượt; `fact_*` lấy theo ngày hoặc phân trang. Dữ liệu CSV là mô phỏng **tĩnh**, nên chỉ cần Import một lần (không cần incremental refresh cho các bảng này).

**Bảo mật:** hai route đọc dữ liệu phân tích. `GET /api/events` hiện **mở** và chứa SĐT thật. Đề xuất: endpoint mới yêu cầu header `Authorization: Bearer <ANALYTICS_TOKEN>` (biến môi trường phía server; Power BI Web connector gửi được header) — và áp **cùng cơ chế** (tuỳ chọn, bật khi biến có giá trị) cho `GET /api/events` nếu bạn muốn khoá luôn dữ liệu có SĐT. *Cần bạn quyết ở PHASE 7.*

## 13. Tiến độ và bước tiếp theo

- ✅ PHASE 2–3: tài liệu này.
- ✅ PHASE 4: `wrangler.jsonc` (chỉ cho `wrangler d1 migrations`; binding `DB` → `gsm-db`, id `30743910-…`). Token REST đã kiểm: gọi được `/query`; D1 phục vụ từ vùng **APAC**.
- ✅ PHASE 5: `migrations/0001_initial_schema.sql` + `0002_analytics_schema.sql` — áp `--local` rồi `--remote` thành công; 16 bảng/index đúng thiết kế.
- ✅ Kiểm tra vòng REST trên D1 thật: batch `INSERT` + `SELECT json_extract` + `DELETE` chạy được; **một event = 4 `rows_written`** (đúng dự tính 1 dòng + 3 index); đã xoá dòng thử, `events` = 0 dòng.
- ✅ PHASE 6: `scripts/migrate-firebase-to-d1.js` (idempotent, batch REST, `--dry-run/--only/--limit/--since/--all-rows/--verify[--full|--deep]`). **Quyết định 02/10:** dữ liệu mock chỉ nạp **tập con** (`scripts/lib/mock-subset.js`): 9 bảng nhỏ + `fact_ride` đủ, `fact_food` 7.232, `fact_promo_burn` 3.000 (không mồ côi). `events` 9.160, `users` 2 chép từ Firestore.
- ✅ PHASE 7: code app chuyển sang D1 (`lib/server/db/d1.ts`, `event.service.ts`, `user.service.ts`, `GET /api/analytics/<table>`, `ANALYTICS_TOKEN`, `seed-events.js`, `fetch_events.py`); hướng dẫn Power BI: `docs/POWERBI_D1.md`.
- ✅ PHASE 8: kiểm thử database (29/29), API, trình duyệt thật (ride 22/22, food 16/16), trạng thái lỗi, đồng thời/độ trễ, đối chiếu từng trường 9.160 event — `docs/migration-verification.md`. Phát hiện **lỗi có sẵn** (finding-driver → `/ride/address`) — **đã sửa** (mục 7 của migration-verification).
- ✅ PHASE 9: `--verify --deep` (test âm đã kiểm); **11/11 bảng CSV đối chiếu sâu ✅**, 0 dòng mồ côi.
- 🟡 PHASE 10: công cụ + quy trình sẵn sàng, `cutover-check.js` báo SẴN SÀNG; **chờ bạn deploy Vercel** rồi tôi chạy `smoke-production.js` + delta `--since` — `docs/cutover-runbook.md`.
- 🟡 PHASE 11: **11a xong** (gỡ code Firebase/BigQuery khỏi app, viết lại tài liệu, `firebase-admin` → devDependency); **11b** (xoá hẳn Firebase) sau khi production ổn định — danh sách ở `docs/cutover-runbook.md` mục 6.
