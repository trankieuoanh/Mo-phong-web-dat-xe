# techstack.md — GSM ride-booking simulation

## Chốt tech stack (thay thế bản Postgres/Node/Express trước đó)

| Lớp | Trước đây | Bây giờ |
|---|---|---|
| Frontend | React (web, Vite) | **Next.js** |
| Backend | Node/Express (`server/` riêng) | **Next.js API routes** (nằm chung 1 project với frontend) |
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
| Package manager | **npm** | Có sẵn khi cài Node.js, không cần cài thêm công cụ |
| Hosting (nếu cần deploy) | **Firebase Hosting** | Next.js được Firebase hỗ trợ hosting trực tiếp — gộp chung 1 platform với Firestore, đỡ phải quản lý 2 nơi |
| Testing framework | **Không cần** | Quy mô 6 tuần, tự test bằng cách click tay qua từng luồng là đủ, không cần viết test tự động |

Lưu ý: không bắt buộc phải deploy public trong 6 tuần này — chạy local (`next dev`) để demo cho mentor là đủ. Firebase Hosting chỉ cần khi muốn có link truy cập từ xa.

## Vì sao kiến trúc gộp lại đơn giản hơn
Next.js có sẵn khả năng chạy code phía server (API routes) ngay trong cùng một project — không cần dựng thư mục `server/` Node/Express riêng như bản trước nữa. Một project Next.js duy nhất đảm nhiệm cả UI (client-side) lẫn API (server-side).

**Quy tắc "client không chạm database trực tiếp" vẫn giữ nguyên** — chỉ đổi công cụ: các component React chỉ gọi vào API route nội bộ (ví dụ `app/api/events/route.ts`), route đó mới dùng Firebase Admin SDK để đọc/ghi Firestore. Trình duyệt không bao giờ cầm credential để nói chuyện thẳng với Firestore.

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