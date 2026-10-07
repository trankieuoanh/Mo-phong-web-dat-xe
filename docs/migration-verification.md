# migration-verification.md — Kiểm chứng migration Firebase → Cloudflare D1

> Cập nhật: 2026-10-02 (PHASE 8–9 xong; dữ liệu mock nạp theo **tập con** do chủ dự án quyết định). Kết quả lấy từ `node scripts/migrate-firebase-to-d1.js --verify [--full]`,
> `node scripts/test-d1.js`, các kịch bản trình duyệt `scripts/e2e/*` và phép thử trực tiếp trên D1 thật (`gsm-db`). Mục 8 ghi rõ phần còn lại.

## 1. Đối chiếu số lượng (nguồn → D1)

| Bảng | Nguồn | Nguồn | D1 | Kết quả |
|---|---|---:|---:|---|
| `events` | Firestore | 9.160 | 9.160 | ✅ |
| `users` | Firestore | 2 | 2 | ✅ |
| `dim_region` | CSV | 1 | 1 | ✅ |
| `dim_hex` | CSV | 18 | 18 | ✅ |
| `dim_promo` | CSV | 12 | 12 | ✅ |
| `dim_promo_cap_history` | CSV | 15 | 15 | ✅ |
| `dim_date` | CSV | 92 | 92 | ✅ |
| `dim_merchant` | CSV | 400 | 400 | ✅ |
| `dim_user` | CSV | 3.500 | 3.500 | ✅ |
| `fact_promo_budget` | CSV | 324 | 324 | ✅ |
| `fact_ride` | CSV | 41.783 | 41.783 | ✅ |
| `fact_food` | CSV (tập con mock) | 7.232 | 7.232 | ✅ (nguồn đầy đủ 64.968) |
| `fact_promo_burn` | CSV (tập con mock) | 3.000 | 3.000 | ✅ (nguồn đầy đủ 26.040; chỉ lấy dòng có session tồn tại) |

**Quyết định (2026-10-02):** dữ liệu mock chỉ cần vài dòng để trình diễn nên **không nạp đủ 137k dòng**: 9 bảng nhỏ + `fact_ride` đủ; `fact_food` 7.232 dòng đầu; `fact_promo_burn` 3.000 dòng đầu trong số các dòng có `session_id` tồn tại (không có dòng mồ côi). Quy tắc nằm ở `scripts/lib/mock-subset.js`, dùng chung cho nạp / `--verify` / `--deep` / `cutover-check`; nạp đủ bằng `--all-rows`. Hạn mức ghi ngày 1: 90.000 lượt + 3.000 lượt nạp `fact_promo_burn` (đúng theo `meta.rows_written`).

## 2. Đối chiếu từng trường (`--verify --full`)
**Toàn bộ 9.160 event** Firestore so với D1 theo từng trường (`session_id`, `user_id`, `flow`, `event_name`, `screen_name`, `previous_screen`, `step_index`, `properties` so JSON, `created_at` → chuỗi ISO µs, `seed_batch`, `platform`): **0 thiếu, 0 lệch**. `users` 2/2 khớp. (Chạy trước khi dọn dữ liệu thử; sau khi dọn D1 = 9.160 event / 2 user, đúng bằng Firestore. Firestore Spark hết hạn mức đọc ngày sau lần chạy thứ ba nên không chạy lại được trong ngày — kết quả trên vẫn hợp lệ vì nguồn không đổi.)

## 3. Schema & dữ liệu
- DDL chạy trong SQLite cục bộ với **cả 11 CSV** (137.000 dòng) và khoá ngoại bật: 0 vi phạm; mọi khoá chính duy nhất; `CHECK` hoạt động.
- Migration áp `--local` rồi `--remote` thành công; 13 bảng + 3 index khớp thiết kế.
- Một event = **4 `rows_written`** (đúng dự tính: 1 dòng + 3 index); một dòng `fact_*`/`dim_*` = 1.

