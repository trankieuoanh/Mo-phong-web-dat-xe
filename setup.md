# setup.md — GSM ride-booking simulation

Hướng dẫn chạy dự án + dựng môi trường local. Làm đúng thứ tự: **Phase 0 chạy được app trước khi đụng tới Firebase.**

Gặp lỗi khi chạy → nhảy thẳng xuống mục [Gặp lỗi?](#gặp-lỗi) ở gần cuối file.

## Yêu cầu
- Node.js **20 LTS trở lên** (Next.js 15 cần ≥ 18.18; 20 là bản an toàn nhất).
- npm (có sẵn cùng Node).
- Một tài khoản Google để tạo Firebase project — **chỉ cần từ Phase 1**.
- Python **3.10+** (chỉ cần từ Tuần 5, cho phần phân tích).

---

## Chạy nhanh

```bash
npm install     # ở thư mục GỐC của repo
npm run dev
```

Mở **http://localhost:3000** → thấy màn Home: panel đặt xe bên trái, bản đồ bên phải, tab "Đặt xe" sáng ở sidebar.

> **Chưa cần Firebase để chạy.** App lên được, click hết cả hai luồng (Đặt xe / Food) được, chỉ là event không lưu xuống đâu cả — `POST /api/events` sẽ trả 500. Muốn lưu event mới cần làm Phase 1.
>
> Nói cách khác: từ lúc clone tới lúc thấy app chạy là **2 lệnh**, không phải cả quy trình Firebase.

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

## Phase 0 — App chạy được, chưa có Firebase

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

Route `/api/health` **không chạm Firestore** và không import gì từ `lib/server/db` (xem `api-endpoints.md`), nên nó xác nhận app chạy đúng trước khi credential vào cuộc. Đừng bỏ qua — nếu bỏ, lỗi Firebase và lỗi khởi động sẽ trộn vào nhau và rất khó tách.

> Bản trước tách làm hai process và mục này từng bắt chạy **hai** lệnh curl (`:4000` rồi `:3000`) để tách lỗi Express khỏi lỗi proxy. Giờ không còn proxy nên chỉ còn một lệnh.

Mở `http://localhost:3000` → thấy màn Home: panel đặt xe bên trái, bản đồ bên phải, tab "Đặt xe" sáng ở sidebar.

---

## Phase 1 — Firebase

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project** → đặt tên (ví dụ `gsm-simulation`) → tắt Google Analytics (không cần).
2. **Build → Firestore Database → Create database** → chọn **Production mode** → region `asia-southeast1` (Singapore, gần Việt Nam nhất).
3. **Project settings → Service accounts → Generate new private key** → tải file JSON về.
4. Mở file JSON, lấy 3 giá trị `project_id`, `client_email`, `private_key` đưa vào **`.env.local`** ở gốc repo (copy từ `.env.example`).

> **Không lưu file JSON trong repo**, kể cả ngoài thư mục `app/`. Chỉ copy 3 giá trị vào biến môi trường.

### Quy tắc bảo mật Firestore
Vì client **không bao giờ** nói chuyện trực tiếp với Firestore (xem `ARCHITECTURE.md`), rule có thể khoá hoàn toàn — Admin SDK bỏ qua rule:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if false; }
  }
}
```

---

## Biến môi trường

**Chỉ còn bốn biến, tất cả ở một file duy nhất.** `.env.local` ở gốc repo (đã có trong `.gitignore` — kiểm tra lại cho chắc):

```bash
FIREBASE_PROJECT_ID=gsm-simulation
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@gsm-simulation.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"

