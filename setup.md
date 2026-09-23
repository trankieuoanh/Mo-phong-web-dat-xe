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

Luôn vào cổng **3000**. Cổng 4000 là BE, Next.js tự proxy `/api/*` sang đó — đừng mở thẳng 4000 bằng trình duyệt.

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
rm -rf node_modules apps/*/node_modules packages/*/node_modules && npm install
```
```powershell
# Windows PowerShell — `rmdir /s /q` là lệnh của cmd.exe, không chạy ở đây
Remove-Item -Recurse -Force node_modules, apps\*\node_modules, packages\*\node_modules -ErrorAction SilentlyContinue
npm install
```

---

## Phase 0 — Monorepo chạy được, chưa có Firebase

Khung đã có sẵn trong repo. Chỉ cần:

```bash
npm install     # ở thư mục GỐC — npm workspaces cài cho cả 3 workspace
npm run dev     # chạy song song apps/api (:4000) + apps/web (:3000)
```

Kiểm tra **theo đúng thứ tự này** — hai lệnh, không phải một:

```bash
# WSL / macOS
curl localhost:4000/api/health      # 1. BE sống      → {"status":"ok"}
curl localhost:3000/api/health      # 2. proxy thông  → {"status":"ok"}
```
```powershell
# Windows PowerShell — xem mục "Lệnh tương đương trên Windows" bên dưới
curl.exe localhost:4000/api/health
curl.exe localhost:3000/api/health
```

Route `/api/health` **không chạm Firestore** (xem `api-endpoints.md`), nên nó xác nhận Express chạy đúng trước khi credential vào cuộc. Đừng bỏ qua — nếu bỏ, lỗi Firebase và lỗi Express sẽ trộn vào nhau và rất khó tách.

**Bước 2 hỏng mà bước 1 chạy** → sai `rewrites` trong `apps/web/next.config.ts`, không phải sai Express. Hai lỗi này trông giống hệt nhau từ phía trình duyệt nên phải tách bằng hai lệnh curl.

Mở `http://localhost:3000` → thấy màn Home: panel đặt xe bên trái, bản đồ bên phải, tab "Đặt xe" sáng ở sidebar.

---

## Phase 1 — Firebase

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project** → đặt tên (ví dụ `gsm-simulation`) → tắt Google Analytics (không cần).
2. **Build → Firestore Database → Create database** → chọn **Production mode** → region `asia-southeast1` (Singapore, gần Việt Nam nhất).
3. **Project settings → Service accounts → Generate new private key** → tải file JSON về.
4. Mở file JSON, lấy 3 giá trị `project_id`, `client_email`, `private_key` đưa vào **`apps/api/.env`** (copy từ `apps/api/.env.example`).

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

Chỉ **`apps/api`** cần biến môi trường. `apps/web` không có biến nào bí mật — nó không biết Firebase tồn tại.

`apps/api/.env` (đã có trong `.gitignore` — kiểm tra lại cho chắc):

```bash
FIREBASE_PROJECT_ID=gsm-simulation
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@gsm-simulation.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"
PORT=4000
WEB_ORIGIN=http://localhost:3000

# Tuỳ chọn — địa chỉ liên hệ gắn vào User-Agent khi gọi Nominatim.
# Có giá trị mặc định nên bỏ trống vẫn chạy được.
NOMINATIM_CONTACT=ban@example.com
```

File `apps/api/.env.example` đã commit sẵn với giá trị trống, để người khác clone repo biết cần những biến gì.