## 4. Idempotency
- Chạy lại cùng lệnh → `0` lượt ghi (tiến độ trong `scripts/.migrate-d1-state.json`).
- `--reset-state` rồi nạp lại → `INSERT … ON CONFLICT DO UPDATE`, số dòng **không đổi**.
- Mỗi request là một batch = một transaction (tất cả hoặc không).

## 5. Kiểm thử database — `node scripts/test-d1.js` (29/29 PASS)

Chạy trên D1 thật; mọi dòng thử có id `ZTEST*` và bị xoá ở cuối (kể cả khi lỗi); số event thật không đổi.

| Nhóm | Kiểm tra | Kết quả |
|---|---|---|
| CRUD | INSERT = 4 `rows_written`; đọc lại đủ cột/kiểu; `json_extract` khoá lồng; UPDATE; DELETE | ✅ |
| Lọc & sắp | `session_id` + `step_index`; `flow`; `user_id`; khoảng `from/to` (bao gồm hai đầu); tie-break `created_at` bằng nhau → theo `id`; `LIMIT`; `seed_batch IS NOT NULL` | ✅ |
| Phân trang | keyset `(created_at, id) > (?,?)` đi hết 9.331 dòng/10 trang, không sót, không lặp | ✅ |
| Trùng lặp | PK trùng bị từ chối; `ON CONFLICT DO UPDATE` ghi đè, không nhân đôi | ✅ |
| Ràng buộc | `CHECK flow`, `CHECK json_valid`, `CHECK step_index >= 0`, `NOT NULL created_at` đều từ chối; không để lại dòng rác | ✅ |
| Nguyên tử | batch có câu lỗi giữa chừng → rollback toàn bộ | ✅ |
| `users` | upsert giữ `created_at`, cập nhật `last_login_at` | ✅ |
| Khoá ngoại | trỏ cha không tồn tại bị từ chối; xoá cha đang được tham chiếu bị từ chối; xoá đúng thứ tự thành công (D1 **có** bật FK qua REST) | ✅ |
| Index | `EXPLAIN QUERY PLAN`: lọc session → `idx_events_session_step`; user → `idx_events_user_created_at`; thời gian → `idx_events_created_at` | ✅ |

## 6. API và frontend (dev server trỏ D1 thật)

### API
| Kiểm tra | Kết quả |
|---|---|
| `GET /api/events` (không lọc) | 9.160 event, sắp `(created_at, id)`, `X-Cache: MISS` rồi `HIT`; thân ≈ 3,56 MB |
| `?flat=1`, `?session_id=`, `?flow=`, `?from=&to=`, `?limit=` | đúng như hợp đồng cũ |
| `POST /api/events` | `201`; `properties` lồng nhau đọc lại đúng; validator vẫn `400`/`401` như trước |
| Đồng bộ **tăng dần** sau TTL 5 phút | log `INCREMENTAL SYNC fetched=3 new=1 cached=9161` — đọc 3 dòng, không đọc lại 9.160 |
| Đăng nhập → `users` | tạo mới giữ `created_at`; đăng nhập lại chỉ đổi `last_login_at` |
| `GET /api/analytics/<table>` | 11 bảng; boolean `true/false`; keyset (`dim_user` 2.000+1.500; khoá ghép `fact_promo_budget`); `404`/`400` cho bảng/tham số sai (kể cả `__proto__`) |
| `ANALYTICS_TOKEN` | thiếu/sai → `401`, đúng → `200`; người đã đăng nhập đọc được lịch sử **của mình**; của người khác/toàn bộ → `401` |
| `seed-events.js`, `analysis/fetch_events.py` | seed 11 event = 44 lượt ghi, `--clear --batch` xoá đúng 11; `fetch_events.py` đọc 9.161 event (5 trang) và `metrics.py` chạy trên CSV mới |
| **Độ trễ** `POST /api/events` (máy dev → D1 qua REST, 12 lần) | min 155 ms · median ≈ 200 ms · max 1,9 s (lần đầu biên dịch route) |
| **Đồng thời** 30 `POST` song song | 30/30 `201`, 30 id khác nhau, đều đọc lại được |