# Tuỳ chọn — địa chỉ liên hệ gắn vào User-Agent khi gọi Photon/Overpass.
# Có giá trị mặc định nên bỏ trống vẫn chạy được.
NOMINATIM_CONTACT=ban@example.com
```

Next.js **tự nạp `.env.local`** cho cả `npm run dev` lẫn `npm run build` — không cần cờ, không cần `dotenv`. `scripts/seed-events.js` và `analysis/` cũng đọc đúng file này.

File `.env.example` đã commit sẵn với giá trị trống, để người khác clone repo biết cần những biến gì.

> **Ba biến đã biến mất khi gộp một project**, ghi ra đây để không ai đi tìm: `PORT` (chỉ còn một process), `API_ORIGIN` (không còn proxy), và `WEB_ORIGIN` — phép dò tile giờ lấy origin từ **chính request** (`app/api/tiles/route.ts`), nên không còn biến nào để đặt sai. Bản trước đặt sai đúng biến đó chính là thứ đã làm bản đồ trả 401 trên bản deploy.

**`NOMINATIM_CONTACT`** phục vụ endpoint `GET /api/places` (tìm địa chỉ thật). [Điều khoản dùng Nominatim](https://operations.osmfoundation.org/policies/nominatim/) bắt buộc mỗi request mang `User-Agent` định danh ứng dụng kèm cách liên hệ; thiếu nó thì OSM có quyền chặn IP. Đây cũng là lý do endpoint này phải nằm ở server chứ không gọi thẳng từ trình duyệt — **trình duyệt không cho JavaScript đặt header `User-Agent`**.

Không cần API key: Nominatim miễn phí. Đổi lại nó giới hạn **1 request/giây**, nên hàng đợi và cache nằm ở `lib/server/services/upstream.ts`; xem `api-endpoints.md` mục 3b.

### Bốn dịch vụ ngoài mà app gọi

| Dịch vụ | Dùng cho | API key | Khi nó chết |
|---|---|---|---|
| **Photon** (`photon.komoot.io`) | `GET /api/places`, `GET /api/reverse` — địa chỉ | không | Panel hiện cảnh báo, vẫn liệt kê 5 địa chỉ gợi ý; nhãn địa chỉ lùi về mặc định |
| **Overpass** (`overpass-api.de`) | `GET /api/restaurants` — quán ăn | không | Dải "Gần bạn" hiện lỗi kèm nút Thử lại; ba cách tìm món còn lại vẫn chạy |
| **OSRM** (`router.project-osrm.org`) | `GET /api/route` — tuyến đường | không | Dùng đường nối thẳng, ghi `route_source: "straight"` |
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
>   https://tiles.stadiamaps.com/tiles/osm_bright/13/6720/3638.png
> curl -s -o /dev/null -w '%{http_code}\n' https://overpass-api.de/api/status
> curl -s -o /dev/null -w '%{http_code}\n' 'https://photon.komoot.io/reverse?lat=21.03&lon=105.78'
> ```
> Cả ba phải ra `200`. Cái nào ra `000` thì tính năng tương ứng sẽ hỏng **im lặng** chứ không báo lỗi rõ ràng. `api-endpoints.md` đã chốt không deploy công khai trước khi sinh xong dữ liệu — điều đó giờ còn thêm một lý do nữa.

Không có mạng thì app **vẫn chạy hết luồng**: chỉ mất bản đồ nền và độ chính xác của quãng đường.

**Ba lỗi kinh điển với `FIREBASE_PRIVATE_KEY`:**
1. Phải **có dấu nháy kép** bao quanh — key chứa ký tự xuống dòng.
2. Trong file `.env` ký tự xuống dòng nằm ở dạng literal `\n`, phải `.replace(/\\n/g, '\n')` khi đọc, nếu không sẽ lỗi `error:1E08010C:DECODER routines::unsupported`. Code trong `lib/server/db/firebase-admin.ts` đã xử lý sẵn.
3. Không thêm `NEXT_PUBLIC_` vào bất kỳ biến nào ở trên — tiền tố đó nhúng giá trị thẳng vào bundle trình duyệt, tức là **công khai service account key**. Điều này **nguy hiểm hơn trước**: giờ `.env.local` là của chính project Next.js, tức đúng nơi tiền tố đó có hiệu lực thật.

---

## Khởi tạo Firebase Admin SDK

Đã có sẵn ở `lib/server/db/firebase-admin.ts`. Ba chi tiết **bắt buộc**, đừng lược bỏ khi sửa:

