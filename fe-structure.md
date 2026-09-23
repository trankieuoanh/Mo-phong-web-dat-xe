# fe-structure.md — cấu trúc frontend (`apps/web`)

Mô tả **code hiện có** trong `apps/web`: file nào làm gì, phụ thuộc vào đâu, một tương tác đi qua những lớp nào.

Đây không phải hợp đồng dữ liệu. Muốn biết event nào mang field gì → `event-taxonomy.md`. Muốn biết route và quy tắc state → `screen-map.md`. File này trả lời câu khác: **code hiện thực những thứ đó ra sao**.

---

## 1. Vai trò

Next.js 15 (App Router), cổng **3000**. Chỉ frontend — **không có logic nghiệp vụ nào chạy ở server**.

Ba điều quyết định hình dạng của toàn bộ thư mục này:

- **Mọi page đều `'use client'`.** Vì page nào cũng cần đọc state (giỏ hàng, lựa chọn) và bắn event, không có page nào render được ở server.
- **Không có `firebase-admin` trong `dependencies`.** Credential nằm ở `apps/api`, một module graph khác — FE muốn chạm Firestore cũng không import nổi. Xem `CLAUDE.md` quy tắc 1.
- **Không có `app/api/`.** API là process riêng ở cổng 4000; `next.config.ts` proxy `/api/*` sang đó.

Ngoại lệ duy nhất chạy ở server là `middleware.ts` — nó **không xử lý nghiệp vụ gì**, chỉ gắn một header vào request trên đường đi (xem mục 5).

---

## 2. Cây thư mục

```
apps/web/
├─ next.config.ts          transpilePackages + rewrites proxy → :4000
├─ middleware.ts           bơm header x-gsm-key vào /api/* (chỉ khi deploy)
├─ postcss.config.mjs      plugin @tailwindcss/postcss
├─ eslint.config.mjs
├─ tsconfig.json           paths: @/* và @gsm/shared
│
├─ app/
│  ├─ layout.tsx           font Inter (subset vietnamese) + <AppProvider>
│  ├─ globals.css          @theme token + 13 class .t-* + .shadow-level-2
│  ├─ page.tsx             Home — màn đặt xe mặc định (screen_name `home`)
│  ├─ ride/
│  │  ├─ address/page.tsx     tìm + chọn điểm đến
│  │  ├─ pickup/page.tsx      xác nhận điểm đón (hằng số) + ghi chú tài xế
│  │  ├─ vehicle/page.tsx     bản đồ tuyến + chọn 1 trong 6 hạng xe
│  │  ├─ promo/page.tsx       tab + ô nhập mã + chọn/bỏ qua khuyến mãi
│  │  ├─ confirm/page.tsx     tóm tắt + phương thức thanh toán + nút đặt cuối
│  │  └─ success/page.tsx     màn kết thúc luồng ride
│  ├─ food/
│     ├─ page.tsx             menu 8 món — 4 cách tìm: ô tìm, bữa, quán gần, loại
│     ├─ item/[itemId]/page.tsx  chi tiết món + chọn số lượng
│     ├─ cart/page.tsx        giỏ hàng: sửa số lượng, xoá dòng
│     ├─ offer/page.tsx       chọn hoặc bỏ qua ưu đãi
│     ├─ confirm/page.tsx     tóm tắt đơn + nút đặt cuối
│     └─ success/page.tsx     màn kết thúc luồng food
│  ├─ history/page.tsx      NGOÀI FUNNEL — lịch sử chuyến đi, không bắn event
│  ├─ account/page.tsx      NGOÀI FUNNEL — Tài khoản phụ, trạng thái rỗng
│  ├─ support/page.tsx      NGOÀI FUNNEL — Trung tâm hỗ trợ, 4 thẻ tĩnh
│  └─ terms/page.tsx        NGOÀI FUNNEL — Điều khoản & Chính sách, 4 thẻ tĩnh
│
├─ lib/
│  ├─ track.ts             trackEvent · trackAddToCart · trackSelectFlow · useScreenView
│  ├─ use-place-search.ts  hook gọi GET /api/places (debounce + abort)
│  ├─ use-route.ts         hook gọi GET /api/route + routeOrFallback()
│  ├─ use-restaurants.ts   hook gọi GET /api/restaurants — quán gần + tìm theo tên
│  ├─ use-current-place.ts hook GPS, lui về DEFAULT_PICKUP khi bị từ chối
│  ├─ use-tile-providers.ts hook gọi GET /api/tiles — lọc nhà cung cấp tile đã hỏng
│  ├─ app-context.tsx      AppProvider · useApp — state ride + cart + food
│  ├─ session.ts           session_id / user_id / resetSession
│  └─ format.ts            formatVnd — số nguyên VNĐ → "35.000đ"
│
└─ components/
   ├─ ScreenShell.tsx      chọn bố cục split / wide rồi bọc bằng AppShell
   ├─ Panel.tsx            card trắng: header / body cuộn / footer CTA
   ├─ PrimaryButton.tsx    3 biến thể: primary / secondary / subtle
   ├─ BackButton.tsx       bắn event `back` rồi điều hướng
   ├─ FlowGuard.tsx        chặn vào thẳng URL giữa luồng
   ├─ MapCanvas.tsx        tile OSM thật + tuyến thật, không thư viện
   ├─ PlacePicker.tsx      ô tìm địa chỉ thật + danh sách kết quả
   ├─ Icon.tsx             ~40 icon SVG viết tay, thay toàn bộ emoji
   ├─ GsmLogo.tsx          logo cánh chim + wordmark, một tông cyan
   ├─ FoodThumb.tsx        khung ảnh món — glyph theo cuisine khi không có ảnh
   ├─ QuantityStepper.tsx  nút +/− số lượng, disabled thật ở chặn dưới
   ├─ SummaryRow.tsx       một dòng "nhãn — giá trị" trong thẻ tổng kết
   ├─ RestaurantCard.tsx   một quán thật từ OSM — dùng ở dải gần bạn & kết quả tìm
   ├─ EmptyState.tsx       trạng thái rỗng/lỗi có hành động đi kèm
   ├─ Skeleton.tsx         ô xám nhấp nháy trong lúc chờ dữ liệu
   ├─ Toast.tsx            ToastProvider + useToast — báo ngắn khi thêm món
   └─ shell/
      ├─ AppShell.tsx      rail trái + top bar + vùng nội dung
      ├─ SideRail.tsx      6 mục icon dọc — 2 mục đầu là tab chuyển luồng
      ├─ TopBar.tsx        tên mục + tab trang trí + tab luồng (dưới lg) + UserMenu
      ├─ flow-nav.ts       FLOW_ENTRY + FLOW_TABS — luật đổi luồng dùng chung
      ├─ CartButton.tsx    icon giỏ + badge số lượng, chỉ hiện ở luồng food
      └─ UserMenu.tsx      chip người dùng — trang trí, hiện user_id đang dùng
```