### Trình duyệt thật (Firefox headless, `scripts/e2e/`)
| Kịch bản | Kết quả |
|---|---|
| **Luồng Đặt xe**: khách vào `/` không bị đẩy sang `/login` → chọn địa chỉ → điểm đón → xe → bỏ qua ưu đãi → bấm "Đặt xe" → hộp thoại đăng nhập (Esc đóng được) → mã sai báo lỗi → mã đúng → tự `confirm_ride` → `/ride/finding-driver` | **22/22 ✅** — `session_id` không đổi qua đăng nhập; event trước xác nhận mang `anon-…`, `confirm_ride` mang SĐT; `step_index` đúng (`confirm_ride`=5); `/history` hiện chuyến |
| **Luồng Food**: menu → 2 món → giỏ → ưu đãi → xác nhận → "Đặt đơn" → hộp thoại → `/food/success` | **16/16 ✅** — `add_to_cart` ×2 `step_index`=3; `place_order` mang SĐT, `step_index`=6, `final_total = cart_total + shipping − discount`; `/history` tab Đặt đồ ăn hiện đơn |
| **Trạng thái lỗi** (D1 không truy cập được — token sai): API trả `500` với thông báo gọn (`Could not write/read …`), **không lộ token** ở client lẫn log; `health` vẫn `ok` | ✅ |
| UI khi D1 lỗi: luồng vẫn đi tiếp (event bị bỏ im lặng, đúng thiết kế `trackEvent`), **đăng nhập vẫn thành công** (ghi `users` là best effort), `/history` hiện "Không đọc được dữ liệu" kèm hướng dẫn, 0 lỗi JS | ✅ |
| Chất lượng build | `npm run typecheck`, `npm run lint`, `npm run build` đều xanh (đã gỡ dòng `@ts-expect-error` thừa ở `app/layout.tsx`); `grep` quy tắc 1 và 9 của CLAUDE.md sạch |

## 7. Lỗi có sẵn phát hiện trong lúc kiểm thử — ĐÃ SỬA (không do migration)

**Triệu chứng:** sau `driver_assigned` app bị đẩy về `/ride/address` thay vì sang `/ride/success`; bấm "Hủy đơn" cũng bị đẩy về `/ride/address` thay vì `/`. Funnel ride **không bao giờ có `screen_view ride_success`** trên trình duyệt thử (Firefox, `next dev`): 5/5 phiên thật trước 30/09 đến được `ride_success`, 3/3 phiên từ 01/10 thì không.

**Nguyên nhân (tái hiện y hệt trên commit trước khi đổi login/D1 — không phải hồi quy):** `app/ride/finding-driver/page.tsx` bọc nội dung bằng `FlowGuard ready={canEnter}`, mà `canEnter` đòi `ride.driverStatus === 'searching'`. Hai chỗ tự làm `canEnter` thành `false` ngay trước khi rời màn:
1. Tìm thấy tài xế: `setRide({driverStatus:'assigned'})` rồi `router.push('/ride/success')` → guard thấy `canEnter=false` và gọi `router.replace('/ride/address')`; hai điều hướng chạy đua, `replace` đến sau nên thắng.
2. Huỷ đơn: `resetAll()` xoá draft rồi `router.replace('/')` → guard lại `router.replace('/ride/address')` đè lên.

**Sửa (một file, `app/ride/finding-driver/page.tsx`):**
- `canEnter` chấp nhận cả `'assigned'` (cũng đúng khi F5 giữa lúc chuyển màn).
- Thêm `leavingRef` (cờ đọc lúc render): `handleCancel` đặt `leavingRef.current = true` **trước** `resetAll()`, nên guard thấy `ready` và nhường đường cho `router.replace('/')`.

