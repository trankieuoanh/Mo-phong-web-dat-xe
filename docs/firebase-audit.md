# firebase-audit.md — Audit Firebase trước khi migrate sang Cloudflare D1

> **TÀI LIỆU LỊCH SỬ (PHASE 1, trước khi migrate).** Mô tả hệ thống **trước** khi chuyển sang D1; code hiện tại không còn Firestore (xem `db-design.md`). Giữ lại để hiểu vì sao thiết kế D1 như vậy.
>
> **PHASE 1 — chỉ audit.** Tài liệu này mô tả hiện trạng. Chưa có thay đổi code, chưa tạo D1, chưa động tới Firebase.
> Số liệu đếm lấy bằng `count()` chỉ-đọc trên project Firebase đang dùng; thời điểm: 2026-10-01.

## 1. Kiến trúc Firebase hiện tại

```
Trình duyệt ──fetch──▶ /api/*  (Next.js Route Handler, deploy Vercel)
                          │
                          ▼
                lib/server/db/firebase-admin.ts   ← credential, getDb()
                          │   (firebase-admin, Admin SDK, server-side)
                          ▼
                    Firestore (1 database, project Spark)

Ngoài app (chạy tay / Actions):
  scripts/seed-events.js ─────────────▶ Firestore  (events)
  scripts/import-powerbi.js ──────────▶ Firestore  (pbi_*)
  scripts/bigquery/sync-events.js ◀──── Firestore  (events) ──▶ BigQuery
  analysis/fetch_events.py ◀─────────── Firestore  (events) ──▶ output/events.csv
```

- **Một** package Next.js, **không** có `apps/api`, không có server thứ hai.
- Trình duyệt **không bao giờ** nói chuyện trực tiếp với Firestore — mọi truy cập đi qua `/api/*`. Hàng rào `import 'server-only'` giữ credential ở phía server (CLAUDE.md quy tắc 1).
- Hosting: **Vercel** (`setup.md` mục Deploy). Không có `wrangler.*`, `open-next.*`, `.dev.vars`, hay dependency Cloudflare nào trong repo.

## 2. Firebase services đang dùng

| Service | Dùng? | Ghi chú |
|---|---|---|
| **Firestore** (Admin SDK) | **CÓ — duy nhất** | `firebase-admin ^13.0.2`, `getFirestore()` |
| Realtime Database | không | |
| Firebase Authentication | **không** | Đăng nhập = SĐT + mã 6 số + cookie HMAC tự viết (`auth-token.ts`, `otp.service.ts`, `AUTH_SECRET`). Không phụ thuộc DB. |
| Cloud Storage | không | |
| Cloud Functions | không | |
| Hosting | không | deploy bằng Vercel |
| Firebase client SDK (`firebase`) | **không** | không có trong `package.json` |
| Security rules / indexes file | **không có trong repo** | không `firestore.rules`, `firestore.indexes.json`, `firebase.json`. Admin SDK bỏ qua rules; composite index (nếu có) tạo tay trên console. |

## 3. Collections / cấu trúc dữ liệu

| Collection | Số document | Nguồn ghi | Ghi chú |
|---|---:|---|---|
| `events` | **9.160** (7.771 có `seed_batch`) | `POST /api/events`, `seed-events.js` | collection chính |
| `users` | 2 | `recordLogin()` khi đăng nhập | doc id = SĐT E.164 |
| `pbi_dim_region` / `_hex` / `_promo` / `_promo_cap_history` / `_date` / `_merchant` / `_user` | 1 / 18 / 12 / 15 / 92 / 400 / 3.500 | `import-powerbi.js` | dữ liệu CSV Power BI, doc id = khoá tự nhiên |
| `pbi_fact_promo_budget` | 324 | `import-powerbi.js` | đủ |
| `pbi_fact_promo_burn` | 15.771 / 26.040 | `import-powerbi.js` | **nạp dở** (hết quota Spark) |
| `pbi_fact_ride`, `pbi_fact_food` | 0 / 0 (41.783 / 64.968 dự kiến) | `import-powerbi.js` | **chưa nạp** |
| `otp_codes` | 2 | — | **MỒ CÔI**: không còn dòng code nào đọc/ghi (OTP hiện nằm trong cookie ký HMAC). Tàn dư bản cũ. |
| `system/bigquery_events_sync` | không tồn tại | `sync-events.js` | checkpoint; sync BigQuery chưa chạy lần nào |