---

## 3. Sơ đồ phụ thuộc

Phụ thuộc đi **một chiều**, không có vòng:

```mermaid
flowchart LR
  P[app/**/page.tsx<br/>13 page funnel + 2 ngoài funnel] --> C[components/]
  P --> L[lib/<br/>4 file]
  C --> L
  L --> S[["@gsm/shared"]]
  P --> S
```

Điều này có nghĩa: sửa `lib/` ảnh hưởng tới mọi page; sửa một page không ảnh hưởng tới gì khác. Khi cần đổi cách bắn event, sửa **một chỗ** trong `lib/track.ts`.

---

## 4. Bảng 13 page

| Route | `screen_name` | step | Guard | Event bắn ra (ngoài `screen_view`) | Dòng |
|---|---|:--:|:--:|---|--:|
| `/` | `home` | 0 | — | `select_flow` | 101 |
| `/ride/address` | `address_selection` | 1 | — | `select_address` | 147 |
| `/ride/pickup` | `pickup_confirm` | 2 | ✓ | `confirm_pickup`, `change_address` | 115 |
| `/ride/vehicle` | `vehicle_selection` | 3 | ✓ | `select_vehicle` | 131 |
| `/ride/promo` | `promo_selection` | 4 | ✓ | `select_promo`, `skip_promo` | 190 |
| `/ride/confirm` | `ride_confirm` | 5 | ✓ | `confirm_ride` | 135 |
| `/ride/success` | `ride_success` | 6 | — | `back_to_home` | 89 |
| `/food` | `food_menu` | 1 | — | `search_item`, `filter_category`, `select_meal`, `select_restaurant`, `select_item`, `add_to_cart` | 410 |
| `/food/item/[itemId]` | `food_item_detail` | 2 | ✓ | `change_quantity`, `add_to_cart` | 129 |
| `/food/cart` | `food_cart` | 4 | ✓ | `change_quantity`, `remove_from_cart`, `proceed_to_offer` | 164 |
| `/food/offer` | `food_offer_selection` | 5 | ✓ | `select_offer`, `skip_offer` | 92 |
| `/food/confirm` | `food_confirm` | 6 | ✓ | `place_order` | 100 |
| `/food/success` | `food_success` | 7 | — | `back_to_home` | 72 |

