# techstack.md — GSM ride-booking simulation

## Chốt tech stack (thay thế bản Postgres/Node/Express trước đó)

| Lớp | Trước đây | Bây giờ |
|---|---|---|
| Frontend | React (web, Vite) | **Next.js** (App Router) |
| Backend | Node/Express (`server/` riêng) | **Next.js Route Handlers** (`app/api/**`) — xem mục "Kiến trúc" bên dưới |
| Database | Postgres (Supabase-hosted) | **Firestore** (Firebase) |
| Platform | chưa chốt | **Firebase** |
| Phân tích | Python/pandas đọc Postgres | Python/pandas đọc Firestore (qua Firebase Admin SDK) |

## Các lựa chọn còn lại (mình chọn giúp, theo hướng đơn giản nhất cho quy mô 6 tuần)

| Hạng mục | Chọn | Vì sao |
|---|---|---|
| Ngôn ngữ | **TypeScript** | Bắt lỗi sai kiểu dữ liệu event sớm (vd gõ nhầm tên field) — hữu ích khi schema 17 trường còn đang hoàn thiện dần |
| Styling | **Tailwind CSS** | Ghép trực tiếp với design token (token → class Tailwind), giống cách tổ chức bạn đã dùng ở dự án khác (P-222) |
| Quản lý state trong app | **React state có sẵn** (`useState`/`useContext`) | App chỉ vài màn hình, giỏ hàng đơn giản — không cần Redux/Zustand |
| Gọi API từ client | **`fetch` có sẵn của trình duyệt** | Không cần cài thêm axios cho vài endpoint đơn giản |
| Package manager | **npm** | Một `package.json` duy nhất. Từng dùng npm workspaces cho bản hai app; gộp lại thì không còn gì để workspace |
| Hosting (nếu cần deploy) | **Vercel** | Tự nhận Next.js ở gốc repo, không cần `vercel.json`. Một project = **một nơi deploy**, và đó chính là thứ sửa được lỗi bản deploy cũ |
| Testing framework | **Không cần** | Quy mô 6 tuần, tự test bằng cách click tay qua từng luồng là đủ, không cần viết test tự động |

Lưu ý: không bắt buộc phải deploy public trong 6 tuần này — chạy local (`next dev`) để demo cho mentor là đủ. Chỉ cần deploy khi muốn có link truy cập từ xa; các bước và biến môi trường ở `setup.md` mục "Deploy".

## Kiến trúc: một project Next.js — và vì sao quyết định này đã lật hai lần

Đây là chỗ dễ gây hoang mang nhất khi đọc lịch sử dự án, nên ghi thẳng ra:

| Lần | Hình dạng | Lý do |
|---|---|---|
| 1 | Một Next.js, API routes chung | Đơn giản, một lệnh chạy |
| 2 | Tách `apps/web` + `apps/api` (Express) | Ưu tiên chia việc trong nhóm; hàng rào credential là **vật lý** |
| **3 (hiện tại)** | **Quay về một Next.js** | **Deploy** — xem ngay dưới |

```
app/            giao diện + app/api/** (route handler)
lib/shared/     hợp đồng dữ liệu dùng chung
lib/server/     validator · service · db — chỉ app/api/** được import
analysis/       Python, đọc thẳng Firestore
```

**Thứ đã lật quyết định lần 3 không phải sở thích, mà là một lỗi thật trên bản deploy.** Tách hai app nghĩa là phải deploy hai nơi. Deploy mỗi `apps/web` lên Vercel thì `rewrites` vẫn trỏ về `http://localhost:4000`, và Vercel trả `404 DNS_HOSTNAME_RESOLVED_PRIVATE` cho **mọi** `/api/*`. Triệu chứng nhìn thấy: bản đồ 401, ô tìm địa chỉ không ra gì — và **không một event nào được ghi**, im lặng, vì `lib/track.ts` cố ý nuốt lỗi để không kẹt UI.

Với một dự án mà sản phẩm cuối là dữ liệu funnel, "im lặng không ghi được event" là chế độ hỏng tệ nhất có thể. Một project thì không có cách nào rơi vào đó: `/api/*` sống hay chết cùng trang web.

**Được gì:**
- Một `npm run dev`, một nơi deploy, không biến `API_ORIGIN`, không proxy.
- `lib/shared` vẫn khiến danh sách `event_name` / `screen_name` ở hai phía **không thể lệch nhau**.
- Bỏ được 4 thư viện: `express`, `cors`, `tsx`, `concurrently`.
- Phép dò tile lấy origin từ **chính request** thay vì một biến môi trường phải khai tay — bớt hẳn một cách cấu hình sai.