### `events` — hình dạng document

```
id (Firestore auto-id, 20 ký tự)   ← dùng làm event_id
session_id       string
user_id          string            SĐT E.164 | anon-<uuid> | mock-user-* (event cũ)
flow             "ride" | "food" | "none"
event_name       string            26 giá trị (lib/shared/types.ts)
screen_name      string            14 giá trị
previous_screen  string | null
step_index       number (int)
properties       map               lồng nhau, khoá khác nhau theo từng event_name (event-taxonomy.md)
platform         "web"             server gán
created_at       Timestamp         serverTimestamp(); độ phân giải nano-giây
seed_batch       string            CHỈ có ở document do seed-events.js sinh
```

### `users/{phone}`
`phone` (string), `created_at` (Timestamp, lần đăng nhập đầu), `last_login_at` (Timestamp).

### `pbi_*`
Mỗi dòng CSV → 1 document, tên field = tên cột; thêm `import_batch`. Kiểu: number / boolean / string; `session_start`, `event_datetime` là `Timestamp` (giờ VN); các cột ngày khác là chuỗi `YYYY-MM-DD`.

## 4. Thao tác Firestore — toàn bộ vị trí

### 4.1 Trong app (đường nóng)

| File | Thao tác | Loại |
|---|---|---|
| `lib/server/db/firebase-admin.ts` | `cert()`, `initializeApp()` (qua `getApps()[0] ??`), `getFirestore()`; export `EVENTS_COLLECTION='events'`, `USERS_COLLECTION='users'`, `getDb()` | khởi tạo |
| `lib/server/services/event.service.ts` `createEvent` | `collection('events').add({...payload, platform:'web', created_at: FieldValue.serverTimestamp()})` | **WRITE** |
| `event.service.ts` `baseQuery` | `where('session_id','==')`, `where('user_id','==')`, `where('flow','==')`, `where('created_at','>=')`, `where('created_at','<=')` | **READ** |
| `event.service.ts` `fetchEvents` | `orderBy('step_index')` (khi lọc session) hoặc `orderBy('created_at')`; `limit(n)`; khi lọc `user_id` thì **sắp trong bộ nhớ** để tránh composite index | READ |
| `event.service.ts` `firestoreSource` | `fetchSince(cursor)` = `created_at >= cursor`; `countUpTo(cursor)` = `count()` aggregation `created_at <= cursor` | READ |
| `lib/server/services/user.service.ts` `recordLogin` | `doc(phone).create({phone, created_at: serverTimestamp()})` (nuốt lỗi nếu đã có) rồi `set({phone, last_login_at: serverTimestamp()}, {merge:true})` | **WRITE** (upsert), best effort |
| `app/api/events/route.ts` | gọi `createEvent` (POST), `listEvents` (GET) | gateway |
| `app/api/auth/verify/route.ts` | gọi `recordLogin(...).catch(...)` | gateway |
| `events-sync.ts`, `events-cache.ts`, `query-cache.ts` | **Không** import Firestore: nhận `EventsSource` được tiêm từ `event.service.ts`. Logic: cache TTL 5 phút, sync tăng dần theo cursor `created_at` (so sánh nano-giây, `>=` + gộp theo id), đối chiếu `count()`, đối chiếu toàn bộ mỗi 24 giờ | logic thuần |
| `app/api/health/route.ts` | đọc bộ đếm cache, **không** chạm Firestore | — |

**Không có:** update/delete trong app (API không có endpoint sửa/xoá event), không transaction, không listener, không subcollection.

### 4.2 Ngoài app

| File | Thao tác Firestore |
|---|---|
| `scripts/seed-events.js` | `db.batch()` 500 op `batch.set(collection.doc(), doc)` với `created_at` **lùi quá khứ** (`Timestamp.fromDate`); `--clear`: `orderBy('seed_batch')` / `where('seed_batch','==',id)` + `batch.delete` |
| `scripts/import-powerbi.js` | `db.bulkWriter()` `set(collection.doc(id), …)` → 11 collection `pbi_*`; `--clear`: `orderBy('import_batch').limit(400)` + batch delete; tiến độ ở `scripts/.import-powerbi-state.json` |
| `scripts/bigquery/sync-events.js` | đọc `events` phân trang `(created_at, __name__)` `startAfter`; `count()`; đọc/ghi checkpoint `system/bigquery_events_sync` |
| `.github/workflows/sync-bigquery.yml` | chạy script trên, truyền `FIREBASE_*` qua GitHub Secrets |
| `analysis/fetch_events.py` | `firebase_admin` Python, `collection('events').stream()` → `output/events.csv` |