- **`getApps()[0] ??`** — hot-reload của `next dev` chạy lại module nhiều lần trong cùng một tiến trình. Gọi `initializeApp()` thẳng sẽ ném `The default Firebase app already exists` ngay lần sửa file thứ hai.
- **`.replace(/\\n/g, '\n')`** — xem mục biến môi trường ở trên.
- **Khởi tạo trễ (lazy)** — `getDb()` chỉ chạy `initializeApp` ở request đầu tiên thực sự cần Firestore. Nhờ vậy `GET /api/health` trả lời được ngay cả khi chưa có credential, đúng mục đích của route đó.

- **`import 'server-only'` ở dòng đầu** — đây là hàng rào chặn credential rò xuống trình duyệt. Kéo file này (hoặc bất kỳ service nào trong `lib/server/`) vào một Client Component là **build đỏ ngay**. Xem `CLAUDE.md` quy tắc 1; đừng gỡ dòng đó ra.

---

## Composite index

Query kết hợp nhiều điều kiện (ví dụ `where('flow')` + `where('created_at' >=)` + `orderBy`) sẽ bị Firestore từ chối kèm **một link tạo index sẵn trong thông báo lỗi**. Bấm link đó, đợi index build xong (~1 phút), chạy lại. Không cần đoán trước index nào — cứ chạy, lỗi sẽ chỉ đường (xem `db-design.md`).

---

## Deploy

Không bắt buộc — `techstack.md` đã chốt chạy local là đủ để demo. Mục này dành cho khi thực sự cần một link truy cập từ xa.

**Một project = một nơi deploy.** Vercel tự nhận Next.js ở gốc repo, nên không cần `vercel.json`, không cần khai build command, và không có server thứ hai nào để quên.

> **Bản trước phải deploy HAI nơi, và đó chính là thứ đã hỏng.** Deploy mỗi `apps/web` thì `rewrites` vẫn trỏ về `http://localhost:4000`, Vercel trả `404 DNS_HOSTNAME_RESOLVED_PRIVATE` cho **mọi** `/api/*` — bản đồ 401, ô tìm địa chỉ chết, và **không một event nào được ghi** mà app không báo gì (vì `lib/track.ts` cố ý nuốt lỗi). Gộp một project là cách sửa tận gốc chế độ hỏng đó. Xem `ARCHITECTURE.md`.

### Biến môi trường trên Vercel

Đúng bốn biến, y hệt `.env.local`:

| Biến | Ghi chú |
|---|---|
| `FIREBASE_PROJECT_ID` | copy từ `.env.local` |
| `FIREBASE_CLIENT_EMAIL` | copy từ `.env.local` |
| `FIREBASE_PRIVATE_KEY` | dán dạng có `\n` **literal** — `lib/server/db/firebase-admin.ts` đã `.replace(/\\n/g, '\n')` |
| `NOMINATIM_CONTACT` | email liên hệ (điều khoản OSM) |

**Tuyệt đối không thêm tiền tố `NEXT_PUBLIC_`** (CLAUDE.md quy tắc 2) — tiền tố đó nhúng giá trị vào bundle trình duyệt, tức công khai service account key.

Không có biến nào khác: không `PORT`, không `API_ORIGIN`, không `WEB_ORIGIN`.

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

**Hàng đợi rate-limit yếu đi trên serverless.** `lib/server/services/upstream.ts` giữ hàng đợi và cache trong bộ nhớ một tiến trình; mỗi lambda instance của Vercel có bộ nhớ riêng. Nếu bị Photon/Overpass chặn IP giữa buổi demo thì đây là chỗ đầu tiên nhìn vào, không phải lỗi mạng.

---

## Phần phân tích (từ Tuần 5)

`analysis/` **không phải một phần của app Next.js** — nó là project Python riêng, và đọc thẳng Firestore chứ không gọi qua `/api`.

```
analysis/
  requirements.txt      # firebase-admin, pandas, matplotlib
  fetch_events.py       # kéo collection events → output/events.csv
  metrics.py            # tính chỉ số theo analysis-spec.md
  output/               # .gitignore — CSV và biểu đồ sinh ra
  .env                  # .gitignore — TUỲ CHỌN, xem bên dưới
```

