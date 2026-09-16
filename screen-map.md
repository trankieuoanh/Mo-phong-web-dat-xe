# screen-map.md — GSM ride-booking simulation

Đặc tả phía client: route, state, session, và hợp đồng của helper `trackEvent`. Nội dung event xem `event-taxonomy.md`; dữ liệu tĩnh xem `mock-data.md`.

## 1. Quyết định routing: mỗi bước là một route riêng

Mỗi màn hình = **một page App Router riêng**, không dùng một page + state để chuyển bước.

Lý do: `previous_screen` và Back của trình duyệt hoạt động đúng miễn phí, URL phản ánh đúng vị trí trong luồng nên demo cho mentor dễ hơn, và refresh giữa chừng không văng về đầu luồng.

Mọi đường dẫn dưới đây nằm trong **`apps/web/`**.

```
app/
  layout.tsx                    # <AppProvider> bọc toàn bộ
  page.tsx                      # /                       home
  ride/
    address/page.tsx            # /ride/address           address_selection
    pickup/page.tsx             # /ride/pickup            pickup_confirm
    vehicle/page.tsx            # /ride/vehicle           vehicle_selection
    promo/page.tsx              # /ride/promo             promo_selection
    confirm/page.tsx            # /ride/confirm           ride_confirm
    success/page.tsx            # /ride/success           ride_success
  food/
    page.tsx                    # /food                   food_menu
    item/[itemId]/page.tsx      # /food/item/banh-mi-01   food_item_detail
    cart/page.tsx               # /food/cart              food_cart
    offer/page.tsx              # /food/offer             food_offer_selection
    confirm/page.tsx            # /food/confirm           food_confirm
    success/page.tsx            # /food/success           food_success

  history/page.tsx              # /history    NGOÀI FUNNEL — không có screen_name
```

**`/history` không nằm trong funnel.** Nó không có trong `SCREENS`, **không gọi `useScreenView`, không gọi `trackEvent`**, nên không xuất hiện trong bất kỳ số liệu nào. Nó đọc `GET /api/events?user_id=...` và dựng lại lịch sử chuyến đi từ chính các event `confirm_ride` / `place_order`. Lọc theo `user_id` chứ không phải `session_id`, nên bảng bền qua nhiều phiên — đúng nghĩa "lịch sử người dùng", và là màn hữu ích nhất khi demo cho mentor.

> **Không có `/login`.** Dự án không có authentication — đây là quyết định có chủ ý, xem `api-endpoints.md`. Một màn đăng nhập giả chỉ thêm một đường đi lạc mà không đo thêm được gì. `UserMenu` ở top bar vì vậy là trang trí hoàn toàn; nó chỉ hiện `user_id` đang dùng, để demo thấy ngay khoá mà `/history` tra.

Không còn `app/api/` — API nằm ở `apps/api`, một process riêng. `apps/web/next.config.ts` proxy `/api/*` sang đó.

Mọi page của 2 luồng đều là **client component** (`'use client'`) vì cần đọc state giỏ hàng / lựa chọn và bắn event. `apps/web` không có server-side logic nào.

### Bảo vệ luồng (guard)
Vào thẳng một URL giữa luồng mà state rỗng (ví dụ mở `/ride/confirm` khi chưa chọn xe) → `redirect` về bước đầu của luồng (`/ride/address` hoặc `/food`) và **không bắn event nào**. Tránh sinh session rác trong dữ liệu phân tích.

Implement: component `<FlowGuard ready={...} fallback="...">` bọc nội dung màn. Nó phải **đợi `hydrated`** trước khi redirect — trước khi đọc xong `sessionStorage` thì state luôn rỗng, và guard sẽ đá người dùng ra khỏi luồng ngay sau mỗi lần F5. Vì guard chạy trước khi nội dung mount, `useScreenView` bên trong không kịp chạy — đó là chủ ý, không phải tác dụng phụ.

---

## 2. Session & user

```ts
// apps/web/lib/session.ts — client-only
const SESSION_KEY = 'gsm_session_id';
const USER_KEY    = 'gsm_user_id';
```

| | `session_id` | `user_id` |
|---|---|---|
| Sinh bằng | `crypto.randomUUID()` | `'mock-user-' + crypto.randomUUID().slice(0, 8)` |
| Lưu ở | `sessionStorage` | `localStorage` |
| Vòng đời | Một tab, một lượt thử luồng | Bền qua nhiều session, nhiều ngày |
| Ý nghĩa phân tích | 1 session = 1 lần thử hoàn thành luồng | Phân biệt người dùng quay lại |

**Reset session:** khi bấm `back_to_home` ở màn success, sinh `session_id` **mới** và xoá toàn bộ draft. Một session vì thế luôn tương ứng đúng một lần đi qua funnel — nếu không reset, một người click 5 lần sẽ nằm chung một session và mọi tỉ lệ conversion đều sai.

`crypto.randomUUID()` chỉ chạy được phía client → đọc/ghi storage trong `useEffect`, không đọc lúc render, tránh lỗi hydration mismatch của Next.js.