**Mất gì (chấp nhận, và đã cân nhắc):**
- **Hàng rào credential yếu đi một bậc.** Bản tách có hàng rào vật lý: package giao diện không có `firebase-admin` nên không import nổi. Giờ thay bằng `server-only` — vẫn chặn ở mức **build đỏ**, nhưng là quy ước được công cụ ép chứ không phải bất khả thi vật lý.
- **Hàng đợi rate-limit trong `upstream.ts` chỉ còn hiệu lực per-instance** trên serverless. Chi tiết và cách nhận biết ở `ARCHITECTURE.md` mục cuối.
- Giao diện và server nằm chung một repo tree, nên khi chia việc trong nhóm phải tự giữ kỷ luật ranh giới `lib/server/` (CLAUDE.md quy tắc 1).

### Cách nối giao diện với API: không cần nối gì cả

`fetch('/api/events')` tới thẳng `app/api/events/route.ts` của chính app này. Same-origin, nên **không có preflight `OPTIONS`** — điều này quan trọng vì `confirm_ride` và `place_order` bắn ngay trước `router.push` và phải kịp đi trước khi trang chuyển. Bản tách phải dựng hẳn một proxy `rewrites` để đạt được đúng tính chất mà bản này có sẵn.

**Quy tắc "client không chạm database trực tiếp" vẫn giữ nguyên** — component React gọi `fetch('/api/events')`, route handler gọi `lib/server/`, và chỉ ở đó Firebase Admin SDK mới vào cuộc. Trình duyệt không bao giờ cầm credential.

### Vì sao `lib/shared` không có bước build

Nó là thư mục TypeScript thường trong cùng project, import qua alias `@/lib/shared` — Next tự transpile. Không có bước build nghĩa là bớt một cách hỏng: sửa type xong quên chạy `tsc` rồi ngồi debug lỗi ma.

Hệ quả cần nhớ: **import tương đối không bao giờ ghi đuôi `.js`** — webpack của Next không resolve `.ts` từ đuôi `.js`, và lỗi này chỉ hiện ở `npm run build`, không hiện ở `npm run dev`.

## Firestore khác Postgres ở điểm nào — ảnh hưởng trực tiếp tới db-design
- Không có bảng/cột cố định — dữ liệu là **document** (dạng giống JSON) nằm trong **collection** (ví dụ collection `events`, mỗi event là 1 document).
- Không cần "giả lập" tính linh hoạt bằng cột `properties` JSONB như ở Postgres nữa — mỗi document trong Firestore vốn đã linh hoạt sẵn, muốn thêm field nào cũng được mà không cần khai báo trước.
- Không có `JOIN` giữa các bảng — nhưng project này chỉ có 1 loại dữ liệu (event) nên không cần tới.
- Truy vấn được bằng `where` và `orderBy`, nhưng không mạnh bằng SQL cho các phép tính gộp phức tạp (group by, aggregate) → cách đã lên kế hoạch từ trước (kéo raw data ra rồi tính bằng pandas, không tính toán ngay trong DB) vẫn đúng, không cần đổi hướng phân tích.

## Trạng thái tài liệu

Đã xong theo Next.js/Firestore: `ARCHITECTURE.md`, `db-design.md`, `api-endpoints.md`, `DESIGN.md` (đã có khối design token).

Đã bổ sung: `CLAUDE.md`, `event-taxonomy.md`, `mock-data.md`, `screen-map.md`, `tailwind-theme.md`, `setup.md`, `analysis-spec.md`, `roadmap.md`.

File `claude-code-implementation-prompt.md` dự kiến trước đây **không còn cần nữa** — vai trò "chỉ dẫn cho Claude Code" đã do `CLAUDE.md` đảm nhiệm, và nó được đọc tự động mỗi session thay vì phải dán tay vào prompt.

Còn chờ: danh sách 17 trường event của mentor (xem `event-taxonomy.md` mục 6).

## Ràng buộc không đổi
- Không dùng Cassandra/Redis/RabbitMQ/Kafka — lý do không đổi: khối lượng dữ liệu nhỏ (tự tạo bằng cách click tay), không cần hạ tầng xử lý phân tán/real-time.
- Không tích hợp API bên ngoài thật — địa chỉ, loại xe, menu món ăn, khuyến mãi vẫn hardcode trong frontend như trước.