**`NOMINATIM_CONTACT`** phục vụ endpoint `GET /api/places` (tìm địa chỉ thật). [Điều khoản dùng Nominatim](https://operations.osmfoundation.org/policies/nominatim/) bắt buộc mỗi request mang `User-Agent` định danh ứng dụng kèm cách liên hệ; thiếu nó thì OSM có quyền chặn IP. Đây cũng là lý do endpoint này phải nằm ở `apps/api` chứ không gọi thẳng từ trình duyệt — **trình duyệt không cho JavaScript đặt header `User-Agent`**.

Không cần API key: Nominatim miễn phí. Đổi lại nó giới hạn **1 request/giây**, nên hàng đợi và cache nằm ở `apps/api/src/services/upstream.ts`; xem `api-endpoints.md` mục 3b.

### Bốn dịch vụ ngoài mà app gọi

| Dịch vụ | Dùng cho | API key | Khi nó chết |
|---|---|---|---|
| **Photon** (`photon.komoot.io`) | `GET /api/places`, `GET /api/reverse` — địa chỉ | không | Panel hiện cảnh báo, vẫn liệt kê 5 địa chỉ gợi ý; nhãn địa chỉ lùi về mặc định |
| **Overpass** (`overpass-api.de`) | `GET /api/restaurants` — quán ăn | không | Dải "Gần bạn" hiện lỗi kèm nút Thử lại; ba cách tìm món còn lại vẫn chạy |
| **OSRM** (`router.project-osrm.org`) | `GET /api/route` — tuyến đường | không | Dùng đường nối thẳng, ghi `route_source: "straight"` |
| **Tile Stadia** (`tiles.stadiamaps.com`) | Nền bản đồ trong `MapCanvas` | không, khi chạy localhost | Tự chuyển sang `tile.openstreetmap.fr`; hết đường thì hiện "Không tải được nền bản đồ" |

Cả bốn là **hạ tầng cộng đồng miễn phí**, chỉ hợp cho demo cục bộ.

> **Stadia chặn theo `Referer`.** Gọi không kèm header đó sẽ nhận `401` — nên `curl` trần sẽ báo tile chết trong khi trình duyệt vẫn tải được bình thường. Thêm `-e http://localhost:3000/` khi tự kiểm tra. Nếu sau này đem deploy lên hosting thật thì phải đăng ký một tài khoản Stadia miễn phí; dự án này chỉ chạy localhost nên chưa cần.

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
2. Trong file `.env` ký tự xuống dòng nằm ở dạng literal `\n`, phải `.replace(/\\n/g, '\n')` khi đọc, nếu không sẽ lỗi `error:1E08010C:DECODER routines::unsupported`. Code trong `apps/api/src/db/firebase-admin.ts` đã xử lý sẵn.
3. Không thêm `NEXT_PUBLIC_` vào bất kỳ biến nào ở trên — tiền tố đó nhúng giá trị thẳng vào bundle trình duyệt, tức là **công khai service account key**. (Ở `apps/api` thì tiền tố này vô nghĩa, nhưng đừng copy nhầm sang `apps/web`.)

`tsx` tự đọc `apps/api/.env` qua cờ `--env-file-if-exists` trong script `dev` — không cần cài `dotenv`.

---

## Khởi tạo Firebase Admin SDK

Đã có sẵn ở `apps/api/src/db/firebase-admin.ts`. Ba chi tiết **bắt buộc**, đừng lược bỏ khi sửa:

- **`getApps()[0] ??`** — `tsx watch` chạy lại module nhiều lần trong cùng một tiến trình. Gọi `initializeApp()` thẳng sẽ ném `The default Firebase app already exists` ngay lần sửa file thứ hai.
- **`.replace(/\\n/g, '\n')`** — xem mục biến môi trường ở trên.
- **Khởi tạo trễ (lazy)** — `getDb()` chỉ chạy `initializeApp` ở request đầu tiên thực sự cần Firestore. Nhờ vậy `GET /api/health` trả lời được ngay cả khi chưa có credential, đúng mục đích của route đó.

Bản trước dùng `import 'server-only'` để chặn rò credential. Không còn cần nữa: `server-only` là package riêng của Next.js, mà `apps/api` không phải Next.js — và hàng rào giờ mạnh hơn, xem `CLAUDE.md` quy tắc 1.

---

## Composite index

Query kết hợp nhiều điều kiện (ví dụ `where('flow')` + `where('created_at' >=)` + `orderBy`) sẽ bị Firestore từ chối kèm **một link tạo index sẵn trong thông báo lỗi**. Bấm link đó, đợi index build xong (~1 phút), chạy lại. Không cần đoán trước index nào — cứ chạy, lỗi sẽ chỉ đường (xem `db-design.md`).

---

## Phần phân tích (từ Tuần 5)

`analysis/` **không phải npm workspace** — nó là project Python, để ngoài `apps/` có chủ ý.

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
| 3 | `apps/api/.env` → 3 biến `FIREBASE_*` | **Mặc định.** Ai chạy được `npm run dev` thì chạy được luôn script này |

Nhờ đường 3 mà **không phải tải thêm service account key JSON nào** — bắt tải là tạo ra file bí mật thứ hai phải quản lý, cho đúng một quyền truy cập.

> **Trước đây đường 2 là thứ tài liệu hứa nhưng code không có.** `fetch_events.py` đọc thẳng `os.environ`, mà không chỗ nào nạp `analysis/.env`, nên làm đúng y hướng dẫn thì script vẫn báo thiếu credential — phải tự `export` ngoài shell. Giờ nó nạp file đó thật.

Script Python dựng credential từ dict (`type`, `project_id`, `client_email`, `private_key`, `token_uri`) thay vì đọc file JSON — cùng ba biến mà `apps/api/src/db/firebase-admin.ts` dùng, kể cả dòng `.replace('\\n', '\n')` cho private key.

### Seed dữ liệu giả lập

`scripts/seed-events.js` cũng dùng đúng cơ chế đó (thử `serviceAccountKey.json` ở gốc repo trước, không có thì đọc `apps/api/.env`):

```bash
node scripts/seed-events.js --dry-run   # xem trước, không cần credential
node scripts/seed-events.js             # ghi ~7.800 document
node scripts/seed-events.js --clear     # dọn lại, chỉ xoá document có seed_batch
```

---

## `.gitignore` — kiểm tra có đủ

```
node_modules/
apps/web/.next/
apps/api/.env
apps/web/.env.local
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

Lần chạy trước chưa tắt hẳn. Hai app báo khác nhau:

```
[web] Error: listen EADDRINUSE: address already in use :::3000
[api] Cong 4000 dang bi chiem — nhieu kha nang lan chay truoc chua tat han.
```

Tìm và kết thúc tiến trình:

```bash
lsof -ti:3000 | xargs kill -9        # WSL/macOS — đổi 3000 thành 4000 nếu cần
```
```powershell
netstat -ano | findstr :3000         # Windows — cột cuối là PID
taskkill /PID <PID> /F
```

### Trang mở được nhưng mọi thứ gọi API cứ quay mãi

Ô tìm địa chỉ quay skeleton không bao giờ dứt, bản đồ không vẽ tuyến, dải "Gần bạn" trống — mà **không có lỗi nào in ra**, kể cả `EADDRINUSE`.

Nguyên nhân thường gặp: lần `npm run dev` trước bị **Ctrl+Z** (treo) chứ không tắt hẳn. Tiến trình ở trạng thái đó **vẫn giữ cổng 4000** nên socket vẫn `LISTEN` và bắt tay TCP thành công — nhưng nó bị dừng nên **không bao giờ trả lời**. Lần chạy mới thấy cổng bận, còn trình duyệt thì chỉ thấy request treo vô hạn.

Nhận ra bằng cột `STAT` có chữ **`T`**:

```bash
ps -eo pid,stat,args | grep Mo-phong-web-dat-xe | grep -v grep
#   33547 Tl   node ... src/server.ts      ← T = đã bị treo
```

Dọn (phải `-9`: tiến trình đang dừng không xử lý `SIGTERM`):

```bash
ps -eo pid,stat,args | grep Mo-phong-web-dat-xe | grep -v grep \
  | awk '$2 ~ /T/ {print $1}' | xargs -r kill -9
ss -ltn | grep -E ":3000|:4000"      # phải không in gì
npm run dev
```

> Tắt bằng **Ctrl+C**, không phải Ctrl+Z. Ctrl+Z chỉ đẩy tiến trình vào nền ở trạng thái dừng.

Từ phía FE, ô tìm địa chỉ giờ **bỏ cuộc sau 6 giây** và hiện cảnh báo kèm 5 gợi ý thay vì quay mãi (`REQUEST_TIMEOUT_MS` trong `apps/web/lib/use-place-search.ts`) — nhưng đó chỉ là đường lui, BE vẫn phải dọn.

### `:4000/api/health` trả OK nhưng `:3000/api/health` hỏng
Sai `rewrites` trong `apps/web/next.config.ts` — **không phải** sai Express. BE vẫn sống, chỉ là Next.js không chuyển tiếp request sang nó.

Đây chính là lý do Phase 0 bắt kiểm tra bằng **hai** lệnh curl: từ phía trình duyệt, "BE chết" và "proxy hỏng" trông giống hệt nhau.

### `POST /api/events` trả 500, app vẫn click được bình thường
Chưa có `apps/api/.env` — đúng như mô tả ở mục [Chạy nhanh](#chạy-nhanh). Xem log của tiến trình `[api]`, nó ghi rõ thiếu biến nào:

```
Thieu bien moi truong Firebase: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.
```

Làm Phase 1 để sửa. Event bị mất nhưng luồng UI không vỡ — đó là chủ ý của `trackEvent` (`screen-map.md` mục 4), không phải lỗi.

### `error:1E08010C:DECODER routines::unsupported`
`FIREBASE_PRIVATE_KEY` trong `apps/api/.env` thiếu **dấu nháy kép** bao quanh. Key chứa ký tự xuống dòng nên bắt buộc phải có. Xem mục [Biến môi trường](#biến-môi-trường).

### `The default Firebase app already exists`
Mất `getApps()[0] ??` trong `apps/api/src/db/firebase-admin.ts`. `tsx watch` chạy lại module nhiều lần trong cùng một tiến trình, nên `initializeApp()` gọi thẳng sẽ ném lỗi ngay lần sửa file thứ hai.

### Bản đồ hiện chữ "API KEY REQUIRED" chéo trên mọi tile

Nhà cung cấp tile đã chuyển sang bắt buộc API key. Đây **không phải lỗi Google Maps** — dự án không dùng Google Maps, không dùng thư viện bản đồ nào, và không có API key nào cả (`CLAUDE.md` quy tắc 8).

Chuyện đã xảy ra một lần với CARTO: họ khoá **toàn bộ** raster miễn phí (`light_all`, `voyager`, cả tên miền cũ `cartodb-basemaps-*.global.ssl.fastly.net`), nhưng vẫn trả HTTP 200 kèm PNG hợp lệ — chỉ là đã in chữ lên. Vì `onError` của thẻ `<img>` không bao giờ bắn, cơ chế tự chuyển nhà cung cấp trong `MapCanvas.tsx` **không cứu được**.

Xem nhà cung cấp nào còn dùng được:
```bash
curl localhost:3000/api/tiles
```

Nhà cung cấp bị đóng dấu sẽ **vắng mặt** trong danh sách trả về. Nếu danh sách trống hoặc thiếu đúng cái đang cần, thêm một nhà cung cấp mới vào `TILE_PROVIDERS` ở `packages/shared/src/tiles.ts` — **đừng** đi đăng ký API key rồi nhét vào `NEXT_PUBLIC_*`, tiền tố đó nhúng giá trị thẳng vào bundle trình duyệt (quy tắc 2).

Tự kiểm tra một nhà cung cấp mới trước khi thêm, bằng đúng tile biển sâu mà phép dò dùng:
```bash
curl -so /dev/null -w '%{size_download}\n' <URL tile z=13 x=6707 y=3740>
```
Dưới 800 byte là sạch. Trên ngưỡng đó nghĩa là giữa Biển Đông đang có chữ.

### Số `screen_view` nhiều gấp đôi số màn đã đi qua
`useRef` chưa chặn được lần chạy thứ hai của React Strict Mode trong `next dev`. Nếu không sửa thì **mọi tỉ lệ funnel đều sai gấp đôi** — xem `screen-map.md` mục 4.

Kiểm tra bằng lệnh ở cuối `CLAUDE.md`, đếm số dòng `screen_view`.

### `Module not found: Can't resolve './types.js'`
Import nội bộ trong `packages/shared` có đuôi `.js`. Webpack của Next không resolve `.js` về `.ts`, trong khi `tsx` thì chấp nhận — nên lỗi này **chỉ hiện ở `npm run build`, không hiện khi chạy BE**. Bỏ đuôi `.js` đi:

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
| Gọi API | `curl localhost:4000/api/health` | `curl.exe localhost:4000/api/health` |
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
| `npm install` | Cài cho cả 3 workspace một lần |
| `npm run dev` | Chạy song song `apps/api` (:4000) + `apps/web` (:3000) |
| `npm run dev:api` / `npm run dev:web` | Chỉ một bên — hữu ích khi debug |
| `npm run build` | Build `apps/web`, bắt lỗi TypeScript trước khi demo |
| `npm run typecheck` | Kiểm tra type cả 3 workspace, không build |
| `npm run lint` | ESLint |
| `curl localhost:4000/api/health` | BE sống chưa (Windows: `curl.exe`) |
| `curl localhost:3000/api/health` | Proxy thông chưa (Windows: `curl.exe`) |
| `curl "localhost:3000/api/events?session_id=..."` | Xem event của một phiên (Windows: `Invoke-RestMethod`) |

Dừng server: `Ctrl+C` ở terminal đang chạy `npm run dev` — tắt cả hai tiến trình cùng lúc.