---

## 3. State trong app

Dùng React Context, không thêm thư viện state (đúng như `techstack.md`).

```ts
// apps/web/lib/app-context.tsx
interface AppState {
  sessionId: string;
  userId: string;
  hydrated: boolean;                 // đã đọc xong sessionStorage chưa
  ride:  {
    destination?: Place;             // điểm đến, chọn ở màn 1
    pickup?: Place;                  // điểm đón, mặc định DEFAULT_PICKUP
    vehicleId?: string;
    promoId?: string | null;
    driverNote?: string;
    paymentMethod?: 'cash' | 'qr';
  };
  cart:  CartLine[];                 // { itemId, quantity }
  offerId?: string | null;
}
```

- Một `AppProvider` duy nhất trong `app/layout.tsx`.
- Ghi kèm `sessionStorage` (`gsm_ride_draft_v2`, `gsm_cart`, `gsm_offer`) để F5 giữa luồng không mất lựa chọn.

> **Vì sao lưu cả object `Place` chứ không chỉ `id`.** Địa chỉ người dùng tự tìm có `id` dạng `osm-*`, **không tra ngược ra tên bằng `getAddress()` được** — bảng tra chỉ có 5 dòng gợi ý (`mock-data.md` mục 1). Nhãn vì thế phải đi theo state.
>
> **Vì sao khoá là `_v2`.** Hình dạng `ride` đã đổi (`addressId: string` → `destination: Place`). `readJson` có `try/catch` nhưng **không kiểm tra hình dạng**, nên một draft cũ còn trong tab của người dùng sẽ trả về `{addressId: '…'}` và làm màn confirm nổ. Đổi khoá là cách rẻ nhất để bỏ draft cũ đi; khoá cũ vẫn nằm trong `DRAFT_KEYS` để lần reset đầu tiên dọn nốt nó.
- Giỏ hàng lưu **`itemId` + `quantity`**, không lưu `price`/`name` — giá lấy từ `@gsm/shared` lúc render, để đổi giá trong mock không làm giỏ hàng cũ sai.
- Clear: `ride` sau `confirm_ride`; `cart` + `offerId` sau `place_order`; tất cả sau `back_to_home`.
- `promoId`/`offerId` phân biệt 3 trạng thái: `undefined` = chưa tới bước đó, `null` = đã bỏ qua, `"promo-10k"` = đã chọn.

---

## 4. Hợp đồng `trackEvent`

```ts
// apps/web/lib/track.ts — client-only
export function trackEvent(input: {
  eventName: EventName;
  screenName: ScreenName;
  flow?: Flow;        // mặc định: SCREENS[screenName].flow
  stepIndex?: number; // mặc định: SCREENS[screenName].stepIndex
  properties?: Record<string, unknown>;
}): void;   // ← trả về void, KHÔNG phải Promise
```

**Quy tắc bắt buộc:**

1. **Không `async`, trả `void`.** Không ai `await` được → không thể vô tình chặn điều hướng. Đây là lỗi dễ mắc nhất trong loại app này: `await` trước `router.push` làm UI khựng ~200ms mỗi lần bấm.
2. **`fetch(...).catch(() => {})`** — API lỗi hoặc mạng rớt tuyệt đối không được làm vỡ luồng UI. Mất một event chấp nhận được; kẹt người dùng thì không.
3. **`keepalive: true`** trong `fetch` — event cuối (`confirm_ride`, `place_order`) vẫn gửi được khi điều hướng xảy ra ngay sau đó.
4. **Luôn `fetch('/api/events')` đường tương đối.** Ghi thẳng `http://localhost:4000` sẽ thành cross-origin, kích hoạt preflight `OPTIONS`, và hai event ở quy tắc 3 không kịp gửi.
5. **Không retry, không hàng đợi offline.** Ngoài phạm vi 6 tuần.
6. Helper tự chèn `session_id`, `user_id` và `previous_screen`; component gọi **không** truyền ba trường này. `platform` do server gắn.
7. `properties` mặc định `{}` khi không truyền.

### `flow` và `stepIndex` — tra bảng, không gõ tay

Hai tham số này **mặc định lấy từ bảng `SCREENS`** trong `@gsm/shared` (mã hoá bảng ở `event-taxonomy.md` mục 2). Gõ tay `step_index` ở 13 page là nguồn sai số liệu số một, và sai kiểu đó *không có triệu chứng* — app vẫn chạy đẹp, chỉ có funnel sai, và chỉ phát hiện ra ở Tuần 5.

Đúng **hai ngoại lệ** được truyền tay:

| Ngoại lệ | Truyền gì | Vì sao |
|---|---|---|
| `add_to_cart` | `stepIndex: 3` | Là hành động, không phải màn hình — bắn ở `food_menu` hay `food_item_detail` đều mang step 3. Dùng helper `trackAddToCart(screenName, properties)` |
| `select_flow` ở `home` | `flow: 'ride' \| 'food'` | Màn `home` có `flow: 'none'`, nhưng event này phải ghi đúng luồng được chọn để đếm được tỉ lệ giữa 2 luồng |

