# BIGQUERY_SETUP.md — pipeline phân tích BigQuery

## 1. BigQuery dùng để làm gì?

Firestore là nơi lưu event **chính** của app và **không đổi**. BigQuery là nơi phân tích: Power BI đọc BigQuery thay vì gọi `GET /api/events` (không tốn read Firestore, không mất cache khi cold start, truy vấn SQL được).

```
Client → lib/track.ts → POST /api/events → Firestore `events`
                                              │  (sync tăng dần mỗi 15 phút)
                                              ▼
                        scripts/bigquery/sync-events.js
                              staging ── MERGE ──▶ gsm_analytics.fact_events
                                                        │
                                                        ▼
                                              vw_events_powerbi → Power BI
```

Độ trễ là **near-real-time** (tối đa ~15–20 phút), không phải real-time.

**Tự động bởi code:** đọc Firestore theo checkpoint, biến đổi, load staging, MERGE chống trùng, ghi checkpoint, tạo bảng/view (`--init`), chạy định kỳ (GitHub Actions).
**Bạn phải làm thủ công trên Google Cloud Console:** mục 2–5 và 7 bên dưới.

## 2. Chuẩn bị

- Một Google Cloud project — dùng **chính project của Firebase** cho đơn giản (Firebase project luôn là một GCP project). Project ID xem ở Firebase console → Project settings.
- **Bật billing** cho project. BigQuery *sandbox* (không billing) không cho DML/`MERGE` ổn định và tự xoá bảng sau 60 ngày. Với dữ liệu cỡ này vẫn nằm trong free tier (10 GB lưu trữ + 1 TB truy vấn/tháng); nên đặt cảnh báo ngân sách.
- Quyền Owner hoặc (`BigQuery Admin` + `Service Account Admin`) để làm các bước dưới.

## 3. Bật API và tạo dataset

1. Console → *APIs & Services* → *Library* → bật **BigQuery API**.
2. Console → *BigQuery* → dấu ⋮ cạnh project → *Create dataset*:
   - Dataset ID: `gsm_analytics`
   - Location: khuyến nghị `asia-southeast1` (Singapore). **Không đổi được sau khi tạo**, và phải khớp `BIGQUERY_LOCATION`.
3. (Không bắt buộc) bỏ qua bước 2 nếu bạn cấp thêm quyền tạo dataset cho service account — `--init` sẽ thử tự tạo.

## 4. Service account riêng + IAM

1. Console → *IAM & Admin* → *Service Accounts* → *Create*: tên `gsm-bigquery-sync`.
2. Cấp **tối thiểu** hai role:
   | Role | Ở đâu | Để làm gì |
   |---|---|---|
   | `BigQuery Job User` | project | chạy load job và truy vấn `MERGE` |
   | `BigQuery Data Editor` | **chỉ dataset `gsm_analytics`** (BigQuery → dataset → *Sharing* → *Permissions* → *Add principal*) | tạo/xoá bảng staging, ghi `fact_events` |
   Không cấp Owner/Editor/Admin. Nếu muốn Power BI đọc bằng cùng account thì cấp thêm `BigQuery Data Viewer` cho dataset — tốt hơn là tạo account chỉ-đọc riêng cho Power BI.
3. Tab *Keys* → *Add key* → *Create new key* → JSON. **Không** commit file này (`.gitignore` đã chặn `serviceAccount*.json`, `bigquery*.json`, `*-key.json`); cất ở nơi an toàn hoặc xoá sau khi dán vào `.env.local`.

> Script vẫn **đọc Firestore bằng key Firebase hiện có** (`FIREBASE_*`) — không cần thêm quyền Firestore cho service account BigQuery. Script ghi checkpoint vào Firestore doc `system/bigquery_events_sync` bằng chính key Firebase đó.

## 5. Biến môi trường

Thêm vào `.env.local` (mẫu ở `.env.example`):

| Biến | Bắt buộc | Giá trị |
|---|---|---|
| `BIGQUERY_PROJECT_ID` | có | Project ID GCP |
| `BIGQUERY_CLIENT_EMAIL` | có | `client_email` trong key JSON |
| `BIGQUERY_PRIVATE_KEY` | có | `private_key` trong key JSON — **bọc nháy kép**, giữ `\n` literal |
| `BIGQUERY_DATASET` | không | mặc định `gsm_analytics` |
| `BIGQUERY_EVENTS_TABLE` | không | mặc định `fact_events` |
| `BIGQUERY_LOCATION` | không | mặc định `asia-southeast1` |

Không thêm tiền tố `NEXT_PUBLIC_` (nhúng vào bundle trình duyệt).

## 6. Bảng và view

Tạo bằng `npm run bigquery:init` (chạy lại an toàn — chỉ `IF NOT EXISTS` / `CREATE OR REPLACE VIEW`, không DROP). SQL nằm ở `scripts/bigquery/*.sql`.

`gsm_analytics.fact_events` — partition theo `DATE(created_at)`, cluster theo `flow, event_name, session_id`:

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `event_id` | STRING | **Firestore document ID** — khoá chống trùng |
| `session_id`, `user_id` | STRING | `user_id` là SĐT E.164 → **dữ liệu cá nhân** |
| `flow` | STRING | `ride` \| `food` \| `none` |
| `event_name`, `screen_name`, `previous_screen` | STRING | `previous_screen` NULL ở màn đầu |
| `step_index` | INT64 | |
| `properties` | JSON | giữ nguyên object, không flatten |
| `platform` | STRING | `web` |
| `created_at` | TIMESTAMP | Firestore server timestamp; **NULL** nếu document thiếu (không bị thay bằng giờ hiện tại) |
| `seed_batch` | STRING | **Cột thêm so với đề bài**: code thật có field này ở event do `seed-events.js` sinh. NULL = người thật click. Power BI lọc `seed_batch IS NULL` để chỉ lấy dữ liệu thật |
| `synced_at` | TIMESTAMP | lần MERGE gần nhất |

