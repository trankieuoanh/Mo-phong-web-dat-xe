# CLAUDE.md


## Dự án là gì

Mô phỏng web đặt xe kiểu Green SM (GSM) với hai luồng — **Đặt xe** và **Food** — nhằm **thu thập event hành vi người dùng** rồi phân tích bằng Python/pandas. App chỉ là công cụ sinh dữ liệu; sản phẩm cuối là các chỉ số funnel trong `analysis-spec.md`.

Không có backend thật, không đặt xe thật, không thanh toán. Mọi lựa chọn trong app chỉ sinh ra một document event.

## Bản đồ tài liệu — đọc file nào khi làm gì

| Đang làm | Đọc |
|---|---|
| Bất kỳ việc gì liên quan tới event | **`event-taxonomy.md`** ← hợp đồng dữ liệu, nguồn sự thật |
| Dựng màn hình, routing, state, giỏ hàng | `screen-map.md` |
| Cần nội dung địa chỉ / món ăn / khuyến mãi | `mock-data.md` |
| Viết CSS, chọn màu/cỡ chữ/bo góc | `tailwind-theme.md` (giá trị gốc ở `DESIGN.md`) |
| Viết API route | `api-endpoints.md` |
| Cấu trúc document Firestore | `db-design.md` |
| Cài Firebase, biến môi trường | `setup.md` |
| Viết script Python | `analysis-spec.md` |
| Không biết nên làm gì tiếp | `roadmap.md` |
| Lý do chọn công nghệ | `techstack.md`, `ARCHITECTURE.md` |

## Lệnh

```bash
npm run dev      # UI + API routes tại localhost:3000
npm run build    # kiểm tra lỗi TypeScript trước khi demo
npm run lint
```

Không có test tự động — `techstack.md` đã chốt là kiểm thử bằng cách click tay qua từng luồng.

## Quy tắc không được vi phạm

1. **Không import `firebase-admin` vào client component.** Chỉ `app/api/**` và `lib/firebase-admin.ts` được chạm Firestore. File `lib/firebase-admin.ts` phải có `import 'server-only'` ở dòng đầu.
2. **Không dùng tiền tố `NEXT_PUBLIC_`** cho bất kỳ biến Firebase nào — tiền tố đó nhúng giá trị vào bundle trình duyệt.
3. **`trackEvent` trả `void`, không phải Promise.** Không bao giờ `await` trước khi điều hướng. Chi tiết ở `screen-map.md` mục 4.
4. **Không tự sinh giá trị màu/spacing/radius mới.** Mọi giá trị phải truy được về token trong `DESIGN.md` qua bảng ở `tailwind-theme.md`.
5. **Không đổi `id` trong `mock-data.md`** (`addr-home`, `banh-mi-01`, `veh-bike`…). Chúng đi thẳng vào `properties` của event; đổi id làm dữ liệu cũ và mới không ghép được.
6. **Thêm event mới phải cập nhật `event-taxonomy.md` trước khi code**, kèm `lib/types.ts` và validate trong `app/api/events/route.ts`.
7. **Không thêm thư viện** ngoài những gì `techstack.md` đã chốt. Không Redux/Zustand (dùng Context), không axios (dùng `fetch`), không thư viện UI component.

## Cấu trúc thư mục

```
app/
  layout.tsx            AppProvider + font Inter
  page.tsx              Home
  ride/{address,pickup,vehicle,promo,confirm,success}/page.tsx
  food/page.tsx  food/item/[itemId]/page.tsx  food/{cart,offer,confirm,success}/page.tsx
  api/events/route.ts   api/health/route.ts
  globals.css           @theme + class typography
lib/
  types.ts              EventName, ScreenName, Flow
  mock-data.ts          dữ liệu tĩnh + calcDiscount
  firebase-admin.ts     server-only
  session.ts            session_id / user_id
  track.ts              trackEvent + useScreenView
  app-context.tsx       state ride + cart
components/             component dùng chung
analysis/               script Python (ngoài Next.js)
```

## Quy ước code

- TypeScript, không dùng `any` cho dữ liệu event — union type trong `lib/types.ts` tồn tại để bắt lỗi gõ sai tên event.
- Mọi page của 2 luồng là `'use client'`; chỉ `app/api/**` chạy server-side.
- **UI toàn bộ bằng tiếng Việt** ("Đặt xe", "Thêm vào giỏ", "Xác nhận"). Tên biến, tên hàm, tên field bằng tiếng Anh.
- Field trong event và khoá trong `properties`: `snake_case`. Biến trong TypeScript: `camelCase`. Helper `trackEvent` chịu trách nhiệm chuyển đổi.
- Tiền luôn là **số nguyên VNĐ** trong dữ liệu (`35000`), chỉ format khi hiển thị (`35.000đ`) bằng `Intl.NumberFormat('vi-VN')`.
- Mobile-first, container `max-width: 480px` — đây là mô phỏng app điện thoại.

## Hai cái bẫy đã biết

- **React Strict Mode nhân đôi `screen_view`.** `next dev` chạy effect hai lần; không chặn bằng `useRef` thì mọi số liệu funnel sai gấp đôi. Xem `screen-map.md` mục 4.
- **`initializeApp` gọi nhiều lần khi hot-reload** → `The default Firebase app already exists`. Luôn dùng `getApps()[0] ?? initializeApp(...)`. Xem `setup.md`.

## Kiểm tra sau mỗi thay đổi liên quan tới tracking

Đi hết một luồng, rồi:
```bash
curl "localhost:3000/api/events?session_id=<id>" | jq '.[] | {event_name, screen_name, step_index}'
```
Số `screen_view` phải **đúng bằng** số màn đã đi qua, và `step_index` phải khớp bảng trong `event-taxonomy.md`.