## 5. Hợp đồng truy vấn mà D1 phải tái hiện (`GET /api/events`)

| Tham số | Ngữ nghĩa Firestore hiện tại |
|---|---|
| `session_id` | `==`, sắp theo `step_index` |
| `user_id` | `==`, sắp **trong JS** theo `created_at` (không `limit` ở DB) |
| `flow` | `==` (`ride`\|`food`) — kết hợp khoảng `created_at` cần composite index `(flow, created_at)` |
| `from` / `to` | `created_at >=` / `<=` |
| `limit` | đẩy xuống DB (mỗi doc đọc = 1 lượt đọc) trừ nhánh `user_id` |
| `flat=1` | **không** ở DB — `flatten()` trải `properties` thành cột `prop_*` sau khi đọc |
| (không tham số lọc) | sync tăng dần + cache; trả toàn bộ, sắp `created_at` |

Phản hồi: mảng object `{ id, ...fields, created_at: <ISO string> }` (`properties` giữ nguyên dạng map).

## 6. Realtime / Auth / Storage / API / Frontend dependency

- **Realtime:** `onSnapshot`/`onValue` = **0**. Không có phần nào cần realtime. `/history` và Power BI dùng GET thường (cache 5 phút).
- **Authentication:** không phụ thuộc Firebase Auth. Chỉ có ghi sổ `users/{phone}` best-effort (đăng nhập vẫn chạy khi Firestore lỗi — chủ ý, `user.service.ts`).
- **Storage:** không dùng.
- **API:** chỉ `POST/GET /api/events` và `POST /api/auth/verify` chạm Firestore. Các route khác (`places`, `reverse`, `restaurants`, `route`, `tiles`, `health`, `auth/send-code|me|logout`) **không**.
- **Frontend:** không import Firestore/Firebase. Chỉ **phụ thuộc gián tiếp**: `app/history/page.tsx` đọc `GET /api/events?user_id=` và có hai chuỗi UI nhắc "credential Firebase"/"link tạo index của Firestore" (nội dung chữ, không phải logic).

## 7. Biến môi trường

| Biến | Phân loại sau migration |
|---|---|
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | **CHỈ-FIRESTORE** → bỏ được **sau khi** verify xong (đang còn dùng bởi `seed-events.js`, `import-powerbi.js`, `sync-events.js`, `fetch_events.py`, GitHub Actions) |
| `AUTH_SECRET`, `SMS_PROVIDER`, `SMS_MOCK_EXPOSE_CODE` | không liên quan DB — **giữ** |
| `NOMINATIM_CONTACT` | không liên quan — giữ |
| `BIGQUERY_*` | thuộc pipeline BigQuery — số phận phụ thuộc quyết định ở mục 10 |
| `GOOGLE_APPLICATION_CREDENTIALS`, `analysis/.env` | chỉ cho `fetch_events.py` |
| (cần thêm sau này) | thông tin Cloudflare: account id, database id, API token — chỉ khi gọi D1 qua REST |

## 8. Logic đặc thù Firebase (không có tương đương trực tiếp)

| Firestore | Hành vi hiện tại | Hệ quả khi sang D1 |
|---|---|---|
| `serverTimestamp()` | giờ server Firestore lúc commit, nano-giây | phải tự gán giờ ở tầng ghi (JS `Date` = mili-giây, hoặc µs) và quyết kiểu lưu (TEXT ISO / INTEGER); cursor nano-giây của `events-sync.ts` cần giữ độ phân giải |
| `.add()` auto-id | id 20 ký tự ngẫu nhiên | tự sinh id; **giữ nguyên id cũ** khi migrate (id = `event_id` trong BigQuery) |
| `count()` aggregation | ~1 lượt đọc/1.000 doc | `SELECT COUNT(*)` |
| `orderBy('seed_batch')` chỉ trả doc **có** field | cách xoá seed không thể xoá nhầm event thật | `WHERE seed_batch IS NOT NULL` |
| `properties` map lồng | lưu nguyên cấu trúc | cột TEXT JSON (`json_extract` khi cần) |
| Index tự động theo từng field | `where` đơn không cần khai báo | D1 **phải khai báo index** thủ công |
| Composite index | tránh bằng cách sắp trong bộ nhớ (nhánh `user_id`) | không còn ràng buộc này, nhưng cần index `(user_id, created_at)` để rẻ |
| `merge:true`, `create()` | upsert / tạo-nếu-chưa-có | `INSERT … ON CONFLICT DO UPDATE` |
| BulkWriter / batch 500 | script nạp | D1 có giới hạn câu lệnh/tham số mỗi request — batch nhỏ hơn |

