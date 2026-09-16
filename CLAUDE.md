# CLAUDE.md


## Dự án là gì

Mô phỏng web đặt xe kiểu Green SM (GSM) với hai luồng — **Đặt xe** và **Food** — nhằm **thu thập event hành vi người dùng** rồi phân tích bằng Python/pandas. App chỉ là công cụ sinh dữ liệu; sản phẩm cuối là các chỉ số funnel trong `analysis-spec.md`.

Không có backend thật, không đặt xe thật, không thanh toán. Mọi lựa chọn trong app chỉ sinh ra một document event.

## Bản đồ tài liệu — đọc file nào khi làm gì

| Đang làm | Đọc |
|---|---|
| Bất kỳ việc gì liên quan tới event | **`event-taxonomy.md`** ← hợp đồng dữ liệu, nguồn sự thật |
| Dựng màn hình, routing, state, giỏ hàng | `screen-map.md` |
| Dựng giao diện 6 màn luồng đặt xe | `ride-flow-design.md` |
| Giao diện phải trông như thế nào | `apps/web/sample_ui/` — 4 ảnh chụp web Green SM thật |
| Hiểu code FE có sẵn: file nào làm gì, component nào dùng ở đâu | `fe-structure.md` |
| Hiểu code BE có sẵn: 4 lớp, luồng một request | `be-structure.md` |
| Cần nội dung địa chỉ / món ăn / khuyến mãi | `mock-data.md` |
| Viết CSS, chọn màu/cỡ chữ/bo góc | `tailwind-theme.md` (giá trị gốc ở `DESIGN.md`) |
| Viết API route | `api-endpoints.md` |
| Cấu trúc document Firestore | `db-design.md` |
| **Chạy dự án**, cài Firebase, biến môi trường, **tra lỗi** | `setup.md` |
| Viết script Python | `analysis-spec.md` |
| Không biết nên làm gì tiếp | `roadmap.md` |
| Lý do chọn công nghệ | `techstack.md`, `ARCHITECTURE.md` |

## Lệnh

Chạy từ **thư mục gốc** của monorepo:

```bash
npm install      # npm workspaces — cài cho cả 3 workspace một lần
npm run dev      # chạy SONG SONG: apps/api (:4000) + apps/web (:3000)
npm run build    # build apps/web, kiểm tra lỗi TypeScript trước khi demo
npm run lint
npm run typecheck

npm run dev:api  # chỉ BE
npm run dev:web  # chỉ FE
```

Trình duyệt luôn vào **`localhost:3000`**. Next.js proxy `/api/*` sang `:4000` qua `rewrites` — không gọi thẳng cổng 4000 từ trình duyệt (lý do ở `apps/web/next.config.ts`).

Không có test tự động — `techstack.md` đã chốt là kiểm thử bằng cách click tay qua từng luồng.

## Quy tắc không được vi phạm

1. **`apps/web/package.json` không được có `firebase-admin` trong `dependencies`.** Credential Firestore chỉ sống trong `apps/api`. Vì hai app là hai module graph riêng, FE muốn rò credential cũng không import nổi — `npm install` sẽ báo không tìm thấy package. Kiểm tra bằng `grep -r "firebase-admin" apps/web/` → phải rỗng.
2. **Không dùng tiền tố `NEXT_PUBLIC_`** cho bất kỳ biến Firebase nào — tiền tố đó nhúng giá trị vào bundle trình duyệt. (Biến Firebase giờ nằm ở `apps/api/.env`, nơi `NEXT_PUBLIC_` vốn vô nghĩa — nhưng quy tắc vẫn giữ để không ai copy nhầm sang `apps/web`.)
3. **`trackEvent` trả `void`, không phải Promise.** Không bao giờ `await` trước khi điều hướng. Chi tiết ở `screen-map.md` mục 4.
4. **Không tự sinh giá trị màu/spacing/radius mới.** Mọi giá trị phải truy được về token trong `DESIGN.md` qua bảng ở `tailwind-theme.md`.
5. **Không đổi `id` trong `mock-data.md`** (`addr-home`, `banh-mi-01`, `veh-bike`…). Chúng đi thẳng vào `properties` của event; đổi id làm dữ liệu cũ và mới không ghép được.
6. **Thêm event mới phải cập nhật `event-taxonomy.md` trước khi code**, kèm `packages/shared/src/types.ts` (union + mảng `EVENT_NAMES`) và `packages/shared/src/screens.ts` nếu là màn mới.
7. **Không tự gõ `step_index` trong page.** `trackEvent` tra bảng `SCREENS` ở `packages/shared/src/screens.ts`. Chỉ hai ngoại lệ được truyền tay: `add_to_cart` (luôn = 3, dùng helper `trackAddToCart`) và `flow` của `select_flow` ở màn Home.
8. **Không thêm thư viện** ngoài những gì `techstack.md` đã chốt: Next.js, React, Tailwind (FE); Express, cors, firebase-admin, tsx (BE); concurrently (root, devDependency). Không Redux/Zustand (dùng Context), không axios (dùng `fetch`), không thư viện UI component, **không thư viện icon** (dùng `apps/web/components/Icon.tsx`), **không thư viện bản đồ** (dùng `MapCanvas.tsx`).
9. **`/history` không được gọi `useScreenView` hay `trackEvent`.** Route này cố ý nằm ngoài funnel, không có trong `SCREENS`, và chỉ ĐỌC lại event đã có. Thêm event vào đó là làm bẩn mọi tỉ lệ conversion. Kiểm tra: `grep -rn "trackEvent(\|useScreenView(" apps/web/app/history` → phải rỗng.
10. **Không thêm màn đăng nhập.** Dự án không có authentication — quyết định có chủ ý, xem `api-endpoints.md`. `UserMenu` ở top bar là trang trí hoàn toàn.