```bash
# WSL / macOS
cd analysis
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
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

### Credential cho phần Python — không cần cấu hình gì thêm

`fetch_events.py` thử **ba đường**, theo thứ tự:

| # | Nguồn | Khi nào dùng |
|---|---|---|
| 1 | Biến `GOOGLE_APPLICATION_CREDENTIALS` đã export sẵn | Chạy trên CI, hoặc bạn tự export |
| 2 | `analysis/.env` → cùng biến đó | Khi muốn đọc một project Firebase **khác** |
| 3 | `.env.local` → 3 biến `FIREBASE_*` | **Mặc định.** Ai chạy được `npm run dev` thì chạy được luôn script này |

Nhờ đường 3 mà **không phải tải thêm service account key JSON nào** — bắt tải là tạo ra file bí mật thứ hai phải quản lý, cho đúng một quyền truy cập.

> **Trước đây đường 2 là thứ tài liệu hứa nhưng code không có.** `fetch_events.py` đọc thẳng `os.environ`, mà không chỗ nào nạp `analysis/.env`, nên làm đúng y hướng dẫn thì script vẫn báo thiếu credential — phải tự `export` ngoài shell. Giờ nó nạp file đó thật.

Script Python dựng credential từ dict (`type`, `project_id`, `client_email`, `private_key`, `token_uri`) thay vì đọc file JSON — cùng ba biến mà `lib/server/db/firebase-admin.ts` dùng, kể cả dòng `.replace('\\n', '\n')` cho private key.

### Seed dữ liệu giả lập

`scripts/seed-events.js` cũng dùng đúng cơ chế đó (thử `serviceAccountKey.json` ở gốc repo trước, không có thì đọc `.env.local`):

```bash
node scripts/seed-events.js --dry-run   # xem trước, không cần credential
node scripts/seed-events.js             # ghi ~7.800 document
node scripts/seed-events.js --clear     # dọn lại, chỉ xoá document có seed_batch
```

---

## `.gitignore` — kiểm tra có đủ

```
node_modules/
.next/
.env
.env*.local
serviceAccount*.json
*.json.key
analysis/.venv/
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
Chưa có `.env.local` — đúng như mô tả ở mục [Chạy nhanh](#chạy-nhanh). Xem log của terminal đang chạy `npm run dev`, nó ghi rõ thiếu biến nào:

```
Thieu bien moi truong Firebase: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.
```

Làm Phase 1 để sửa. Event bị mất nhưng luồng UI không vỡ — đó là chủ ý của `trackEvent` (`screen-map.md` mục 4), không phải lỗi.

### `error:1E08010C:DECODER routines::unsupported`
`FIREBASE_PRIVATE_KEY` trong `.env.local` thiếu **dấu nháy kép** bao quanh. Key chứa ký tự xuống dòng nên bắt buộc phải có. Xem mục [Biến môi trường](#biến-môi-trường).

### `The default Firebase app already exists`
Mất `getApps()[0] ??` trong `lib/server/db/firebase-admin.ts`. Hot-reload của `next dev` chạy lại module nhiều lần trong cùng một tiến trình, nên `initializeApp()` gọi thẳng sẽ ném lỗi ngay lần sửa file thứ hai.

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

### Event trên bản deploy không vào Firestore, app vẫn click bình thường

Đúng thiết kế của `lib/track.ts`: lỗi mạng bị nuốt để không bao giờ kẹt UI. Nên mọi hỏng hóc ở đường ghi event đều **im lặng**, phải đi tìm bằng tay:

```bash
curl -s -w '\n[%{http_code}]\n' -X POST https://<app>.vercel.app/api/events \
  -H 'Content-Type: application/json' -d '{}'
```

`400` kèm `Missing required field: session_id` nghĩa là route sống và validator chạy — vấn đề nằm ở credential Firebase trên Vercel. `500` nghĩa là ghi Firestore hỏng; đọc log function trên Vercel.

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