> **Không page nào gõ `step_index`.** Cột `step` ở trên do `trackEvent` tra bảng `SCREENS` trong `@gsm/shared`. Để đây chỉ để đối chiếu nhanh với `event-taxonomy.md`.

> **Event `back` không có trong bảng** vì nó không nằm trong file page nào cả — xem mục 6.

> **Bốn bộ lọc ở màn menu, loại trừ nhau, và cái nào cũng bắn event.** Ô tìm tên món (`search_item`, debounce 600ms để **gộp event** chứ không phải giảm tải mạng — việc lọc chạy client-side trên 8 món), chip bữa sáng/trưa/tối (`select_meal`, mặc định theo giờ đọc trong `useEffect` để tránh bẫy hydration), dải "Gần bạn" lấy quán thật từ `GET /api/restaurants` kèm cuisine/giờ mở cửa thật (`select_restaurant`); bấm một quán thì thực đơn được suy từ **tag `cuisine` thật** của quán đó, và chip loại món (`filter_category` — **trước đây chip này im lặng**). Bộ lọc đang bật đi vào `select_item`/`add_to_cart` qua khoá `discovery_source`; đó là khoá trả lời câu hỏi *lối tìm món nào dẫn tới thêm giỏ nhiều nhất*. Toàn bộ nằm trên `food_menu` nên **`step_index` luồng food không đổi**.

> **Hai màn không bắn event khi bấm nút chính.** Ở `/ride/vehicle`, `select_vehicle` bắn khi bấm *hạng xe*, còn nút "Tiếp tục" chỉ điều hướng. Ở `/ride/promo`, bấm promo chỉ tick chọn, `select_promo` bắn khi bấm "Áp dụng mã". Hệ quả: một session có thể có **nhiều** `select_vehicle` (đo được sự phân vân) nhưng đúng **một** `select_promo`. Chi tiết ở `ride-flow-design.md` mục 7.

> **`select_flow` bắn từ hai chỗ, và không phải lúc nào cũng ở `/`.** Màn `/` không còn hai card: nó **là** màn đặt xe, và ô tìm kiếm giữa panel bắn `select_flow(ride)`. Lối vào luồng food — và mọi lần đổi luồng — nằm ở hai tab của `SideRail`, bấm được ở **ba màn đầu luồng** `/`, `/ride/address`, `/food`. Cả hai chỗ dùng chung helper `trackSelectFlow`, nên event luôn mang `step_index: 0` và `flow` = luồng được chọn. Muốn biết người dùng nhảy luồng từ đâu thì đọc `screen_name` của event, **không phải** `previous_screen`.

### Route ngoài funnel

| Route | Bắn event | Làm gì |
|---|:--:|---|
| `/history` | **không** | `fetch('/api/events?user_id=...')` qua proxy same-origin. Gấp `confirm_ride` / `cancel_ride` → một chuyến xe, `place_order` → một đơn đồ ăn; tab Di chuyển có ba thẻ "Tổng số chuyến" / "Đã huỷ" / "Tổng chi tiêu", tab Đặt đồ ăn có hai. Tab bấm được thật. Ba trạng thái: skeleton / rỗng / lỗi (in nguyên văn thông báo Firestore vì nó chứa link tạo index) |

> **Một dòng ở tab Di chuyển = một SESSION, không phải một event.** Chuyến bị huỷ sinh **hai** event trong cùng session: `confirm_ride` ở màn xác nhận, rồi `cancel_ride` ở màn tìm tài xế. Lọc thẳng theo tên event sẽ cho ra hai dòng cho cùng một chuyến, và dòng `confirm_ride` hiện như một chuyến hoàn thành — đúng cái bảng này cần phân biệt. `rideEvents()` vì vậy gom theo `session_id` trước: session nào có `cancel_ride` thì lấy chính event đó làm dòng (nó mirror đủ field của `confirm_ride`) và bỏ dòng `confirm_ride` đi.
>
> **Chuyến đã huỷ không cộng vào "Tổng chi tiêu"** và cước phí của nó hiện gạch ngang: `final_price` ở đó là số tiền *lẽ ra* phải trả, không phải số đã trả.
>
> Nhãn trạng thái **không dùng màu đỏ** — `DESIGN.md` mục "Colour" chốt hệ màu này cố ý không có bảng error/success/warning. Phân biệt bằng độ đậm của cyan: hoàn thành = `surface-pressed` + `primary-dark`, đã huỷ = `canvas-soft` + `mute`.

