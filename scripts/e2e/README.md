# scripts/e2e — kiểm thử trình duyệt (PHASE 8)

Kịch bản chạy tay bằng **Firefox headless** qua `puppeteer-core` (WebDriver BiDi). **Không** thuộc dependency của dự án
(CLAUDE.md quy tắc 8) — cài ở thư mục riêng, ngoài repo:

```bash
mkdir ~/gsm-e2e && cd ~/gsm-e2e && npm init -y && npm i puppeteer-core
cp <repo>/scripts/e2e/*.js . && npm run dev   # ở một terminal khác, trong repo (cổng 3000, trỏ D1 thật)
node ride.js      # khách duyệt → Đặt xe → hộp thoại đăng nhập → tìm tài xế → /ride/success → event/session/history  (25 kiểm tra)
node cancel.js    # như trên nhưng bấm "Hủy đơn" khi đang tìm tài xế → về `/`  (15 kiểm tra)
node food.js      # khách duyệt → giỏ → Đặt đơn → hộp thoại đăng nhập → event/history    (16 kiểm tra)
node down.js      # chạy khi dev server khởi động với CLOUDFLARE_API_TOKEN sai: UI phải lỗi êm
```

- Cần `/snap/bin/firefox` (đổi `executablePath` trong `lib.js` nếu khác). Profile tạm nằm ở `~/ffprof-pptr` (snap Firefox không ghi được vào `/tmp`).
- **Ghi dữ liệu thật vào D1** (event của phiên thử, số `0912…`/`0913…`). Dọn bằng cách xoá các `session_id` in ra ở cuối mỗi kịch bản.
- `lib.js` tắt geolocation (`geo.enabled=false`) để app lùi về `DEFAULT_PICKUP` ngay.
- Lỗi "bị đẩy về /ride/address sau khi tìm thấy tài xế / khi huỷ" đã sửa — `docs/migration-verification.md` mục 7; hai kịch bản trên là bài kiểm hồi quy.