## 9. Rủi ro migration

1. **Hosting không khớp (nghiêm trọng).** D1 chỉ có *binding* bên trong **Cloudflare Workers**. App đang chạy trên **Vercel** → chỉ gọi được D1 qua **REST API của Cloudflare** (API token, `fetch`; độ trễ cao hơn một hop, giới hạn tốc độ theo token). Phương án khác là chuyển deploy sang Cloudflare (adapter OpenNext: thêm dependency, đổi build) — mâu thuẫn "không rewrite" và CLAUDE.md quy tắc 8.
2. **Pipeline BigQuery** (vừa viết) lấy nguồn từ Firestore → phải đổi nguồn sang D1 hoặc bỏ nếu D1 trở thành nguồn Power BI.
3. **Script ngoài app** (`seed-events.js`, `import-powerbi.js`, `sync-events.js`, `fetch_events.py`) dùng `firebase-admin` → không dùng được binding D1; phải qua REST hoặc `wrangler d1 execute`.
4. **Độ chính xác timestamp.** Cursor `events-sync.ts` + `OVERLAP` của `sync-events.js` dựa trên Timestamp nano-giây; đổi kiểu có thể làm mất/lặp event ở biên.
5. **Event seed lùi ngày** (`created_at` quá khứ) — cursor tăng dần không thấy; vẫn cần `--backfill`/đối chiếu `count`.
6. **Quota.** Spark: 20k ghi/50k đọc mỗi ngày (đang là nút thắt của việc nạp `pbi_*`). D1 free có hạn mức khác (số liệu hiện hành sẽ kiểm tra lại ở PHASE 2); REST API thêm giới hạn kích thước/tham số mỗi câu lệnh.
7. **Dữ liệu dở dang:** `pbi_*` đang nạp dở; nên quyết có migrate phần đã nạp hay nạp thẳng vào D1 từ CSV gốc (`powerBI/*.csv`).
8. **Không có rules/index trong repo** → không thể suy index đã tạo trên console từ code; sẽ lấy từ yêu cầu truy vấn ở mục 5.
9. **Dữ liệu cá nhân:** `events.user_id` chứa SĐT thật (cũ: `mock-user-*`); cần cân nhắc khi chuyển/lưu sang hệ thống mới.

## 10. Những phần KHÔNG cần migrate

- Toàn bộ `app/` UI, `components/`, `lib/track.ts`, `lib/session.ts`, `lib/app-context.tsx` — không biết gì về DB.
- Validators (`lib/server/validators/*`), `lib/shared/*`, hợp đồng `EventPayload`.
- Đăng nhập: cookie HMAC + OTP trong cookie — không phụ thuộc DB (chỉ `recordLogin` là ghi sổ phụ).
- Các route không chạm DB: `places`, `reverse`, `restaurants`, `route`, `tiles`, `health`.
- `analysis/metrics.py` (đọc CSV, không gọi Firestore).
- Collection **`otp_codes`** (mồ côi) — đề xuất **không** migrate, xoá riêng khi dọn.
- Collection `users` (2 dòng) — migrate được nhưng giá trị thấp.

## 11. Câu hỏi cần người dùng quyết trước PHASE 2

1. **Hosting/đường truy cập D1:** giữ Vercel + gọi D1 qua REST API, hay chuyển app sang Cloudflare Workers (OpenNext)?
2. **BigQuery:** giữ pipeline (đổi nguồn sang D1) hay bỏ, coi D1 là nguồn của Power BI?
3. **`pbi_*`:** nạp thẳng từ CSV vào D1 (bỏ phần đã nạp dở ở Firestore) hay migrate từ Firestore?
4. **Script ngoài app + `fetch_events.py`:** đồng ý chuyển sang gọi D1 qua REST không?