**Không có trong `SCREENS`**, nên `screens.ts` và union `ScreenName` không phải sửa gì. Thêm `useScreenView` vào đây sẽ không compile — `ScreenName` không có giá trị tương ứng.

> **Không có `/login`.** Dự án không có authentication, xem `api-endpoints.md`. `UserMenu` là trang trí hoàn toàn, chỉ hiện `user_id` — chính là khoá mà `/history` tra.

---

## 5. `lib/` — bốn file

### `track.ts` (151 dòng) — quan trọng nhất
```ts
trackEvent(input): void          // KHÔNG async, không ai await được
trackAddToCart(screenName, properties): void
trackSelectFlow(screenName, flow): void
useScreenView(screenName): void
resetPreviousScreen(): void
```

Ba thứ file này giữ mà không chỗ nào khác giữ:

1. **`previousScreen`** — biến module-level, cập nhật sau mỗi `screen_view`. Không suy ra từ route vì Back của trình duyệt sẽ làm mọi suy luận từ route sai.
2. **Tra bảng `SCREENS`** để điền `flow` và `step_index`. Hai tham số đó *có thể* truyền tay nhưng chỉ dùng cho đúng hai ngoại lệ, và cả hai đã được gói vào helper riêng: `trackAddToCart` (luôn step 3) và `trackSelectFlow` (luôn step 0, `flow` = luồng vừa chọn).
3. **`useRef` chặn React Strict Mode** trong `useScreenView`. Thiếu nó thì mọi `screen_view` nhân đôi và funnel sai gấp đôi.

`trackEvent` trả `void` có chủ ý — không ai `await` được nên không thể vô tình chặn điều hướng. Kèm `keepalive: true` và `.catch(() => {})`.

### `middleware.ts` (không nằm trong `lib/`, nhưng đọc cùng `track.ts`)

File duy nhất của `apps/web` chạy ở phía máy chủ. Việc của nó gọn trong một câu: **gắn header `x-gsm-key` vào mọi request `/api/*`**, rồi rewrite thẳng sang `API_ORIGIN`.

```ts
export const config = { matcher: '/api/:path*' };
// không đặt EVENTS_WRITE_KEY → NextResponse.next(), rewrites của next.config.ts lo nốt
```

Vì sao không gắn header trong `track.ts` cho gọn: khoá đặt ở FE sẽ nằm trong bundle JS tải về máy người dùng, mở DevTools là thấy, và như vậy thì nó không còn chặn được ai. Đặt ở đây thì khoá chỉ tồn tại trên máy chủ — trình duyệt vẫn gọi `/api/events` same-origin y như cũ và không biết gì về nó.

Tự rewrite thay vì `NextResponse.next()` rồi để `rewrites` của `next.config.ts` làm nốt: header sửa trong middleware chỉ chắc chắn đi theo request khi chính middleware quyết định đích đến. Cái giá khi đoán sai là `confirm_ride` và `place_order` âm thầm ăn 401 — đúng kiểu mất event cuối funnel mà `next.config.ts` đã phải viết hẳn một đoạn dài để tránh.

Không đặt `EVENTS_WRITE_KEY` thì middleware thả request đi tiếp, tức là **chạy local không đổi gì**. Xem `setup.md` mục "Deploy".

### `app-context.tsx` (209 dòng)
```ts
AppProvider({ children })    // đặt một lần trong app/layout.tsx
useApp(): AppContextValue
```

Giữ `ride`, `cart`, `offerId`, `sessionId`, `userId`, và cờ **`hydrated`**.

`RideDraft` có 5 trường: `addressId` (**điểm đến** — điểm đón là hằng số `FIXED_PICKUP`), `vehicleId`, `promoId`, `driverNote`, `paymentMethod`.

`hydrated` tồn tại vì một lý do cụ thể: trước khi `useEffect` đọc xong `sessionStorage` thì state luôn rỗng. Không có cờ này, `FlowGuard` sẽ đá người dùng ra khỏi luồng **mỗi lần F5**.

Đồng bộ ngược xuống `sessionStorage` qua ba `useEffect` (`gsm_ride_draft`, `gsm_cart`, `gsm_offer`), đều bọc try/catch — storage đầy hoặc bị chặn không được làm vỡ UI.