### Hook `useScreenView`
```ts
useScreenView(screenName);   // chỉ một tham số
```
Bắn `screen_view` một lần khi mount. Dùng `useRef` chặn lần chạy thứ hai của React Strict Mode trong `next dev` — nếu không, **mọi `screen_view` sẽ bị nhân đôi** và funnel sai gấp đôi. Đây là bẫy phải xử lý ngay từ màn đầu tiên.

`previousScreen` **không** là tham số: nó là một biến module-level trong `track.ts`, cập nhật sau mỗi lần `screen_view` bắn — không tự suy ra từ route, vì Back của trình duyệt sẽ làm suy luận đó sai. `resetPreviousScreen()` được gọi khi reset session, để màn kế tiếp có `previous_screen: null`.

---

## 5. Màn hình kết thúc

Cả hai luồng có màn success riêng (route thật, không phải toast/modal) để funnel có mốc kết thúc rõ ràng.

**`/ride/success`** — icon tích cyan, "Đặt xe thành công", tóm tắt điểm đến + loại xe + giá cuối, nút `Về trang chủ`.

**`/food/success`** — tương tự, tóm tắt số món + tổng tiền cuối, nút `Về trang chủ`.

Cả hai: bấm `Về trang chủ` → bắn `back_to_home` → reset session (mục 2) → `router.replace('/')`. Dùng `replace` chứ không `push` để Back không quay ngược vào màn success của session đã đóng.

Không có màn lỗi/thất bại — app mô phỏng luôn thành công.

---

## 6. Responsive

**Desktop-first.** Khung tham chiếu là **web Green SM trên máy tính**, không phải app điện thoại — xem 4 ảnh chụp trong `apps/web/sample_ui/` (`homepage.png`, `main_screen.png`, `history.png`, `login.png`). Cả bốn đều có rail icon dọc bên trái, top bar, và nội dung hai cột.

> Bản trước của mục này chốt mobile-first `max-width: 480px`. Đã đổi vì ảnh mẫu cho thấy sản phẩm thật là web desktop; giữ một cột 480px giữa màn 1600px làm bản mô phỏng không nhận ra là Green SM. Thay đổi này **thuần trình bày** — không route nào, không event nào, không `step_index` nào bị ảnh hưởng.

### Khung chung

`components/shell/AppShell.tsx` bọc mọi màn:

```
┌──────┬──────────────────────────────────────┐
│ rail │ TopBar: section · tabs · UserMenu     │
│ 72px ├──────────────────────────────────────┤
│      │ main (p-2xl)                          │
└──────┴──────────────────────────────────────┘
```

- **`SideRail`** — 6 mục. **Hai trạng thái**: mở rộng `w-[264px]` có nhãn chữ (mặc định, như `homepage.png`) và thu gọn `w-[72px]` chỉ-icon (như `main_screen.png`); nút "Thu gọn menu" ở đáy chuyển qua lại, lựa chọn nhớ ở `localStorage['gsm_rail_collapsed']` (đọc trong `useEffect`, không đọc lúc render — bẫy hydration). Chỉ bấm được ở đúng hai chỗ: hai mục luồng **khi đang ở `/`** (bắn `select_flow`, cùng helper và cùng `properties` với hai card giữa màn), và mục "Hoạt động" (link `/history`). Bốn mục còn lại và hai mục luồng ở mọi màn khác là **trang trí** (`ride-flow-design.md` §8). Dưới `lg` (1024px) rail ẩn hoàn toàn.
- Nhãn theo **dự án này**, không copy nguyên ảnh mẫu: Green SM thật có dịch vụ "Giao hàng" (giao kiện hàng), còn luồng thứ hai ở đây là **"Đặt đồ ăn"**.
- **`TopBar`** — `section` là tên **mục** ("Di chuyển", "Giao hàng", "Hoạt động"), `tabs` thuần trang trí.

### Hai bố cục

`ScreenShell` giữ nguyên năm prop cũ (`title`/`leading`/`trailing`/`children`/`footer`) và thêm `variant` / `aside` / `section` / `tabs` / `maxWidth`:

| variant | Hình dạng | Dùng cho |
|---|---|---|
| `split` | Panel trái 480px (tự cuộn) + `aside` chiếm phần còn lại, cao bằng panel | `address_selection`, `pickup_confirm`, `vehicle_selection`, `ride_confirm` — 4 màn có bản đồ |
| `wide` | Một cột canh giữa, bề ngang theo `maxWidth` | `home`, `promo_selection`, `ride_success`, toàn bộ luồng food, `/history` |

Dưới `lg`, `split` xếp chồng thành một cột (`flex-col`), không có thanh cuộn ngang.

### Nút hành động

Dính **đáy panel** (footer của `components/Panel.tsx`), không dính đáy màn hình. Cao tối thiểu 48px. `env(safe-area-inset-bottom)` đã bỏ — nó chỉ có ý nghĩa với notch điện thoại.