**Kiểm chứng trên trình duyệt thật (Firefox, D1):**
| Kịch bản | Trước | Sau |
|---|---|---|
| Đặt xe → tìm thấy tài xế | bị đẩy về `/ride/address`, không có `ride_success` | sang `/ride/success`, hiện "Đặt xe thành công", có `screen_view ride_success` (step 7), **không** có `address_selection` sau `confirm_ride` — `scripts/e2e/ride.js` **25/25** |
| Đặt xe → "Hủy đơn" | về `/ride/address` | về `/`, `cancel_ride` ghi đúng giá, không có `driver_assigned` sau đó — `scripts/e2e/cancel.js` **15/15** |

Lưu ý nhỏ (không sửa): `driver_searching` bị ghi 2 lần trong `next dev` do React Strict Mode chạy effect hai lần (effect không có `useRef` chặn như `useScreenView`) — chỉ ảnh hưởng môi trường dev.

## 8. PHASE 9 — đối chiếu sâu 11 bảng CSV (`--verify --deep`, chỉ đọc D1)

Với mỗi bảng, script so **mọi cột** giữa CSV (theo tập con mock) và D1 bằng tổng hợp tính ở cả hai phía (đếm ô khác NULL; `TOTAL` cho cột số; `COUNT DISTINCT` + tổng độ dài cho cột chuỗi), cộng mẫu theo khoá chính so **từng ô** (bảng ≤ 400 dòng so hết; bảng lớn: dòng đầu, dòng cuối, ~100 dòng ngẫu nhiên) và `PRAGMA foreign_key_check`, cộng kiểm `fact_promo_burn.session_id ⊂ fact_ride ∪ fact_food`.

| Bảng | Dòng kỳ vọng = D1 | Kết quả (2026-10-02) |
|---|---:|---|
| `dim_region`, `dim_hex`, `dim_promo`, `dim_promo_cap_history`, `dim_date`, `dim_merchant`, `fact_promo_budget` | 1 / 18 / 12 / 15 / 92 / 400 / 324 | ✅ so hết từng ô |
| `dim_user` | 3.500 | ✅ 7 cột theo tổng hợp + 102 dòng từng ô |
| `fact_ride` | 41.783 | ✅ 50 cột theo tổng hợp + 102 dòng từng ô, 0 vi phạm khoá ngoại |
| `fact_food` | 7.232 | ✅ 55 cột theo tổng hợp + 102 dòng từng ô |
| `fact_promo_burn` | 3.000 | ✅ 21 cột theo tổng hợp + 102 dòng từng ô; **0 dòng mồ côi** |

**Tất cả 11 bảng đạt, mã thoát `0`.**

**Kiểm tra chính bộ kiểm tra** (test âm): cố ý sửa 2 ô trong D1 (`dim_hex.center_lat += 0.5`, `dim_merchant.merchant_name += 'x'`) → script báo ❌ ở **cả hai** tầng (tổng hợp lẫn so từng ô) và chỉ đúng hai ô đó; khôi phục rồi chạy lại → ✅. Nghĩa là "xanh" có giá trị.

Mã thoát: `0` = tất cả đạt, `2` = có lệch, `3` = đạt nhưng còn bảng chưa nạp đủ.

## 9. Còn lại — thuộc cutover production (`docs/cutover-runbook.md`)
1. **Deploy Vercel** (bạn): đặt `CLOUDFLARE_*` (+ `SMS_MOCK_EXPOSE_CODE=true`, tuỳ chọn `ANALYTICS_TOKEN`), commit + push; sau đó `node scripts/smoke-production.js <url> --login` (15 kiểm tra).
2. **Delta Firestore → D1**: `node scripts/migrate-firebase-to-d1.js --since <mốc>` sau khi deploy (event do bản cũ ghi sau 01/10 15:19 UTC) rồi `--verify --full` (0 thiếu, 0 lệch). Firestore Spark reset hạn mức đọc lúc ≈ 14:00 giờ VN.
3. Đo độ trễ `POST /api/events` từ region Vercel (ở đây ≈ 200 ms từ máy dev; D1 phục vụ từ APAC).
5. `GET /api/events` không lọc ≈ 3,56 MB, sát giới hạn ~4,5 MB của hàm Vercel → Power BI dùng `from/to` (`docs/POWERBI_D1.md`).