### `session.ts` (58 dòng)
```ts
getSessionId() · getUserId() · resetSession() · DRAFT_KEYS
```

`session_id` ở `sessionStorage` (một tab = một lượt thử luồng), `user_id` ở `localStorage` (bền qua nhiều ngày). `resetSession()` sinh id mới và xoá sạch draft — gọi khi bấm "Về trang chủ".

Mọi hàm ở đây chỉ được gọi trong `useEffect` hoặc event handler. Gọi lúc render sẽ lỗi hydration vì `crypto.randomUUID()` và `sessionStorage` không tồn tại phía server.

### `format.ts` (17 dòng)
```ts
formatVnd(35000) → "35.000đ"
```
Tiền **luôn** là số nguyên trong dữ liệu, chỉ format khi hiển thị.

---

## 6. `components/`

| Component | Props | Dùng ở | Ghi chú |
|---|---|:--:|---|
| `ScreenShell` | `title`, `leading`, `trailing`, `children`, `footer`, `variant`, `aside`, `section`, `tabs`, `maxWidth` | 12 page | Chọn bố cục `split`/`wide` rồi bọc bằng `AppShell` + `Panel`. Năm prop đầu giữ nguyên ý nghĩa từ bản mobile cũ, nên đổi sang desktop không phải viết lại page nào |
| `Panel` | `title`, `leading`, `trailing`, `children`, `footer` | qua `ScreenShell` | Card trắng 3 khu; body tự cuộn (`overflow-y-auto`), footer dính đáy **panel** |
| `AppShell` | `section`, `tabs`, `children` | 12 page + `/`, `/history` | `SideRail` + `TopBar` + slot. Rail ẩn dưới `lg` |
| `SideRail` | — | qua `AppShell` | 6 mục, **mở rộng (nhãn chữ) / thu gọn (chỉ icon)**, nhớ ở `localStorage`. Hai mục luồng là **tab**: tab của luồng đang đứng thì active và không bấm được, tab luồng kia bấm được (bắn `select_flow`) — chỉ ở 3 màn đầu luồng trong bảng `FLOW_ENTRY`. Mục "Hoạt động" là link `/history` ở mọi màn. Còn lại trang trí |
| `TopBar` / `UserMenu` | `section`, `tabs` / — | qua `AppShell` | Tab trang trí. `UserMenu` cũng trang trí hoàn toàn — chỉ hiện `user_id` đang dùng |
| `PrimaryButton` | `variant`, `fullWidth`, + props button | 11 page | Nền `primary-dark` chứ không `primary` — tương phản 4.2:1 thay vì 2.6:1 (`tailwind-theme.md` mục 0b). `enabled:hover:` để nút disabled không đổi màu khi rê chuột |
| `BackButton` | `from`, `to`, `href`, `icon` | 10 page | **Bắn event `back`** rồi mới `router.push`. `icon` mặc định `'back'`; `/ride/promo` truyền `'close'` cho giống overlay — hình khác nhưng event y hệt |
| `FlowGuard` | `ready`, `fallback`, `children` | 8 page | Đợi `hydrated` trước khi redirect |
| `PlacePicker` | `placeholder`, `presetHeading`, `selectedId?`, `onPick`, `leading?` | 2 page | Ô tìm + kết quả. Dùng chung cho điểm đến và điểm đón nên hai chỗ không thể lệch nhau. **Không bắn event** — cha quyết định |
| `MapCanvas` | `pickup`, `destination?`, `route?`, `label?`, `fill?`, `onPick?` | 4 page | Tile OpenStreetMap thật (`<img>`) + tuyến OSRM vẽ bằng SVG phủ lên. Kéo được ở mọi màn; có `onPick` thì bấm lên bản đồ để chọn vị trí. **Không thư viện bản đồ** (`CLAUDE.md` quy tắc 8). Bắt buộc có dòng ghi công `© OpenStreetMap` |
| `InfoCardGrid` | `items` (`{icon, label}[]`) | `/support`, `/terms` | Lưới 2 cột thẻ huy hiệu-icon + nhãn. Thẻ **không bấm được** — không có trang đích thật, và một nút bấm vào im lặng là khoảng mù trong dữ liệu |
| `Icon` | `name`, `size?`, `className?` | khắp nơi | ~45 icon SVG viết tay. `stroke="currentColor"` nên **không bao giờ phải gõ hex ở chỗ gọi** |
| `GsmLogo` | `variant`, `size?` | `SideRail` | Một tông cyan — `DESIGN.md` cấm màu accent thứ hai, nên không có vàng như logo thật |

