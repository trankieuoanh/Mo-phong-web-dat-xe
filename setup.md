# setup.md — GSM ride-booking simulation

Hướng dẫn chạy dự án + dựng môi trường local. Làm đúng thứ tự: **Phase 0 chạy được app trước khi đụng tới database (Cloudflare D1).**

Gặp lỗi khi chạy → nhảy thẳng xuống mục [Gặp lỗi?](#gặp-lỗi) ở gần cuối file.

## Yêu cầu
- Node.js **20 LTS trở lên** (Next.js 15 cần ≥ 18.18; 20 là bản an toàn nhất).
- npm (có sẵn cùng Node).
- Một tài khoản Cloudflare (miễn phí) để tạo database D1 — **chỉ cần từ Phase 1**.
- Python **3.10+** (chỉ cần từ Tuần 5, cho phần phân tích).

---

## Chạy nhanh

```bash
npm install     # ở thư mục GỐC của repo
npm run dev
```

Mở **http://localhost:3000** → thấy màn Home: panel đặt xe bên trái, bản đồ bên phải, tab "Đặt xe" sáng ở sidebar.

> **Chưa cần D1 để chạy.** App lên được, click hết cả hai luồng (Đặt xe / Food) được, chỉ là event không lưu xuống đâu cả — `POST /api/events` sẽ trả 500. Muốn lưu event mới cần làm Phase 1.
>
> Nói cách khác: từ lúc clone tới lúc thấy app chạy là **2 lệnh**, không phải cả quy trình cấu hình database.

Luôn vào cổng **3000**. `/api/*` là route handler của chính app này — một process, không có cổng thứ hai.

### ⚠️ Đừng trộn WSL và Windows trên cùng một thư mục

Dự án nằm trên ổ `C:` nên vừa mở được bằng WSL vừa mở được bằng PowerShell. **Chọn một rồi giữ nguyên.**

`npm install` chỉ tải binary khớp với hệ điều hành đang chạy. Cài từ WSL thì `node_modules` chứa bản Linux:

```
node_modules/@next/swc-linux-x64-gnu
node_modules/@tailwindcss/oxide-linux-x64-gnu
node_modules/lightningcss-linux-x64-gnu
```

Mở PowerShell chạy `npm run dev` vào đúng thư mục đó sẽ lỗi SWC/lightningcss, và **thông báo lỗi không hề nhắc tới WSL** — rất dễ mất cả buổi đoán mò.

Cần đổi môi trường thì xoá và cài lại:

```bash
# WSL / macOS
rm -rf node_modules .next && npm install
```
```powershell
# Windows PowerShell — `rmdir /s /q` là lệnh của cmd.exe, không chạy ở đây
Remove-Item -Recurse -Force node_modules, .next -ErrorAction SilentlyContinue
npm install
```

---

## Phase 0 — App chạy được, chưa có database

Khung đã có sẵn trong repo. Chỉ cần:

```bash
npm install     # ở thư mục GỐC
npm run dev     # MỘT process: giao diện + /api/* cùng ở :3000
```

Kiểm tra:

```bash
# WSL / macOS
curl localhost:3000/api/health      # → {"status":"ok"}
```
```powershell
# Windows PowerShell — xem mục "Lệnh tương đương trên Windows" bên dưới
curl.exe localhost:3000/api/health
```

Route `/api/health` **không chạm D1** và không import gì từ `lib/server/db` (xem `api-endpoints.md`), nên nó xác nhận app chạy đúng trước khi credential vào cuộc. Đừng bỏ qua — nếu bỏ, lỗi D1 và lỗi khởi động sẽ trộn vào nhau và rất khó tách.

> Bản trước tách làm hai process và mục này từng bắt chạy **hai** lệnh curl (`:4000` rồi `:3000`) để tách lỗi Express khỏi lỗi proxy. Giờ không còn proxy nên chỉ còn một lệnh.

Mở `http://localhost:3000` → thấy màn Home: panel đặt xe bên trái, bản đồ bên phải, tab "Đặt xe" sáng ở sidebar.

---

## Phase 1 — Cloudflare D1

Database là **Cloudflare D1** (SQLite), gọi từ app qua **REST API** (`lib/server/db/d1.ts`) — app chạy trên Vercel nên không dùng được binding của Workers. Thiết kế đầy đủ: `docs/d1-schema-design.md`.

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Storage & Databases → D1 → Create database** → tên `gsm-db` (khớp `wrangler.jsonc`). Chọn location gần nơi deploy.
2. Lấy **Account ID** (Account Home) và **Database ID** (trang database; cũng là `database_id` trong `wrangler.jsonc`).
3. **My Profile → API Tokens → Create Token** → quyền **D1 → Edit**, giới hạn đúng account này. Đây là `CLOUDFLARE_API_TOKEN`. (Trên Vercel nên dùng một token **riêng**.)
4. Điền ba giá trị vào **`.env.local`** (copy từ `.env.example`): `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_API_TOKEN`.
5. Tạo schema (cần `npx wrangler login` một lần, hoặc đặt `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` trong môi trường):

```bash
npx wrangler d1 migrations apply gsm-db --local     # thử trên bản local trước
npx wrangler d1 migrations apply gsm-db --remote    # D1 thật (chỉ CREATE, không phá dữ liệu)
```

6. Nạp dữ liệu mô phỏng 11 bảng (tập con mock, ~25.000 lượt ghi) và kiểm tra:

```bash
node scripts/migrate-firebase-to-d1.js --only dim_region,dim_hex,dim_promo,dim_promo_cap_history,dim_date,dim_merchant,dim_user,fact_promo_budget,fact_ride,fact_food,fact_promo_burn
node scripts/migrate-firebase-to-d1.js --verify --deep
node scripts/test-d1.js                      # 29 kiểm tra CRUD/ràng buộc/khoá ngoại trên D1 thật
```

> **Không lưu token trong repo.** Chỉ đặt vào biến môi trường. **Hạn mức Free: 100.000 dòng ghi/ngày** (mỗi index tính thêm 1 lượt ghi/dòng; một event = 4 lượt) — xem mục "Gặp lỗi?".

---

## Biến môi trường

**Tất cả biến ở một file duy nhất.** `.env.local` ở gốc repo (đã có trong `.gitignore` — kiểm tra lại cho chắc):

```bash
# Tuỳ chọn — địa chỉ liên hệ gắn vào User-Agent khi gọi Photon/Overpass.
# Có giá trị mặc định nên bỏ trống vẫn chạy được.
NOMINATIM_CONTACT=ban@example.com

# Database Cloudflare D1 (qua REST) — lấy 3 giá trị ở dash.cloudflare.com, xem .env.example:
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_D1_DATABASE_ID=...
CLOUDFLARE_API_TOKEN=...        # quyền "D1 Edit" trên đúng account này
# Tuỳ chọn: ANALYTICS_TOKEN=...  (khoá GET /api/events và /api/analytics/*)

# Đăng nhập SĐT + mã SMS. AUTH_SECRET >= 32 ký tự, sinh bằng:
#   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
AUTH_SECRET=...
SMS_PROVIDER=mock
```

**Đăng nhập khi dev:** khách duyệt tự do; hộp thoại đăng nhập chỉ hiện khi bấm **Đặt xe** (`/ride/confirm`) hoặc **Đặt đơn** (`/food/confirm`). Nhập số điện thoại **thật hay giả đều được** — với `SMS_PROVIDER=mock` không có tin nào được gửi, mã 6 số hiện ngay trên hộp thoại và in ra console `npm run dev` (`[sms:mock] -> +84…`). Muốn gửi SMS thật: thêm một sender gọi REST API nhà cung cấp bằng `fetch` trong `lib/server/services/sms.service.ts`, rồi đổi `SMS_PROVIDER`. Trên Vercel nhớ thêm `AUTH_SECRET` vào biến môi trường.

Next.js **tự nạp `.env.local`** cho cả `npm run dev` lẫn `npm run build` — không cần cờ, không cần `dotenv`. `scripts/*.js` và `analysis/` cũng đọc đúng file này.

File `.env.example` đã commit sẵn với giá trị trống, để người khác clone repo biết cần những biến gì.

> **Ba biến đã biến mất khi gộp một project**, ghi ra đây để không ai đi tìm: `PORT` (chỉ còn một process), `API_ORIGIN` (không còn proxy), và `WEB_ORIGIN` — phép dò tile giờ lấy origin từ **chính request** (`app/api/tiles/route.ts`), nên không còn biến nào để đặt sai. Bản trước đặt sai đúng biến đó chính là thứ đã làm bản đồ trả 401 trên bản deploy.

**`NOMINATIM_CONTACT`** phục vụ endpoint `GET /api/places` (tìm địa chỉ thật). [Điều khoản dùng Nominatim](https://operations.osmfoundation.org/policies/nominatim/) bắt buộc mỗi request mang `User-Agent` định danh ứng dụng kèm cách liên hệ; thiếu nó thì OSM có quyền chặn IP. Đây cũng là lý do endpoint này phải nằm ở server chứ không gọi thẳng từ trình duyệt — **trình duyệt không cho JavaScript đặt header `User-Agent`**.

Không cần API key: Nominatim miễn phí. Đổi lại nó giới hạn **1 request/giây**, nên hàng đợi và cache nằm ở `lib/server/services/upstream.ts`; xem `api-endpoints.md` mục 3b.

### Bốn dịch vụ ngoài mà app gọi

| Dịch vụ | Dùng cho | API key | Khi nó chết |
|---|---|---|---|
| **Photon** (`photon.komoot.io`) | `GET /api/places`, `GET /api/reverse` — địa chỉ | không | Panel hiện cảnh báo, vẫn liệt kê 5 địa chỉ gợi ý; nhãn địa chỉ lùi về mặc định |
| **Overpass** (`overpass-api.de`) | `GET /api/restaurants` — quán ăn | không | Dải "Gần bạn" hiện lỗi kèm nút Thử lại; ba cách tìm món còn lại vẫn chạy |
| **OSRM** (`router.project-osrm.org`) | `GET /api/route` — tuyến đường | không | Bản đồ báo "Không tính được tuyến đường" + nút Thử lại; **chặn** nút "Chọn điểm đón này" tới khi có tuyến thật (server tự thử lại 1 lần với lỗi mạng tạm thời) |
| **Tile Stadia** (`tiles.stadiamaps.com`) | Nền bản đồ trong `MapCanvas` | không — nhưng **chỉ ở localhost** | Tự chuyển sang `tile.openstreetmap.fr`, rồi `tile.openstreetmap.de`; hết đường thì hiện "Không tải được nền bản đồ" |

Cả bốn là **hạ tầng cộng đồng miễn phí**, chỉ hợp cho demo cục bộ.

> **Stadia chặn theo `Referer`, và chỉ miễn phí cho `localhost`.** Gọi không kèm header đó sẽ nhận `401` — nên `curl` trần sẽ báo tile chết trong khi trình duyệt vẫn tải được bình thường. Thêm `-e http://localhost:3000/` khi tự kiểm tra.
>
> Trên **bản deploy** thì referer là domain thật, và Stadia trả `401` cho mọi tile. Đo thật trên cùng một URL tile:
>
> | Referer | Kết quả |
> |---|---|
> | `http://localhost:3000/` | 200, 495 B |
> | `https://<app>.vercel.app/` | **401**, 14.885 B |
>
> Dự án **không đi đăng ký API key** để giải quyết chuyện này — cách xử lý là để phép dò `GET /api/tiles` tự loại Stadia ra ở môi trường deploy, rồi rơi về `osmfr`/`osmde` (đều không cần key). Và nó **tự làm đúng mà không cần cấu hình gì**: route handler lấy referer từ chính request của trình duyệt, nên local ra `["stadia","osmfr","osmde"]` còn bản deploy ra `["osmfr","osmde"]`.

> ## ⚠️ `*.openstreetmap.org` có thể bị chặn — và đó là lỗi khó đoán nhất của dự án này
>
> Trên máy đang phát triển dự án, **toàn bộ tên miền `*.openstreetmap.org` không kết nối được**, trong khi OSRM, Photon, Overpass và mọi thứ khác vẫn thông. Triệu chứng nhìn thấy:
>
> - **Bản đồ trắng ở CẢ hai luồng** — một ô xám vẫn có nút zoom và dòng ghi công (`tile.openstreetmap.org`).
> - **Dải "Gần bạn" luôn rỗng**, không báo lỗi gì (`nominatim.openstreetmap.org`).
>
> Hai triệu chứng trông như hai lỗi giao diện riêng biệt, nhưng chỉ là **một sự thật về mạng**. Đây là lý do dự án đã chuyển tile sang CARTO, địa chỉ sang Photon và quán ăn sang Overpass.
>
> Kiểm tra nhanh từ chính máy chạy dự án:
> ```bash
> curl -s -o /dev/null -w '%{http_code}\n' -e http://localhost:3000/ \
>   "https://tiles.stadiamaps.com/tiles/osm_bright/13/6720/3638.png?api_key=$STADIA_API_KEY"
> curl -s -o /dev/null -w '%{http_code}\n' https://overpass-api.de/api/status
> curl -s -o /dev/null -w '%{http_code}\n' 'https://photon.komoot.io/reverse?lat=21.03&lon=105.78'
> ```
> Cả ba phải ra `200`. Cái nào ra `000` thì tính năng tương ứng sẽ hỏng **im lặng** chứ không báo lỗi rõ ràng. `api-endpoints.md` đã chốt không deploy công khai trước khi sinh xong dữ liệu — điều đó giờ còn thêm một lý do nữa.

Không có mạng thì app **vẫn chạy hết luồng**: chỉ mất bản đồ nền và độ chính xác của quãng đường.

**Hai điều cần nhớ với biến môi trường:**
1. Giá trị Cloudflare không có dấu cách/xuống dòng — dán nguyên chuỗi, không cần nháy kép.
2. Không thêm `NEXT_PUBLIC_` vào bất kỳ biến nào ở trên — tiền tố đó nhúng giá trị thẳng vào bundle trình duyệt, tức là **công khai token Cloudflare**. Điều này **nguy hiểm hơn trước**: giờ `.env.local` là của chính project Next.js, tức đúng nơi tiền tố đó có hiệu lực thật.

---

## Truy cập D1 từ app

Đã có sẵn ở `lib/server/db/d1.ts` (`d1Query`, `d1Batch`). Các chi tiết **bắt buộc**, đừng lược bỏ khi sửa:

- **`import 'server-only'` ở dòng đầu** — hàng rào chặn token rò xuống trình duyệt. Kéo file này (hoặc bất kỳ service nào trong `lib/server/`) vào một Client Component là **build đỏ ngay**. Xem `CLAUDE.md` quy tắc 1.
- **Mọi SQL tham số hoá** (`?` + `params`), không bao giờ nối chuỗi.
- **Cấu hình đọc trễ (lazy)** — `readConfig()` chỉ chạy ở request đầu tiên cần D1. Nhờ vậy `GET /api/health` trả lời được ngay cả khi chưa có credential.
- **Retry có giới hạn, timeout 15 giây:** chỉ lỗi tạm (429, 5xx, mạng) mới thử lại; lỗi SQL/quyền ném thẳng. Thông báo lỗi trả cho client luôn gọn, chi tiết chỉ ở log server, **không bao giờ lộ token**.

## Index

D1 **không** tự tạo index. Bảng `events` có 3 index (xem `db-design.md`); mỗi index tăng 1 lượt ghi/dòng trong hạn mức 100.000/ngày. Thêm truy vấn mới thường xuyên → viết migration mới với `CREATE INDEX`, kiểm bằng `EXPLAIN QUERY PLAN`, và tính chi phí ghi.

---

## Deploy

Không bắt buộc — `techstack.md` đã chốt chạy local là đủ để demo. Mục này dành cho khi thực sự cần một link truy cập từ xa.

**Một project = một nơi deploy.** Vercel tự nhận Next.js ở gốc repo, nên không cần `vercel.json`, không cần khai build command, và không có server thứ hai nào để quên.

> **Bản trước phải deploy HAI nơi, và đó chính là thứ đã hỏng.** Deploy mỗi `apps/web` thì `rewrites` vẫn trỏ về `http://localhost:4000`, Vercel trả `404 DNS_HOSTNAME_RESOLVED_PRIVATE` cho **mọi** `/api/*` — bản đồ 401, ô tìm địa chỉ chết, và **không một event nào được ghi** mà app không báo gì (vì `lib/track.ts` cố ý nuốt lỗi). Gộp một project là cách sửa tận gốc chế độ hỏng đó. Xem `ARCHITECTURE.md`.

### Biến môi trường trên Vercel

Y hệt `.env.local` — D1, OSM **và các biến đăng nhập** (thiếu `AUTH_SECRET` thì `send-code` trả 500):

| Biến | Ghi chú |
|---|---|
| `NOMINATIM_CONTACT` | email liên hệ (điều khoản OSM) |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_API_TOKEN` | **database của app** (D1). Thiếu ba biến này thì `POST /api/events` trả 500. Không tiền tố `NEXT_PUBLIC_`. |
| `ANALYTICS_TOKEN` | tuỳ chọn — khoá GET `/api/events` và `/api/analytics/*` bằng `Authorization: Bearer` |
| `AUTH_SECRET` | chuỗi ngẫu nhiên >= 32 ký tự (`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`) |
| `SMS_PROVIDER` | `mock` |
| `SMS_MOCK_EXPOSE_CODE` | `true` — **bắt buộc** với `mock` trên production, nếu không mã không hiện ra và không ai đăng nhập được. Hệ quả: ai cũng đăng nhập được bằng số bất kỳ (chấp nhận được cho app mô phỏng). **Redeploy** sau khi đặt biến. |

**Tuyệt đối không thêm tiền tố `NEXT_PUBLIC_`** (CLAUDE.md quy tắc 2) — tiền tố đó nhúng giá trị vào bundle trình duyệt, tức công khai token Cloudflare.

Không có biến nào khác ngoài các biến trên: không `PORT`, không `API_ORIGIN`, không `WEB_ORIGIN`.

### Kiểm tra sau khi deploy

```bash
WEB=https://<app>.vercel.app

curl -s -o /dev/null -w '%{http_code}\n' $WEB/api/health   # 200
curl -s "$WEB/api/places?q=Ho%20Guom" | jq 'length'         # > 0
curl -s $WEB/api/tiles                                      # {"providers":["osmfr","osmde"]}
```

`/api/tiles` **phải tự trả về danh sách không có `stadia`** mà không cần đặt biến nào — phép dò lấy referer từ chính request. Nếu vẫn thấy `stadia` thì mới có chuyện lạ. Còn `carto` nghĩa là CARTO đã mở lại raster miễn phí (chuyện tốt, không phải lỗi).

Rồi mở web, đi hết một luồng, và đếm event như mục cuối `CLAUDE.md`. Trong DevTools tab Network, lọc `tiles.` — **không được còn request nào tới `tiles.stadiamaps.com`**, và dòng `© OpenStreetMap` vẫn phải nằm ở góc bản đồ.

### Hai điều cần biết trước

**`POST /api/events` là endpoint mở.** Trình duyệt gọi thẳng vào nó, nên không có chỗ nào giấu được một khoá chia sẻ — xem `api-endpoints.md` mục "Vì sao không còn khoá chia sẻ". Nguyên tắc giữ nguyên: **sinh xong dữ liệu phân tích rồi hãy deploy công khai.**

**Hàng đợi rate-limit yếu đi trên serverless.** `lib/server/services/upstream.ts` giữ hàng đợi và cache trong bộ nhớ một tiến trình; mỗi lambda instance của Vercel có bộ nhớ riêng. Cutover từ Firestore sang D1 trên production: `docs/cutover-runbook.md` (kiểm trước: `node scripts/cutover-check.js`; kiểm sau: `node scripts/smoke-production.js <url> --login`).

Nếu bị Photon/Overpass chặn IP giữa buổi demo thì đây là chỗ đầu tiên nhìn vào, không phải lỗi mạng.

---

## Phần phân tích (từ Tuần 5)

`analysis/` **không phải một phần của app Next.js** — nó là project Python riêng, và đọc thẳng **D1 qua REST** chứ không gọi qua `/api`.

```
analysis/
  requirements.txt      # pandas, matplotlib (không cần thư viện gọi D1: dùng urllib của thư viện chuẩn)
  fetch_events.py       # kéo bảng events từ D1 → output/events.csv (keyset theo (created_at, id), 2.000 dòng/trang)
  metrics.py            # tính chỉ số theo analysis-spec.md
  output/               # .gitignore — CSV và biểu đồ sinh ra
  .env                  # .gitignore — TUỲ CHỌN, xem bên dưới
```

```bash
# WSL / macOS
cd analysis
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python fetch_events.py && python metrics.py
```
```powershell
# Windows PowerShell
cd analysis
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Nếu PowerShell chặn script kích hoạt (`cannot be loaded because running scripts is disabled`), chạy một lần:
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

### Cấu hình cho phần Python — không cần gì thêm

`fetch_events.py` đọc `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_D1_DATABASE_ID` (mặc định lấy `database_id` trong `wrangler.jsonc`) theo thứ tự: `.env.local` → `analysis/.env` → biến môi trường. Ai chạy được `npm run dev` thì chạy được luôn script này. Token chỉ cần quyền đọc; script không bao giờ in token ra.

### Seed dữ liệu giả lập

`scripts/seed-events.js` ghi event giả qua REST (cùng cấu hình, `scripts/lib/d1-rest.js`):

```bash
node scripts/seed-events.js --dry-run   # xem trước, không cần credential
node scripts/seed-events.js             # ghi ~9.000 event = ~36.000 lượt ghi D1 (⅓ hạn mức ngày)
node scripts/seed-events.js --clear     # dọn lại, chỉ xoá event có seed_batch
```

---

## `.gitignore` — kiểm tra có đủ

```
node_modules/
.next/
.env
.env*.local
analysis/.venv/
.wrangler/
scripts/.migrate-d1-state.json
analysis/output/
```

Trước commit đầu tiên, chạy `git status` và xác nhận **không** thấy file nào chứa `private_key`.

---

## Gặp lỗi?

Tra theo **triệu chứng nguyên văn** hiện trên màn hình.

### Cổng đang bị chiếm

Lần chạy trước chưa tắt hẳn:

```
Error: listen EADDRINUSE: address already in use :::3000
```

Tìm và kết thúc tiến trình:

```bash
lsof -ti:3000 | xargs kill -9        # WSL/macOS
```
```powershell
netstat -ano | findstr :3000         # Windows — cột cuối là PID
taskkill /PID <PID> /F
```

### Trang mở được nhưng mọi thứ gọi API cứ quay mãi

Ô tìm địa chỉ quay skeleton không bao giờ dứt, bản đồ không vẽ tuyến, dải "Gần bạn" trống — mà **không có lỗi nào in ra**, kể cả `EADDRINUSE`.

Nguyên nhân thường gặp: lần `npm run dev` trước bị **Ctrl+Z** (treo) chứ không tắt hẳn. Tiến trình ở trạng thái đó **vẫn giữ cổng 3000** nên socket vẫn `LISTEN` và bắt tay TCP thành công — nhưng nó bị dừng nên **không bao giờ trả lời**. Lần chạy mới thấy cổng bận, còn trình duyệt thì chỉ thấy request treo vô hạn.

Nhận ra bằng cột `STAT` có chữ **`T`**:

```bash
ps -eo pid,stat,args | grep Mo-phong-web-dat-xe | grep -v grep
#   33547 Tl   node ... next dev --port 3000      ← T = đã bị treo
```

Dọn (phải `-9`: tiến trình đang dừng không xử lý `SIGTERM`):

```bash
ps -eo pid,stat,args | grep Mo-phong-web-dat-xe | grep -v grep \
  | awk '$2 ~ /T/ {print $1}' | xargs -r kill -9
ss -ltn | grep ":3000"               # phải không in gì
npm run dev
```

> Tắt bằng **Ctrl+C**, không phải Ctrl+Z. Ctrl+Z chỉ đẩy tiến trình vào nền ở trạng thái dừng.

Từ phía FE, ô tìm địa chỉ giờ **bỏ cuộc sau 6 giây** và hiện cảnh báo kèm 5 gợi ý thay vì quay mãi (`REQUEST_TIMEOUT_MS` trong `lib/use-place-search.ts`) — nhưng đó chỉ là đường lui, upstream vẫn phải hồi.

### `POST /api/events` trả 500, app vẫn click được bình thường
Chưa có `.env.local`, hoặc sai/thiếu cấu hình Cloudflare. Xem log của terminal đang chạy `npm run dev`:

```
Thieu bien moi truong Cloudflare D1: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN.
D1 tu choi cau lenh: 10000 Authentication error          ← token sai / hết hạn / thiếu quyền D1 Edit
```

Làm Phase 1 để sửa. Event bị mất nhưng luồng UI không vỡ — đó là chủ ý của `trackEvent` (`screen-map.md` mục 4), không phải lỗi. Đăng nhập **vẫn chạy** khi D1 lỗi (ghi `users` là best effort).

### D1 từ chối mọi truy vấn: "exceeded daily limit" / hết hạn mức
Gói Free: **100.000 dòng ghi/ngày** và 5.000.000 dòng đọc/ngày, reset 00:00 UTC (07:00 giờ VN). Khi chạm giới hạn, D1 từ chối **cả đọc lẫn ghi** tới lúc reset. Không phải lỗi code. Mỗi event tốn **4 lượt ghi** (1 dòng + 3 index); `seed-events.js` mặc định ≈ 36.000 lượt; nạp `--all-rows` ≈ 170.000 lượt (cần ≥ 2 ngày). Đừng chạy tác vụ ghi lớn lúc có người dùng. Số lượt đã dùng nằm trong `meta.rows_written` của mỗi phản hồi REST.

### `POST /api/auth/send-code` trả 500, hoặc trên Vercel không thấy mã
Thiếu `AUTH_SECRET` (hoặc ngắn hơn 32 ký tự) trong `.env.local` — console server báo `Thieu AUTH_SECRET`. Thêm vào rồi **khởi động lại** `npm run dev`. Đổi `AUTH_SECRET` sẽ làm mọi cookie cũ mất hiệu lực — đăng nhập lại.
Trên **Vercel**: `SMS_PROVIDER=mock` + production thì mã **không** hiện ra — đặt `SMS_MOCK_EXPOSE_CODE=true` rồi redeploy.

### `D1 tu choi cau lenh: 10000 Authentication error`
`CLOUDFLARE_API_TOKEN` sai, đã bị thu hồi, hoặc không có quyền **D1 → Edit** trên đúng account (`CLOUDFLARE_ACCOUNT_ID`). Tạo token mới ở dash.cloudflare.com → My Profile → API Tokens; trên Vercel nhớ redeploy sau khi đổi biến.

### `no such table: events` / `no such table: dim_user`
Chưa áp migration lên database đang trỏ tới. Chạy `npx wrangler d1 migrations apply gsm-db --remote` (xem Phase 1). Kiểm tra `CLOUDFLARE_D1_DATABASE_ID` có đúng database `gsm-db` không.

### Bản đồ hiện chữ "API KEY REQUIRED" chéo trên mọi tile

Nhà cung cấp tile đã chuyển sang bắt buộc API key. Đây **không phải lỗi Google Maps** — dự án không dùng Google Maps, không dùng thư viện bản đồ nào, và không có API key nào cả (`CLAUDE.md` quy tắc 8).

Chuyện đã xảy ra một lần với CARTO: họ khoá **toàn bộ** raster miễn phí (`light_all`, `voyager`, cả tên miền cũ `cartodb-basemaps-*.global.ssl.fastly.net`), nhưng vẫn trả HTTP 200 kèm PNG hợp lệ — chỉ là đã in chữ lên. Vì `onError` của thẻ `<img>` không bao giờ bắn, cơ chế tự chuyển nhà cung cấp trong `MapCanvas.tsx` **không cứu được**.

Xem nhà cung cấp nào còn dùng được:
```bash
curl localhost:3000/api/tiles
```

Nhà cung cấp bị đóng dấu sẽ **vắng mặt** trong danh sách trả về. Nếu danh sách trống hoặc thiếu đúng cái đang cần, thêm một nhà cung cấp mới vào `TILE_PROVIDERS` ở `lib/shared/tiles.ts` — **đừng** đi đăng ký API key rồi nhét vào `NEXT_PUBLIC_*`, tiền tố đó nhúng giá trị thẳng vào bundle trình duyệt (quy tắc 2).

Tự kiểm tra một nhà cung cấp mới trước khi thêm, bằng đúng tile biển sâu mà phép dò dùng:
```bash
curl -so /dev/null -w '%{size_download}\n' <URL tile z=13 x=6707 y=3740>
```
Dưới 800 byte là sạch. Trên ngưỡng đó nghĩa là giữa Biển Đông đang có chữ.

### Trên bản deploy: bản đồ báo 401 hoặc ô tìm địa chỉ không ra gì

Đây từng là triệu chứng của việc quên deploy `apps/api` — **không còn xảy ra được nữa** vì `/api/*` sống chung với trang web. Nếu vẫn gặp:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://<app>.vercel.app/api/health   # phải 200
curl -s https://<app>.vercel.app/api/tiles                                     # phải KHÔNG có "stadia"
```

- `/api/health` không ra `200` → build hỏng hoặc chưa deploy; đọc log build trên Vercel.
- `/api/tiles` vẫn còn `stadia` → phép dò đang gửi referer sai. Nó lấy từ `x-forwarded-host` của chính request (`app/api/tiles/route.ts`), nên chuyện này chỉ xảy ra nếu có proxy lạ đứng trước. Lưu ý kết quả được **cache 6 giờ** trong bộ nhớ instance.
- Tìm địa chỉ chết nhưng `/api/health` `200` → Photon đang chết hoặc chặn IP, không phải lỗi deploy. Xem mục bốn dịch vụ ngoài.

### Event trên bản deploy không vào D1, app vẫn click bình thường

Đúng thiết kế của `lib/track.ts`: lỗi mạng bị nuốt để không bao giờ kẹt UI. Nên mọi hỏng hóc ở đường ghi event đều **im lặng**, phải đi tìm bằng tay:

```bash
node scripts/smoke-production.js https://<app>.vercel.app --login   # 15 kiểm tra, gồm "event nằm TRONG D1"
curl -s -w '\n[%{http_code}]\n' -X POST https://<app>.vercel.app/api/events \
  -H 'Content-Type: application/json' -d '{}'
```

`401` hoặc `400` nghĩa là route sống và validator chạy — vấn đề nằm ở cấu hình Cloudflare trên Vercel (thiếu biến, token sai; **redeploy** sau khi đặt biến). `500` nghĩa là ghi D1 hỏng; đọc log function trên Vercel (thông báo `D1 tu choi cau lenh: …` cho biết lý do, không chứa token).

### Số `screen_view` nhiều gấp đôi số màn đã đi qua
`useRef` chưa chặn được lần chạy thứ hai của React Strict Mode trong `next dev`. Nếu không sửa thì **mọi tỉ lệ funnel đều sai gấp đôi** — xem `screen-map.md` mục 4.

Kiểm tra bằng lệnh ở cuối `CLAUDE.md`, đếm số dòng `screen_view`.

### `Module not found: Can't resolve './types.js'`
Import tương đối có đuôi `.js`. Webpack của Next không resolve `.js` về `.ts`, trong khi `tsx` thì chấp nhận — nên lỗi này **chỉ hiện ở `npm run build`, không hiện khi chạy BE**. Bỏ đuôi `.js` đi:

```ts
import type { ScreenName } from './types';     // đúng
import type { ScreenName } from './types.js';  // hỏng build
```

### App chạy được ở WSL nhưng lỗi SWC/lightningcss ở PowerShell (hoặc ngược lại)
Trộn hai môi trường trên cùng một `node_modules`. Xem cảnh báo ở mục [Chạy nhanh](#chạy-nhanh).

---

## Lệnh tương đương trên Windows

Chỉ những chỗ **thật sự khác nhau**. Còn lại (`npm install`, `npm run dev`, `npm run build`…) giống hệt.

| Việc | WSL / macOS | Windows PowerShell |
|---|---|---|
| Gọi API | `curl localhost:3000/api/health` | `curl.exe localhost:3000/api/health` |
| Xem event một phiên | `curl "localhost:3000/api/events?session_id=X" \| jq '.[] \| {event_name, screen_name, step_index}'` | `Invoke-RestMethod "localhost:3000/api/events?session_id=X" \| Select-Object event_name, screen_name, step_index \| Format-Table` |
| Tìm tiến trình chiếm cổng | `lsof -ti:3000` | `netstat -ano \| findstr :3000` |
| Kích hoạt venv Python | `source .venv/bin/activate` | `.venv\Scripts\Activate.ps1` |
| Xoá `node_modules` | `rm -rf node_modules` | `Remove-Item -Recurse -Force node_modules` |

Hai điều dễ vấp:

- **Dùng `curl.exe`, đừng dùng `curl`.** Trên PowerShell 5.1 (bản mặc định của Windows) `curl` là alias của `Invoke-WebRequest` — cú pháp khác hẳn và cờ `-s` mang nghĩa khác. Trên PowerShell 7+ alias đó đã bị bỏ. `curl.exe` đúng trên cả hai bản.
- **`jq` không có sẵn trên Windows.** Vì vậy dòng thứ hai không phải bản dịch từng chữ: `Invoke-RestMethod` tự parse JSON thành object nên dùng `Select-Object` thay cho `jq`.

> Các lệnh PowerShell trên **chưa được chạy thử** trong môi trường này (dự án đang phát triển trên WSL). Chúng dựa trên hành vi đã biết của PowerShell 5.1/7 — ai dùng Windows nên xác nhận lại rồi sửa vào đây nếu lệch.

---

## Lệnh hay dùng

Chạy từ thư mục **gốc**:

| Lệnh | Việc |
|---|---|
| `npm install` | Cài dependency |
| `npm run dev` | Chạy app ở :3000 — cả giao diện lẫn `/api/*` |
| `npm run dev:api` / `npm run dev:web` | Chỉ một bên — hữu ích khi debug |
| `npm run build` | Bắt lỗi TypeScript + webpack trước khi demo |
| `npm run typecheck` | Kiểm tra type, không build |
| `npm run lint` | ESLint |
| `curl localhost:3000/api/health` | App sống chưa (Windows: `curl.exe`) |
| `curl localhost:3000/api/health` | Proxy thông chưa (Windows: `curl.exe`) |
| `curl "localhost:3000/api/events?session_id=..."` | Xem event của một phiên (Windows: `Invoke-RestMethod`) |

Dừng server: `Ctrl+C` ở terminal đang chạy `npm run dev` — tắt cả hai tiến trình cùng lúc.

---
