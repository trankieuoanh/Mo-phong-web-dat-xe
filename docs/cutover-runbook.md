# cutover-runbook.md — PHASE 10: chuyển production từ Firestore sang Cloudflare D1

> Trạng thái (2026-10-02): **sẵn sàng; chưa thực hiện cutover.** Dữ liệu D1 đã đủ và đã đối chiếu sâu (`docs/migration-verification.md`; dữ liệu mock nạp theo tập con theo quyết định của chủ dự án). Chỉ còn các bước cần quyền trên Vercel/Git (mục 3) — của bạn.

## 1. Vì sao vẫn còn nói tới "event mới ở Firestore"?

Có **hai nơi chạy code khác nhau**, và chỉ một nơi đã dùng D1:

| Nơi chạy | Code | Ghi event vào |
|---|---|---|
| Máy dev của bạn (`npm run dev`) | bản mới (đã đổi sang D1) | **D1** |
| **Bản đang deploy trên Vercel** | bản **cũ** (chưa push/deploy) | **Firestore** |

Mã nguồn trong thư mục này đã dùng D1, nhưng **người dùng thật vào Vercel vẫn đang chạy bản cũ cho tới khi bạn deploy bản mới**. Mọi event họ sinh ra trong khoảng
*từ lúc chép dữ liệu sang D1 (01/10, ~15:19 UTC) → đến lúc deploy bản mới* chỉ nằm ở Firestore, D1 không có. Đó là "event mới ở Firestore"
cần chép nốt bằng `--since`. **Sau khi deploy bản D1, Firestore không nhận thêm event nào** — nó chỉ còn là kho lưu trữ đóng băng (rollback + đối chiếu), rồi bị gỡ ở PHASE 11.

Hình dung:

```
 01/10 15:19   chép toàn bộ Firestore → D1 (đã xong)
      │            ← người dùng Vercel vẫn ghi vào Firestore (bản cũ)
      ▼
 T_deploy       deploy bản D1  → từ đây event mới vào D1, Firestore đứng yên
      │
      ▼
 ngay sau đó    chạy --since (mốc ≈ 01/10 15:00 UTC): chép các event Firestore phát sinh trong khoảng giữa
                (ON CONFLICT theo id ⇒ chạy lại không nhân đôi)
```

Thứ tự **deploy trước, chép delta sau** là cố ý: nếu chép delta trước rồi mới deploy thì event phát sinh giữa hai bước bị bỏ sót.

## 2. Công cụ đã sẵn sàng (đã chạy thử)

| Công cụ | Mục đích | Đã thử |
|---|---|---|
| `node scripts/cutover-check.js` | kiểm trước cutover: D1 truy cập được, migration đã áp, 13 bảng + 3 index, số dòng đúng kỳ vọng (tập con mock); in danh sách biến môi trường cần đặt trên Vercel | ✅ "SẴN SÀNG" (đã từng chặn đúng khi bảng chưa nạp) |
| `node scripts/smoke-production.js <url> [--login] [--token T]` | kiểm sau deploy: health, POST/GET event, chặn user giả và `confirm_ride` khi chưa đăng nhập, 11 bảng analytics, và **event nằm trong D1** (đọc thẳng qua REST) | ✅ 15/15 với `--login`; 10/10 với `--token` đúng; không token vào server có `ANALYTICS_TOKEN` → các route đọc `401` như thiết kế. Tự dọn dữ liệu thử |
| `node scripts/migrate-firebase-to-d1.js --since <ISO>` | chép delta events/users | ✅ dry-run (20 event, 1 user từ 01/10) |
| `--verify`, `--verify --deep`, `--verify --full`, `scripts/test-d1.js` | đối chiếu dữ liệu / DB | ✅ xem `docs/migration-verification.md` |
| `wrangler d1 migrations apply gsm-db --remote` | schema trên D1 thật | ✅ đã áp (`0001`, `0002`) |

## 3. Các bước cutover — ai làm gì

**Tôi không có Vercel CLI, quyền Vercel hay quyền Git trong môi trường này, và CLAUDE.md quy tắc 12 cấm tôi commit** — nên các bước 3–4 là của bạn.

1. ✅ *(xong)* nạp dữ liệu mock (tập con); `--verify`, `--verify --deep` (thoát `0`), `node scripts/test-d1.js` (29/29).
2. ✅ *(xong)* `node scripts/cutover-check.js` → in "**SẴN SÀNG chuyển production**".
3. *(bạn, Vercel)* Project → Settings → Environment Variables → **Production**, thêm:
   `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_API_TOKEN` (**token riêng cho Vercel**, chỉ quyền *D1 Edit*), `SMS_MOCK_EXPOSE_CODE=true`, và (tuỳ chọn) `ANALYTICS_TOKEN`; giữ `AUTH_SECRET`, `SMS_PROVIDER=mock`.
   Không tiền tố `NEXT_PUBLIC_`. **Chưa xoá** `FIREBASE_*`, `BIGQUERY_*` (xoá ở PHASE 11). Gợi ý: Settings → Functions → Function Region = **Singapore (sin1)** (D1 phục vụ từ APAC).