### `MapCanvas` — bản đồ thật, không thư viện

Bản trước vẽ lưới phố **bịa** với tuyến hằng số, nên hai chuyến khác hẳn nhau vẫn ra cùng một hình. Giờ: `ResizeObserver` đo khung → chọn zoom vừa khít tuyến → chiếu Web Mercator → xếp lưới `<img>` tile OSM → phủ `<svg>` vẽ polyline và hai ghim.

Cụm `+`/`−` và nút re-center **giờ làm thật** (đổi zoom, đưa khung về vừa khít). Chúng không bắn event vì không đổi lựa chọn nào của người dùng.

**Kéo và bấm chọn vị trí.** Kéo bật ở mọi bản đồ; cuộn-để-zoom **chỉ** bật khi `fill` (bố cục `split`) — khung 4:3 ở `/food/confirm` nằm giữa một cột đang cuộn, chặn `wheel` ở đó sẽ khoá cuộn trang. Có `onPick` thì bấm lên bản đồ trả về toạ độ; **ngưỡng 5px phân biệt bấm với kéo**, không có nó thì kéo bản đồ xong thả tay sẽ bị hiểu là chọn một điểm. Các nút điều khiển nằm trong khung bản đồ được lọc bằng `closest('button, a')` ở `pointerdown`, nếu không thì bấm "+" vừa phóng to vừa thả một cái ghim.

Dòng **`© OpenStreetMap` là bắt buộc** theo điều khoản dùng tile. Bảng nhà cung cấp tile nằm ở `packages/shared/src/tiles.ts` chứ không phải trong component — BE phải dò đúng cái danh sách mà màn hình này sẽ hiện.

**Hai lớp phòng vệ, bắt hai thứ khác nhau** — đừng bỏ lớp nào tưởng là thừa:

| Lớp | Ở đâu | Bắt được | Không bắt được |
|---|---|---|---|
| `useTileProviders()` | BE dò trước | "200 **nhưng tile sai**" | mạng của người dùng chặn một tên miền |
| `handleTileError` | `onError` của `<img>` | "trình duyệt không tải được" | tile tải được nhưng bị in chữ lên |

Lớp 2 từng là lớp duy nhất, và nó **đã không cứu được sự cố thật**: CARTO chuyển sang bắt buộc API key, in chữ "API KEY REQUIRED" chéo lên mọi tile, nhưng vẫn trả HTTP 200 kèm PNG hợp lệ. `onError` không bao giờ bắn, bộ đếm mãi bằng 0, bản đồ hỏng ở cả hai luồng mà app không hề biết. Chi tiết cách dò ở `api-endpoints.md` mục 3d.

### `BackButton` — chỗ dễ nhầm khi đọc code

Grep `eventName: 'back'` trong `app/` sẽ ra **rỗng**. Event `back` được bắn bên trong `BackButton.tsx`, không phải trong page.

Mười cặp `from → to` (đã đối chiếu khớp với `properties.to_screen` ở `event-taxonomy.md`):

| `from` | `to` | `href` |
|---|---|---|
| `address_selection` | `home` | `/` |
| `pickup_confirm` | `address_selection` | `/ride/address` |
| `vehicle_selection` | `pickup_confirm` | `/ride/pickup` |
| `promo_selection` | `vehicle_selection` | `/ride/vehicle` |
| `ride_confirm` | `promo_selection` | `/ride/promo` |
| `food_menu` | `home` | `/` |
| `food_item_detail` | `food_menu` | `/food` |
| `food_cart` | `food_menu` | `/food` |
| `food_offer_selection` | `food_cart` | `/food/cart` |
| `food_confirm` | `food_offer_selection` | `/food/offer` |

Hai màn success không có `BackButton` — chúng dùng `router.replace` để Back không quay ngược vào session đã đóng.

### `FlowGuard` — điều kiện từng page

| Page | `ready` | `fallback` |
|---|---|---|
| `/ride/pickup` | `Boolean(ride.destination)` | `/` |
| `/ride/vehicle` | `Boolean(ride.destination)` | `/` |
| `/ride/promo` | `destination && vehicleId` | `/` |
| `/ride/confirm` | `destination && vehicleId && promoId !== undefined` | `/` |
| `/food/item/[itemId]` | `Boolean(item)` — id có thật | `/food` |
| `/food/cart` | `cart.length > 0` | `/food` |
| `/food/offer` | `cart.length > 0` | `/food` |
| `/food/confirm` | `cart.length > 0 && offerId !== undefined` | `/food` |