`vw_events_powerbi` phẳng hoá các khoá `properties` **có thật** trong `event-taxonomy.md` (`vehicle_type`, `payment_method`, `final_price`, `final_total`, …) và thêm `created_date_vn`, `is_seed`.

## 7. Chạy sync

```bash
npm run bigquery:init            # tạo dataset (nếu được) + bảng + view
npm run sync:bigquery:backfill   # LẦN ĐẦU: nạp toàn bộ event đang có (idempotent)
npm run sync:bigquery            # tăng dần từ checkpoint
node scripts/bigquery/sync-events.js --dry-run --limit 100   # thử: chỉ đọc Firestore, không cần BigQuery
```

Đầu ra mẫu:
```
Fetched: 100   Inserted: 95   Updated: 5   Skipped: 0   Failed: 0   created_at NULL: 0
Checkpoint: 2026-09-30T15:42:52.879Z
Đối chiếu: Firestore=9120  BigQuery=9120
```

**Cơ chế:** đọc `created_at >= checkpoint − 10 phút`, phân trang theo `(created_at, document ID)`, mỗi 1.000 event → load vào bảng staging tạm → `MERGE` theo `event_id` → xoá staging → **mới** ghi checkpoint. Chạy lại/retry/crash giữa chừng không tạo trùng; 10 phút gối đầu bắt event commit trễ và event cùng timestamp.

**Checkpoint** nằm ở Firestore `system/bigquery_events_sync` (bền vững, chạy được trên GitHub Actions; file local sẽ mất mỗi lần chạy).

### Tự động hoá — GitHub Actions

`.github/workflows/sync-bigquery.yml` chạy mỗi 15 phút (và có nút *Run workflow* thủ công, tuỳ chọn backfill). Vercel không dùng được: `.vercelignore` loại `scripts/`, và Vercel Cron gói free chỉ 1 lần/ngày.

Repo → *Settings* → *Secrets and variables* → *Actions*:
- **Secrets:** `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `BIGQUERY_PROJECT_ID`, `BIGQUERY_CLIENT_EMAIL`, `BIGQUERY_PRIVATE_KEY` (dán nguyên giá trị như trong `.env.local`, kể cả `\n` literal).
- **Variables** (tuỳ chọn): `BIGQUERY_DATASET`, `BIGQUERY_EVENTS_TABLE`, `BIGQUERY_LOCATION`.

## 8. Kiểm tra

```sql
SELECT * FROM `PROJECT.gsm_analytics.fact_events` ORDER BY created_at DESC LIMIT 20;

SELECT COUNT(*) AS total_events, COUNT(DISTINCT event_id) AS unique_events
FROM `PROJECT.gsm_analytics.fact_events`;   -- hai số phải bằng nhau
```
Chạy sync hai lần liên tiếp: `Inserted: 0` ở lần hai (chỉ `Updated` cho phần gối đầu).

## 9. Xử lý sự cố

| Triệu chứng | Nguyên nhân / cách xử |
|---|---|
| `Access Denied` / 403 | thiếu `BigQuery Job User` (project) hoặc `BigQuery Data Editor` (dataset) |
| `Not found: Dataset` | chưa tạo dataset, hoặc `BIGQUERY_LOCATION` khác location dataset |
| `DECODER routines::unsupported` / `invalid_grant` | `BIGQUERY_PRIVATE_KEY` sai: thiếu nháy kép hoặc mất `\n` |
| `Đối chiếu … Lệch` | event seed ghi lùi ngày → `--backfill`; hoặc document đã xoá ở Firestore |
| Actions không chạy nữa | GitHub tắt schedule sau 60 ngày repo không hoạt động — bật lại trong tab *Actions* |
| `Skipped` > 0 | document thiếu field bắt buộc; id in ra ở log |

## 10. Giới hạn đã biết

- **Xoá ở Firestore không lan sang BigQuery** (`seed --clear` để lại dòng cũ). Dọn bằng `DELETE FROM … WHERE seed_batch = '…'` hoặc lọc `seed_batch IS NULL`.
- **Event seed ghi lùi ngày** không được cursor thấy → chạy `--backfill` sau mỗi lần seed.
- `--backfill` đọc toàn bộ `events` = 1 read Firestore / document (Spark: 50.000/ngày).
- GitHub cron là best-effort, có thể trễ vài phút.
- Sửa document tay trên Firebase console mà không đổi `created_at` chỉ được đồng bộ khi nằm trong cửa sổ gối đầu hoặc khi `--backfill`.

## 11. Bảo mật

- Key service account **không** vào Git; GitHub Secrets chỉ cho người có quyền repo. Xoay key định kỳ (IAM → Keys).
- `user_id` là số điện thoại thật: hạn chế quyền xem dataset; nếu chia sẻ ngoài nhóm, tạo view băm `user_id` (`TO_HEX(SHA256(user_id))`) và chỉ cấp quyền view đó.
- Script không log key/token; chỉ log id event bị bỏ qua.
