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
node route.js     # tuyến bám đường thật, đổi điểm đến, cùng hình học qua các màn, xe chạy trên polyline (21 kiểm tra)
node route-food.js  # giao đồ ăn: tuyến quán → khách + xe giao hàng; không chọn quán thì như cũ (12 kiểm tra)
node route-fail.js  # OSRM lỗi: không vẽ đường giả, khoá nút, Thử lại (12 kiểm tra). CẦN: node fake-osrm.js & rồi chạy dev với
                    #   OSRM_BASE_URL=http://127.0.0.1:4590/route/v1/driving  (OSRM giả lỗi 3 request đầu rồi chuyển tiếp OSRM thật)
```

- Cần `/snap/bin/firefox` (đổi `executablePath` trong `lib.js` nếu khác). Profile tạm nằm ở `~/ffprof-pptr` (snap Firefox không ghi được vào `/tmp`).
- **Ghi dữ liệu thật vào D1** (event của phiên thử, số `0912…`/`0913…`). Dọn bằng cách xoá các `session_id` in ra ở cuối mỗi kịch bản.
- Đặt `W=1440 H=900` để chạy ở layout desktop (Firefox/BiDi không có `page.setViewport`; `lib.js` gọi `browsingContext.setViewport`). Mặc định cửa sổ 800×600 (layout di động). `route*.js` cần `DEVLOG=<file log của npm run dev>` để đếm số lần gọi `/api/route` và `SHOTS=<thư mục>` để lưu ảnh chụp.
- `lib.js` tắt geolocation (`geo.enabled=false`) để app lùi về `DEFAULT_PICKUP` ngay.
- Lỗi "bị đẩy về /ride/address sau khi tìm thấy tài xế / khi huỷ" đã sửa — `docs/migration-verification.md` mục 7; hai kịch bản trên là bài kiểm hồi quy.