Năm page **không** có guard: `home`, `/ride/address`, `/food` (đầu luồng, không có gì để bảo vệ) và hai màn success (vào được là do vừa hoàn thành luồng).

Guard chạy **trước** khi nội dung mount, nên `useScreenView` bên trong không kịp chạy — bị chặn thì không sinh event nào. Đó là chủ ý: tránh session rác trong dữ liệu phân tích.

> **Vì sao ride trả về `/` chứ không phải `/ride/address`.** Từ khi `/` thành màn đặt xe, `select_flow` — **bước 0** của funnel ride — chỉ sinh ra ở đó. Đá người dùng thẳng vào `/ride/address` tạo một session có bước 1 mà **không có bước 0**, làm `reach[1] > reach[0]` và `step_conversion` của bước 1 vọt lên trên 1. Trả về `/` thì session đó chỉ có một `screen_view home` (`flow: 'none'`) và bị `drop_junk_sessions()` loại sạch. Food vẫn trả về `/food` vì đó là màn đầu luồng của nó — nhưng **`/food` có đúng vấn đề tương tự** và là việc cần rà khi audit luồng food.

---

## 7. Luồng một tương tác

Người dùng bấm "Green Bike" ở `/ride/vehicle`:

```
1. onClick trong ride/vehicle/page.tsx
2. trackEvent({ eventName: 'select_vehicle', screenName: 'vehicle_selection', properties })
3. lib/track.ts   tra SCREENS['vehicle_selection'] → flow 'ride', step_index 3
                  chèn session_id, user_id (lib/session.ts), previous_screen (biến module)
4. fetch('/api/events', { keepalive: true }).catch(() => {})   ← KHÔNG await
5. setRide({ vehicleId })        → app-context ghi kèm sessionStorage
6. (ở lại màn — dòng vừa chọn hiện ring-2 ring-primary)
```

Điều hướng xảy ra ở một lần bấm khác, khi người dùng bấm "Tiếp tục" — lúc đó **không bắn event**. Đổi ý và bấm sang hạng xe khác thì bước 1–5 chạy lại, sinh thêm một `select_vehicle` nữa.

Chỗ đáng chú ý là bước 4 **không được `await`**. Ở những màn mà event bắn ngay trước `router.push` (`confirm_ride` ở `/ride/confirm`, `place_order` ở `/food/confirm`), `await` sẽ làm UI khựng ~200ms mỗi lần bấm — lỗi dễ mắc nhất trong loại app này. `trackEvent` trả `void` nên không ai `await` được, và `keepalive: true` lo phần gửi nốt khi trang đã chuyển.

Request rời trình duyệt là **same-origin** (`/api/events`), Next.js proxy sang `:4000`. Ghi thẳng `http://localhost:4000` sẽ thành cross-origin, kích hoạt preflight `OPTIONS`, và `confirm_ride` / `place_order` — hai event bắn ngay trước khi chuyển trang — không kịp gửi. Lý do đầy đủ ở `techstack.md`.

Phần còn lại của hành trình (từ `:4000` trở đi) → `be-structure.md`.

---

## 8. Nhập gì từ `@gsm/shared`

FE dùng shared cho hai việc, không hơn:

**Dữ liệu tĩnh để render** — `ADDRESSES`, `VEHICLES`, `PROMOS`, `OFFERS`, `FOOD_ITEMS`, `SHIPPING_FEE`, `FIXED_PICKUP` / `DEFAULT_PICKUP`, `PRESET_PLACES`, và các hàm `getAddress` / `getVehicle` / `getPromo` / `getOffer` / `getFoodItem`.

**Tính toán dùng chung** — `calcFare` (giá theo km), `calcRideTotals`, `calcFoodTotals`, `calcDiscount`, `haversineKm`, `straightRoute`, `roundKm`.

**Tính tiền** — `calcDiscount`, `isRuleAvailable`, `calcRideTotals`, `calcFoodTotals`. Màn confirm hiển thị số tiền và event `confirm_ride` / `place_order` ghi số tiền, **cùng một hàm** — nên hai chỗ không thể lệch nhau.

