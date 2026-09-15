# techstack.md — GSM ride-booking simulation

## Chốt tech stack (thay thế bản Postgres/Node/Express trước đó)

| Lớp | Trước đây | Bây giờ |
|---|---|---|
| Frontend | React (web, Vite) | **Next.js** (`apps/web`) |
| Backend | Node/Express (`server/` riêng) | **Node/Express** (`apps/api`) — xem mục "Kiến trúc monorepo" bên dưới |
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
| Package manager | **npm workspaces** | Có sẵn khi cài Node.js. Không cần Turborepo/Nx — 3 workspace thì cấu hình thêm chỉ tốn thời gian |
| Chạy TypeScript ở BE | **tsx** | Chạy thẳng `.ts`, không cần bước build khi dev |
| Chạy 2 process cùng lúc | **concurrently** | devDependency ở root, để `npm run dev` vẫn là một lệnh |
| Hosting (nếu cần deploy) | **Firebase Hosting** | Next.js được Firebase hỗ trợ hosting trực tiếp — gộp chung 1 platform với Firestore, đỡ phải quản lý 2 nơi. Lưu ý: giờ có 2 app nên phải deploy 2 chỗ (hoặc Cloud Run cho `apps/api`) — cân nhắc lại khi thực sự cần deploy |
| Testing framework | **Không cần** | Quy mô 6 tuần, tự test bằng cách click tay qua từng luồng là đủ, không cần viết test tự động |

Lưu ý: không bắt buộc phải deploy public trong 6 tuần này — chạy local (`next dev`) để demo cho mentor là đủ. Firebase Hosting chỉ cần khi muốn có link truy cập từ xa.

## Kiến trúc monorepo — đảo lại quyết định gộp

> **Đọc kỹ mục này trước khi thắc mắc "sao không dùng Next.js API routes".** Bản trước của file này đã cố ý *bỏ* thư mục `server/` để gộp BE vào Next.js API routes. Quyết định đó nay **bị đảo lại**, có chủ ý, vì ưu tiên đã đổi: dễ phát triển và bảo trì khi nhiều người cùng làm, quan trọng hơn là ít process hơn một chút.

```
apps/web/        Next.js 15 — CHỈ FE, cổng 3000
apps/api/        Express + tsx — CHỈ BE, cổng 4000
packages/shared/ @gsm/shared — types, bảng màn hình, mock data, pricing
analysis/        Python (không phải npm workspace)
```

| Workspace | Trách nhiệm | Không được làm |
|---|---|---|
| `apps/web` | UI 13 màn, state, bắn event | Không có `firebase-admin` trong `dependencies`. Không chạm Firestore |
| `apps/api` | Validate + ghi/đọc Firestore | Không render UI, không biết gì về React |
| `packages/shared` | Hợp đồng dữ liệu dùng chung | Không import từ `apps/*` (một chiều) |

**Được gì:**
- FE và BE sửa độc lập, không đụng file nhau — hợp với việc chia việc trong nhóm.
- Hàng rào credential là **thật**, không phải quy ước: `apps/web` không có `firebase-admin` trong `dependencies`, nên muốn rò cũng không import nổi. Mạnh hơn `import 'server-only'` của bản gộp (vốn chỉ báo lỗi lúc build).
- `packages/shared` khiến danh sách `event_name` / `screen_name` ở FE và BE **không thể lệch nhau** — cả hai import cùng một file.

**Mất gì (chấp nhận):**
- 2 process thay vì 1 — bù lại bằng `npm run dev` ở gốc, chạy song song, vẫn một lệnh.
- Thêm 4 thư viện: `express`, `cors`, `tsx` (BE) và `concurrently` (devDependency ở root).
- Phải xử lý ranh giới FE↔BE — xem mục kế tiếp.

### Cách nối FE với BE: proxy, không phải CORS

`apps/web/next.config.ts` khai báo `rewrites` đưa `/api/*` sang `http://localhost:4000`. Trình duyệt vì thế luôn thấy `/api/events` là **same-origin**.

Không phải tiện tay — nếu để trình duyệt gọi thẳng cổng 4000, mỗi POST `Content-Type: application/json` cross-origin sẽ kích hoạt **preflight `OPTIONS`**, tức 2 round trip cho mỗi event. Mà `confirm_ride` và `place_order` — hai event đánh dấu "hoàn thành funnel" — bắn ngay trước `router.push`, phải kịp cả preflight lẫn POST trước khi trang chuyển. Mất hai event đó là mất đúng cái mốc mà toàn bộ phân tích dựa vào.

`cors()` vẫn bật ở `apps/api` cho `WEB_ORIGIN`, phục vụ việc gọi thẳng cổng 4000 khi debug bằng curl/Postman.

**Quy tắc "client không chạm database trực tiếp" vẫn giữ nguyên** — chỉ đổi công cụ: các component React gọi `fetch('/api/events')`, proxy chuyển sang `apps/api`, và chỉ ở đó Firebase Admin SDK mới vào cuộc. Trình duyệt không bao giờ cầm credential.

### Vì sao Express mà không phải Fastify/Hono
Phổ biến nhất, nhiều tài liệu tiếng Việt nhất, dễ debug và dễ bảo vệ trước mentor. Với 2 endpoint thì hiệu năng của framework là chuyện không đáng bàn.

### Vì sao `packages/shared` không có bước build
`main` trỏ thẳng vào `src/index.ts`. `apps/api` chạy bằng `tsx` (transpile TS trực tiếp), `apps/web` khai báo `transpilePackages: ['@gsm/shared']`. Có bước build nghĩa là thêm một cách hỏng: sửa type xong quên chạy `tsc` rồi ngồi debug lỗi ma.

Hệ quả cần nhớ: import nội bộ trong `packages/shared` **không ghi đuôi `.js`** — webpack của Next không resolve `.ts` từ đuôi `.js`.

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