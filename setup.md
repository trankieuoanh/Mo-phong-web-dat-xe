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

Mở **http://localhost:3000** → thấy màn Home với 2 nút lớn.

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

Mở `http://localhost:3000` → thấy màn Home với 2 nút lớn.

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

### Ba dịch vụ ngoài mà app gọi

| Dịch vụ | Dùng cho | API key | Khi nó chết |
|---|---|---|---|
| **Nominatim** (`nominatim.openstreetmap.org`) | `GET /api/places` — tìm địa chỉ | không | Panel hiện cảnh báo, vẫn liệt kê 5 địa chỉ gợi ý |
| **OSRM** (`router.project-osrm.org`) | `GET /api/route` — tuyến đường | không | Dùng đường nối thẳng, ghi `route_source: "straight"` |
| **Tile OSM** (`tile.openstreetmap.org`) | Nền bản đồ trong `MapCanvas` | không | Bản đồ trắng, tuyến và ghim vẫn vẽ |

Cả ba là **hạ tầng cộng đồng miễn phí**, chỉ hợp cho demo cục bộ. `api-endpoints.md` đã chốt không deploy công khai trước khi sinh xong dữ liệu — điều đó giờ còn thêm một lý do nữa.

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
  .env                  # .gitignore — đường dẫn tới service account JSON
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

Script Python dùng file service account JSON trực tiếp (`GOOGLE_APPLICATION_CREDENTIALS`), khác với app Next.js dùng 3 biến môi trường — vì script chạy offline, không qua hosting.

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