| Page | Import |
|---|---|
| `/ride/address` | `ADDRESSES`, `type Address` |
| `/ride/pickup` | `FIXED_PICKUP`, `getAddress` |
| `/ride/vehicle` | `VEHICLES`, `type Vehicle` |
| `/ride/promo` | `PROMOS`, `calcDiscount`, `getVehicle`, `isRuleAvailable` |
| `/ride/confirm` | `FIXED_PICKUP`, `calcRideTotals`, `getAddress`, `getPromo`, `getVehicle` |
| `/ride/success` | `calcRideTotals`, `getAddress`, `getPromo`, `getVehicle` |
| `/food` | `FOOD_CATEGORIES`, `FOOD_ITEMS`, `calcFoodTotals`, `getFoodItem` |
| `/food/item/[itemId]` | `calcFoodTotals`, `getFoodItem` |
| `/food/cart` | `SHIPPING_FEE`, `calcFoodTotals`, `getFoodItem` |
| `/food/offer` | `OFFERS`, `calcDiscount`, `calcFoodTotals`, `getFoodItem`, `isRuleAvailable` |
| `/food/confirm` · `/food/success` | `calcFoodTotals`, `getFoodItem`, `getOffer` |

Ngoài page: `lib/track.ts` nhập `SCREENS` và `ADD_TO_CART_STEP_INDEX`; `lib/use-route.ts` nhập `straightRoute`. Nội dung thật của các hằng số này ở `mock-data.md` và `event-taxonomy.md`.

`FIXED_ROUTE` **đã bị xoá**: quãng đường giờ lấy từ `GET /api/route` nên biến thiên và đi vào event (`distance_km`, `duration_min`, `route_source`). `FIXED_PICKUP` cũng không còn là hằng số — nó là điểm đón **mặc định**, đổi được ở Màn 2 (`ride-flow-design.md` mục 5.2).

---

## 9. Thêm một màn mới — thứ tự bắt buộc

Làm sai thứ tự sẽ sinh dữ liệu không dùng được:

1. **`event-taxonomy.md`** — thêm màn vào bảng mục 2, thêm event vào mục 3/4. Chốt với mentor **trước khi code** (`CLAUDE.md` quy tắc 6).
2. **`packages/shared/src/screens.ts`** — thêm vào `SCREENS` kèm `route`, `stepIndex`, `flow`. Thêm `ScreenName` mới vào `types.ts`.
3. **`apps/web/app/.../page.tsx`** — `'use client'`, gọi `useScreenView('<screen_name>')`, bọc `<ScreenShell>`.
4. **Guard nếu cần** — màn giữa luồng thì bọc `<FlowGuard>` với điều kiện state tương ứng.
5. **Kiểm tra** — đi hết luồng rồi đếm: số `screen_view` phải đúng bằng số màn đã qua.

Thêm `EventName` mới thì phải sửa **cả** union lẫn mảng `EVENT_NAMES` trong `types.ts` — có type assertion bắt lỗi nếu quên, nhưng biết trước vẫn hơn.

---

## 10. Giới hạn đã biết

**Guard chặn state rỗng, không ép thứ tự bước.**

Guard của `/ride/vehicle` chỉ kiểm tra `ride.addressId`. Gõ thẳng URL `/ride/vehicle` sau khi đã chọn địa chỉ sẽ **bỏ qua được `/ride/pickup`**, làm session thiếu step 2 trong funnel.

Đây là hệ quả chấp nhận được của thiết kế ở `screen-map.md` mục 1 — guard sinh ra để tránh session rỗng, không phải để chống người dùng cố tình. Trong phạm vi dự án (tự click sinh dữ liệu) không ai làm vậy.

**Giờ đã có cách sửa rẻ hơn trước.** `confirm_pickup` bây giờ gọi `setRide({ driverNote })` — kể cả khi ô ghi chú để trống, vì `driverNote` được ghi là chuỗi rỗng chứ không phải `undefined`. Nghĩa là `ride.driverNote !== undefined` đã là một tín hiệu đáng tin cho "đã đi qua bước 2", không cần thêm trường `pickupConfirmed` như ghi chú cũ đề xuất. Vẫn chưa đưa vào điều kiện `ready` vì tình huống này không xảy ra trong thực tế dùng — nhưng nếu funnel có số lạ ở step 2 thì đây là chỗ sửa, một dòng.

**Hai màn success đọc state rồi mới xoá.** Cả hai chụp tóm tắt vào `useState` trong `useEffect` trước khi gọi `clearRide()` / `clearCart()`. Bỏ bước chụp đó thì màn hình trống rỗng ngay sau khi render lần đầu.