## Cấu trúc thư mục — monorepo npm workspaces

```
package.json              workspaces + script dev chạy song song
tsconfig.base.json        strict, paths → @gsm/shared

apps/web/                 Next.js 15 — CHỈ FE, cổng 3000
  next.config.ts          transpilePackages + rewrites /api/* → :4000
  app/
    layout.tsx            AppProvider + font Inter (subset vietnamese)
    page.tsx              Home
    globals.css           @theme + class typography
    ride/{address,pickup,vehicle,promo,confirm,success}/page.tsx
    food/page.tsx  food/item/[itemId]/page.tsx  food/{cart,offer,confirm,success}/page.tsx
    history/page.tsx      NGOÀI FUNNEL — lịch sử chuyến đi, chỉ đọc, không bắn event
  lib/
    session.ts            session_id / user_id / resetSession
    track.ts              trackEvent + trackAddToCart + useScreenView
    app-context.tsx       state ride + cart
    use-place-search.ts   hook goi GET /api/places (debounce 400ms + abort)
    format.ts             formatVnd
  components/             ScreenShell, Panel, PrimaryButton, BackButton, FlowGuard,
                          MapCanvas, PlacePicker, Icon, GsmLogo
    shell/                AppShell, SideRail, TopBar, UserMenu
  sample_ui/              4 ảnh chụp web Green SM thật — tham chiếu khi dựng UI

apps/api/                 Express + tsx — CHỈ BE, cổng 4000
  src/server.ts           express + cors + json
  src/routes/             events.routes.ts, health.routes.ts, places.routes.ts
  src/validators/         event.validator.ts  ← whitelist 8 field
                          place.validator.ts
  src/services/           event.service.ts    ← platform + serverTimestamp
                          place.service.ts    ← Nominatim: User-Agent + 1 req/s + cache
  src/db/firebase-admin.ts
  .env                    credential Firebase (gitignored)

packages/shared/src/      @gsm/shared — dùng chung web + api, KHÔNG có bước build
  types.ts                Flow, EventName (19), ScreenName (13), EventPayload
  screens.ts              SCREENS — bảng route/step_index/flow
  mock-data.ts            dữ liệu tĩnh
  places.ts               Place, PlaceSource, DEFAULT_PICKUP, PRESET_PLACES
  pricing.ts              calcDiscount, calcRideTotals, calcFoodTotals

analysis/                 Python — KHÔNG phải npm workspace
```

Vì cả `apps/web` lẫn `apps/api` đều nhập `EventName` và `SCREENS` từ `@gsm/shared`, danh sách hợp lệ ở FE và BE **không thể lệch nhau**.

## Quy ước code

- TypeScript, không dùng `any` cho dữ liệu event — union type trong `packages/shared/src/types.ts` tồn tại để bắt lỗi gõ sai tên event.
- Mọi page của 2 luồng là `'use client'`. `apps/web` **không có** server-side logic nào; toàn bộ chạy ở `apps/api`.
- `packages/shared` import nội bộ **không ghi đuôi `.js`** — webpack của Next không resolve `.ts` từ đuôi `.js`, còn `tsx` thì chấp nhận cả hai.
- **UI toàn bộ bằng tiếng Việt** ("Đặt xe", "Thêm vào giỏ", "Xác nhận"). Tên biến, tên hàm, tên field bằng tiếng Anh.
- Field trong event và khoá trong `properties`: `snake_case`. Biến trong TypeScript: `camelCase`. Helper `trackEvent` chịu trách nhiệm chuyển đổi.
- Tiền luôn là **số nguyên VNĐ** trong dữ liệu (`35000`), chỉ format khi hiển thị (`35.000đ`) bằng `Intl.NumberFormat('vi-VN')`.
- **Desktop-first** — khung tham chiếu là web Green SM trên máy tính (ảnh mẫu ở `apps/web/sample_ui/`). `AppShell` = rail icon trái + top bar; `ScreenShell` chọn bố cục `split` (panel 480px + bản đồ) hoặc `wide` (một cột canh giữa). Chi tiết ở `screen-map.md` mục 6.
- Không dùng emoji trong UI — dùng `components/Icon.tsx` (SVG viết tay, ăn `currentColor`).

## Ba cái bẫy đã biết

- **React Strict Mode nhân đôi `screen_view`.** `next dev` chạy effect hai lần; không chặn bằng `useRef` thì mọi số liệu funnel sai gấp đôi. Xem `screen-map.md` mục 4.
- **`initializeApp` gọi nhiều lần khi hot-reload** → `The default Firebase app already exists`. Luôn dùng `getApps()[0] ?? initializeApp(...)`. Xem `setup.md`.
- **Gọi thẳng `localhost:4000` từ trình duyệt sẽ làm mất event cuối funnel.** POST cross-origin kèm `Content-Type: application/json` kích hoạt preflight `OPTIONS` — 2 round trip cho mỗi event. `confirm_ride` và `place_order` bắn ngay trước `router.push`, không kịp cả hai. Luôn dùng `fetch('/api/events')` qua proxy same-origin.

## Kiểm tra sau mỗi thay đổi liên quan tới tracking

Đi hết một luồng, rồi:
```bash
curl "localhost:3000/api/events?session_id=<id>" | jq '.[] | {event_name, screen_name, step_index}'
```
Số `screen_view` phải **đúng bằng** số màn đã đi qua, và `step_index` phải khớp bảng trong `event-taxonomy.md`.