4. *(bạn, Git)* commit + push nhánh deploy → Vercel build. (Build đã xanh ở máy: `typecheck`, `lint`, `build`.) Ghi lại **giờ UTC lúc deploy xong** = `T_deploy`.
5. *(tôi, ngay sau)* `node scripts/smoke-production.js https://<app>.vercel.app --login` → 15/15. Kiểm quan trọng nhất: dòng "Event nằm TRONG D1".
6. *(tôi, sau 14:00 giờ VN — Firestore reset hạn mức đọc)* delta: `node scripts/migrate-firebase-to-d1.js --since 2026-10-01T15:00:00Z --dry-run`, rồi chạy thật; lặp lại một lần nữa vài phút sau cho chắc (idempotent).
   Cuối cùng `--verify --full`: kỳ vọng **0 thiếu, 0 lệch** cho mọi event Firestore (D1 sẽ có thêm các event phát sinh sau `T_deploy`).
7. *(bạn)* click thử trên trang production một chuyến xe và một đơn food; `curl https://<app>/api/events?limit=3` thấy event mới; `/history` hiện lịch sử.

## 4. Rollback

- **Trước bước 4:** không có gì để hoàn tác (D1 chỉ là bản sao).
- **Sau deploy, cần quay lại:** Vercel → Deployments → bản cũ → *Promote/Instant Rollback*. Bản cũ lại ghi Firestore. **Event đã ghi vào D1 trong khoảng bản D1 chạy sẽ không có ở Firestore** (chưa có script chép ngược D1 → Firestore; app mô phỏng, khối lượng nhỏ, nên chấp nhận được; nếu cần có thể viết thêm).
- Vì thế **giữ Firestore nguyên vẹn** (đóng băng, không xoá) cho tới khi production chạy ổn định vài ngày.

## 5. Rủi ro còn lại
1. Hạn mức D1 Free 100.000 lượt ghi/ngày dùng chung cho app + nạp dữ liệu: **đừng chạy nạp lớn trong giờ có người dùng**; mỗi event = 4 lượt ghi.
2. Độ trễ `POST /api/events` thật từ Vercel chưa đo (≈ 200 ms từ máy dev).
3. `GET /api/events` không lọc ≈ 3,56 MB — sát giới hạn ~4,5 MB của hàm Vercel; dùng `from/to` cho Power BI.
4. Lỗi có sẵn `finding-driver → /ride/address` (`docs/migration-verification.md` mục 7) không liên quan cutover nhưng sẽ lộ ra khi bạn click thử ở bước 7.

## 6. PHASE 11 — dọn Firebase, hai giai đoạn

**11a — đã làm trong repo (không cần cutover):** gỡ `lib/server/db/firebase-admin.ts`, toàn bộ pipeline BigQuery (`scripts/bigquery/`, workflow, `@google-cloud/bigquery`, `BIGQUERY_*`), `scripts/import-powerbi.js` (ghi Firestore); `next.config.ts` bỏ `serverExternalPackages`; `firebase-admin` chuyển từ `dependencies` sang **`devDependencies`** (chỉ `scripts/migrate-firebase-to-d1.js` còn dùng để đọc Firestore); viết lại tài liệu (`CLAUDE.md`, `db-design.md`, `setup.md`, `be-structure.md`, `ARCHITECTURE.md`, `techstack.md`, `api-endpoints.md`…). `npm run typecheck`, `lint`, `build` xanh; app **không còn một dòng nào gọi Firestore**.

**11b — CHỈ làm sau khi production chạy D1 ổn định vài ngày** (còn cần Firestore để chạy delta và rollback):
1. Xoá `firebase-admin` khỏi `devDependencies`; xoá phần Firestore của `scripts/migrate-firebase-to-d1.js` (hoặc xoá cả script — nhưng giữ `--verify --deep` cho các bảng CSV nếu muốn).
2. Xoá `FIREBASE_*` khỏi `.env.local`, Vercel và `.env.example`; xoá mẫu `*-firebase-adminsdk-*.json` / `serviceAccount*.json` khỏi `.gitignore`; huỷ/xoá file service account key (cả file `…firebase-adminsdk-….json` nằm ở thư mục gốc nếu còn).
3. Trên Firebase console: xuất/lưu bản sao nếu cần, rồi xoá các collection `events`, `users`, `pbi_*`, `otp_codes` (mồ côi), hoặc xoá hẳn Firebase project.
4. Xoá `docs/firebase-audit.md` hoặc giữ như tài liệu lịch sử (đã gắn nhãn).
5. Đánh dấu hoàn thành `TODO.md` ("Migrate Firebase → Cloudflare D1").
