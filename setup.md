# setup.md — GSM ride-booking simulation

Các bước dựng môi trường chạy local. Làm đúng thứ tự: **Phase 0 chạy được app rỗng trước khi đụng tới Firebase.**

## Yêu cầu
- Node.js **20 LTS trở lên** (Next.js 15 cần ≥ 18.18; 20 là bản an toàn nhất).
- npm (có sẵn cùng Node).
- Một tài khoản Google để tạo Firebase project.
- Python **3.10+** (chỉ cần từ Tuần 5, cho phần phân tích).

---

## Phase 0 — Next.js chạy được, chưa có Firebase

```bash
npx create-next-app@latest . --typescript --tailwind --app --eslint --no-src-dir --import-alias "@/*"
npm run dev
```

Kiểm tra: mở `http://localhost:3000/api/health` → phải trả `{"status":"ok"}`. Route này **không chạm Firestore** (xem `api-endpoints.md`), nên nó xác nhận Next.js chạy đúng trước khi credential vào cuộc. Đừng bỏ qua bước này — nếu bỏ, lỗi Firebase và lỗi Next.js sẽ trộn vào nhau và rất khó tách.

---

## Phase 1 — Firebase

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project** → đặt tên (ví dụ `gsm-simulation`) → tắt Google Analytics (không cần).
2. **Build → Firestore Database → Create database** → chọn **Production mode** → region `asia-southeast1` (Singapore, gần Việt Nam nhất).
3. **Project settings → Service accounts → Generate new private key** → tải file JSON về.
4. Mở file JSON, lấy 3 giá trị `project_id`, `client_email`, `private_key` đưa vào `.env.local`.

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

`.env.local` (**đã có trong `.gitignore` mặc định của create-next-app** — kiểm tra lại cho chắc):

```bash
FIREBASE_PROJECT_ID=gsm-simulation
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@gsm-simulation.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"
```

Commit một file `.env.local.example` cùng nội dung nhưng để trống giá trị, để người khác clone repo biết cần những biến gì.

**Ba lỗi kinh điển với `FIREBASE_PRIVATE_KEY`:**
1. Phải **có dấu nháy kép** bao quanh — key chứa ký tự xuống dòng.
2. Trong file `.env` ký tự xuống dòng nằm ở dạng literal `\n`, phải `.replace(/\\n/g, '\n')` khi đọc, nếu không sẽ lỗi `error:1E08010C:DECODER routines::unsupported`.
3. Không thêm `NEXT_PUBLIC_` vào bất kỳ biến nào ở trên — tiền tố đó nhúng giá trị thẳng vào bundle trình duyệt, tức là **công khai service account key**.

---

## Khởi tạo Firebase Admin SDK

```ts
// lib/firebase-admin.ts
import 'server-only';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app =
  getApps()[0] ??
  initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    }),
  });

export const db = getFirestore(app);
```

```bash
npm install firebase-admin server-only
```

Hai chi tiết **bắt buộc**, không được lược bỏ:

- **`getApps()[0] ??`** — `next dev` hot-reload chạy lại module nhiều lần trong cùng một tiến trình. Gọi `initializeApp()` thẳng sẽ ném `The default Firebase app already exists` ngay lần sửa file thứ hai.
- **`import 'server-only'`** — biến việc lỡ import file này vào client component thành **lỗi build**, thay vì một lỗ hổng rò credential chỉ phát hiện được khi đọc kỹ bundle.

---

## Composite index

Query kết hợp nhiều điều kiện (ví dụ `where('flow')` + `where('created_at' >=)` + `orderBy`) sẽ bị Firestore từ chối kèm **một link tạo index sẵn trong thông báo lỗi**. Bấm link đó, đợi index build xong (~1 phút), chạy lại. Không cần đoán trước index nào — cứ chạy, lỗi sẽ chỉ đường (xem `db-design.md`).

---

## Phần phân tích (từ Tuần 5)

```
analysis/
  requirements.txt      # firebase-admin, pandas, matplotlib
  fetch_events.py       # kéo collection events → events.csv
  metrics.py            # tính chỉ số theo analysis-spec.md
  output/               # .gitignore — CSV và biểu đồ sinh ra
  .env                  # .gitignore — đường dẫn tới service account JSON
```

```bash
cd analysis
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Script Python dùng file service account JSON trực tiếp (`GOOGLE_APPLICATION_CREDENTIALS`), khác với app Next.js dùng 3 biến môi trường — vì script chạy offline, không qua hosting.

---

## `.gitignore` — kiểm tra có đủ

```
.env*.local
.env
*.json.key
serviceAccount*.json
analysis/.venv/
analysis/output/
```

Trước commit đầu tiên, chạy `git status` và xác nhận **không** thấy file nào chứa `private_key`.

---

## Lệnh hay dùng

| Lệnh | Việc |
|---|---|
| `npm run dev` | Chạy cả UI lẫn API routes tại `localhost:3000` |
| `npm run build` | Kiểm tra lỗi TypeScript/build trước khi demo |
| `npm run lint` | ESLint |
| `curl localhost:3000/api/health` | Xác nhận server sống |
| `curl "localhost:3000/api/events?session_id=..."` | Xem event của một phiên |
