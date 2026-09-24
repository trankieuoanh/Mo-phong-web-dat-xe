# screen-map.md — GSM ride-booking simulation

Đặc tả phía client: route, state, session, và hợp đồng của helper `trackEvent`. Nội dung event xem `event-taxonomy.md`; dữ liệu tĩnh xem `mock-data.md`.

## 1. Quyết định routing: mỗi bước là một route riêng

Mỗi màn hình = **một page App Router riêng**, không dùng một page + state để chuyển bước.

Lý do: `previous_screen` và Back của trình duyệt hoạt động đúng miễn phí, URL phản ánh đúng vị trí trong luồng nên demo cho mentor dễ hơn, và refresh giữa chừng không văng về đầu luồng.

Mọi đường dẫn dưới đây tính từ **gốc repo** — một project Next.js duy nhất.

```
app/
  layout.tsx                    # <AppProvider> bọc toàn bộ
  page.tsx                      # /                       home — shell-free flow chooser
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
  account/page.tsx              # /account    NGOÀI FUNNEL
  support/page.tsx              # /support    NGOÀI FUNNEL
  terms/page.tsx                # /terms      NGOÀI FUNNEL
```

### Màn chọn luồng tại `/`

`/` là **chooser tập trung, không có shell**: không `AppShell`, `SideRail`, `TopBar`, panel bản đồ hay `ScreenShell` kiểu split. Nó có đúng hai lựa chọn với nhãn `Đặt xe` và `Đặt đồ ăn`, dẫn tới `/ride/address` và `/food`. Màn này vẫn dùng `screen_name: "home"`, `flow: "none"` và `step_index: 0`; không mặc định ride. Bấm một lựa chọn bắn `select_flow` trước khi điều hướng, không thêm event mới.

**`/history` không nằm trong funnel.** Nó không có trong `SCREENS`, **không gọi `useScreenView`, không gọi `trackEvent`**, nên không xuất hiện trong bất kỳ số liệu nào. Nó đọc `GET /api/events?user_id=...` và dựng lại lịch sử chuyến đi từ chính các event `confirm_ride` / `place_order`. Lọc theo `user_id` chứ không phải `session_id`, nên bảng bền qua nhiều phiên — đúng nghĩa "lịch sử người dùng", và là màn hữu ích nhất khi demo cho mentor.

**Ba màn còn lại cũng ngoài funnel.** `/account` (Tài khoản phụ), `/support` (Trung tâm hỗ trợ), `/terms` (Điều khoản & Chính sách) — dựng theo `sample_ui/tai_khoan_phu.png`, `trung_tam_ho_tro.png`, `dieu_khoan_va_chinh_sach.png`. Chúng là **nội dung tĩnh**, không phải bước nào của luồng nào, nên cũng không có trong `SCREENS` và không bắn event. Cả bốn màn ngoài funnel bọc bằng `AppShell` **trực tiếp**, không qua `ScreenShell` — `ScreenShell` mang theo khái niệm panel + footer CTA của một bước funnel. Trên desktop chúng nằm trong `SideRail`, còn trên mobile được mở từ menu `More`.

> `dieu_khoan_va_chinh_sach.png` chụp **trang web marketing** của Green SM (nav riêng, hero banner, breadcrumb, thanh cookie), không phải màn trong app. Chỉ lấy **nội dung** — bốn tên chính sách — chứ không dựng lại lớp vỏ, nếu không màn này sẽ có hệ điều hướng khác hẳn 13 màn còn lại.

> **Không có `/login`.** Dự án không có authentication — đây là quyết định có chủ ý, xem `api-endpoints.md`. Một màn đăng nhập giả chỉ thêm một đường đi lạc mà không đo thêm được gì. `UserMenu` trên top bar của các màn đã có shell vì vậy là trang trí hoàn toàn; nó chỉ hiện `user_id` đang dùng, để demo thấy ngay khoá mà `/history` tra.

`app/api/**/route.ts` là API của chính app này — cùng project, cùng process. Nghiệp vụ server nằm ở `lib/server/`, và page **không được** import từ đó (CLAUDE.md quy tắc 1).

Mọi page của 2 luồng đều là **client component** (`'use client'`) vì cần đọc state giỏ hàng / lựa chọn và bắn event. Không page nào có server-side logic.

### Bảo vệ luồng (guard)

`/ride/address` và `/food` là hai màn entry hợp lệ, nên mở trực tiếp chúng **không bị coi là URL rác**. Trước `screen_view` của màn entry, app bắn `select_flow` với `step_index: 0` và properties `{ flow_chosen, entry_source: "direct_url" }`; sau đó mới bắn `screen_view` của `address_selection` hoặc `food_menu`. Đây vẫn là event `select_flow` hiện có, không phải event mới.

Mở thẳng một URL giữa luồng mà state rỗng (ví dụ `/ride/confirm` khi chưa chọn xe) → `redirect` về màn entry tương ứng (`/ride/address` hoặc `/food`). Không bắn `screen_view` của URL giữa luồng bị chặn; màn entry sau redirect chịu trách nhiệm bắn `select_flow` direct-url trước `screen_view` của nó. `/` không phải entry của ride nữa — nó là chooser trung lập.

Implement: component `<FlowGuard ready={...} fallback="...">` bọc nội dung màn. Nó phải **đợi `hydrated`** trước khi redirect — trước khi đọc xong `sessionStorage` thì state luôn rỗng, và guard sẽ đá người dùng ra khỏi luồng ngay sau mỗi lần F5. Vì guard chạy trước khi nội dung mount, `useScreenView` bên trong không kịp chạy; đó là chủ ý, không phải tác dụng phụ.

---

## 2. Session & user

```ts
// lib/session.ts — client-only
const SESSION_KEY = 'gsm_session_id';
const USER_KEY    = 'gsm_user_id';
```

| | `session_id` | `user_id` |
|---|---|---|
| Sinh bằng | `crypto.randomUUID()` | `'mock-user-' + crypto.randomUUID().slice(0, 8)` |
| Lưu ở | `sessionStorage` | `localStorage` |
| Vòng đời | Một tab, một lượt thử luồng | Bền qua nhiều session, nhiều ngày |
| Ý nghĩa phân tích | 1 session = 1 lần thử hoàn thành luồng | Phân biệt người dùng quay lại |

**Drafts được giữ:** quay về `/`, đổi luồng ở màn entry hoặc màn ngoài funnel, và điều hướng giữa các màn không xoá draft của ride/food. Cùng một bộ lựa chọn vẫn còn sau khi đổi luồng rồi quay lại.

**Reset session:** chỉ khi bấm `back_to_home` ở màn success mới sinh `session_id` **mới** và dọn draft theo ranh giới hoàn thành một lượt thử. Một session vì thế vẫn tương ứng đúng một lần đi qua funnel; reset này không áp dụng cho việc chỉ mở chooser hoặc đổi luồng.

`crypto.randomUUID()` chỉ chạy được phía client → đọc/ghi storage trong `useEffect`, không đọc lúc render, tránh lỗi hydration mismatch của Next.js.

---

## 3. State trong app

Dùng React Context, không thêm thư viện state (đúng như `techstack.md`).

```ts
// lib/app-context.tsx
interface AppState {
  sessionId: string;
  userId: string;
  hydrated: boolean;                 // đã đọc xong sessionStorage chưa
  ride:  {
    destination?: Place;             // điểm đến, chọn ở màn 1
    pickup?: Place;                  // điểm đón, mặc định DEFAULT_PICKUP
    route?: RouteResult;             // tuyến đường — CHỈ màn 2 ghi, các màn sau đọc
    vehicleId?: string;
    promoId?: string | null;
    driverNote?: string;
    paymentMethod?: 'cash' | 'qr';
  };
  cart:  CartLine[];                 // { itemId, quantity }
  offerId?: string | null;
  food:  {
    origin?: Place;                  // địa chỉ giao — GPS hoặc người dùng chọn
    restaurantId?: string;           // quán đang xem
    restaurantName?: string;
  };
}
```

- Một `AppProvider` duy nhất trong `app/layout.tsx`.
- Ghi kèm `sessionStorage` (`gsm_ride_draft_v2`, `gsm_cart`, `gsm_offer`, `gsm_food_draft`) để F5 giữa luồng không mất lựa chọn; các draft này cũng được giữ khi đổi luồng ở entry/outside.

> **`food` giữ đúng hai thứ phải sống qua điều hướng, không hơn.** Bộ lọc của màn menu (ô tìm, chip bữa, chip loại món) **vẫn không lên context** — xem đoạn ngay dưới, quyết định đó không đổi. Nhưng địa chỉ giao và quán đã chọn thì phải sống: trước đây quán là state cục bộ của `app/food/page.tsx` nên mất ngay khi mở một món, và đó là lý do màn chi tiết món lẫn màn xác nhận không hiển thị nổi tên quán.
>
> `clearCart()` xoá luôn `food`: giỏ rỗng thì "món tại X" không còn nghĩa gì.

> **Vì sao lưu cả object `Place` chứ không chỉ `id`.** Địa chỉ người dùng tự tìm có `id` dạng `osm-*`, **không tra ngược ra tên bằng `getAddress()` được** — bảng tra chỉ có 5 dòng gợi ý (`mock-data.md` mục 1). Nhãn vì thế phải đi theo state.
>
> **Vì sao khoá là `_v2`.** Hình dạng `ride` đã đổi (`addressId: string` → `destination: Place`). `readJson` có `try/catch` nhưng **không kiểm tra hình dạng**, nên một draft cũ còn trong tab của người dùng sẽ trả về `{addressId: '…'}` và làm màn confirm nổ. Đổi khoá là cách rẻ nhất để bỏ draft cũ đi; khoá cũ vẫn nằm trong `DRAFT_KEYS` để lần reset đầu tiên dọn nốt nó.
- **Bộ lọc ở màn menu food KHÔNG vào `AppContext`.** Ô tìm, chip bữa, quán đang chọn, chip loại món đều là `useState` cục bộ của `app/food/page.tsx`: rời màn là quên, và đó là đúng — chúng là cách *tìm* món, không phải lựa chọn cần mang sang bước sau. Thứ cần mang sang đã nằm trong event (`discovery_source`).
- Giỏ hàng lưu **`itemId` + `quantity`**, không lưu `price`/`name` — giá lấy từ `lib/shared` lúc render, để đổi giá trong mock không làm giỏ hàng cũ sai.
- Clear: `ride` sau `confirm_ride`; `cart` + `offerId` sau `place_order`; đây là dọn sau khi hoàn thành, không phải hành vi khi mở `/` hoặc đổi luồng. Draft của luồng chưa hoàn thành được giữ cho tới khi `back_to_home` khởi tạo session mới.
- **`route` phải bị xoá cùng lúc với việc đổi `destination`** (`/ride/address`). Tuyến đường đã cắt trong draft thuộc về điểm đến trước đó; giữ lại thì sau `change_address`, bấm Back của trình duyệt về `/ride/vehicle` sẽ thấy giá tính theo quãng đường cũ, và `confirm_ride` ghi `distance_km` không khớp `address_label` trong cùng một document.
- `promoId`/`offerId` phân biệt 3 trạng thái: `undefined` = chưa tới bước đó, `null` = đã bỏ qua, `"promo-10k"` = đã chọn.

---

## 4. Hợp đồng `trackEvent`

```ts
// lib/track.ts — client-only
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
4. **Luôn `fetch('/api/events')` đường tương đối.** Route handler nằm cùng project nên đây là same-origin, không có preflight `OPTIONS` — điều kiện để hai event ở quy tắc 3 kịp gửi trước khi trang chuyển. Ghi thẳng một origin khác sẽ phá đúng tính chất đó.
5. **Không retry, không hàng đợi offline.** Ngoài phạm vi 6 tuần.
6. Helper tự chèn `session_id`, `user_id` và `previous_screen`; component gọi **không** truyền ba trường này. `platform` do server gắn.
7. `properties` mặc định `{}` khi không truyền.

### `flow` và `stepIndex` — tra bảng, không gõ tay

Hai tham số này **mặc định lấy từ bảng `SCREENS`** trong `lib/shared` (mã hoá bảng ở `event-taxonomy.md` mục 2). Gõ tay `step_index` ở 13 page là nguồn sai số liệu số một, và sai kiểu đó *không có triệu chứng* — app vẫn chạy đẹp, chỉ có funnel sai, và chỉ phát hiện ra ở Tuần 5.

Đúng **hai ngoại lệ** được truyền tay, và cả hai đều đi qua một helper riêng để không page nào phải tự gõ:

| Ngoại lệ | Truyền gì | Vì sao |
|---|---|---|
| `add_to_cart` | `stepIndex: 3` — helper `trackAddToCart(screenName, properties)` | Là hành động, không phải màn hình — bắn ở `food_menu` hay `food_item_detail` đều mang step 3 |
| `select_flow` | `flow` = luồng được chọn **và** `stepIndex: 0` — dùng lại helper/event `trackSelectFlow` hiện có | Là mốc "bắt đầu luồng này", tức bước 0 của funnel luồng được chọn. Chooser `/` dùng `screen_name: "home"`; màn entry và màn ngoài funnel dùng quy tắc `screen_name` riêng; direct URL ghi thêm `entry_source: "direct_url"` trước `screen_view` entry. |

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

## 6. Responsive và shell

Responsive là phạm vi của sản phẩm: **mọi màn sau khi chọn luồng** — tất cả các bước ride, food và bốn màn ngoài funnel — đều có bố cục mobile. `/` là ngoại lệ có chủ đích: đó là chooser tập trung, không có `AppShell`, `SideRail` hoặc `TopBar` ở bất kỳ viewport nào.

### 6.1 Chooser và shell sau lựa chọn

`/` chỉ có hai lựa chọn `Đặt xe` và `Đặt đồ ăn`, dẫn tới `/ride/address` và `/food`. Sau khi chọn, màn entry và mọi màn tiếp theo dùng shell chung; mở trực tiếp một màn entry vẫn đi qua cùng quy ước tracking, với `select_flow` direct-url trước `screen_view` (xem §1 và §4).

Từ **1120px**, desktop dùng `SideRail` cùng top bar:

```
┌──────┬──────────────────────────────────────┐
│ rail │ TopBar: section · tabs · UserMenu     │
│ 72px ├──────────────────────────────────────┤
│      │ main                                  │
└──────┴──────────────────────────────────────┘
```

- `SideRail` chứa hai control luồng `Đặt xe` / `Đặt đồ ăn` và bốn link màn ngoài funnel: `/history`, `/account`, `/support`, `/terms`.
- Dưới **1120px**, `SideRail` bị ẩn. Mọi màn có shell dùng `TopBar` hai hàng: hàng trên là section, `UserMenu`, giỏ và nút `More`; hàng dưới là control luồng hai lựa chọn chiếm toàn bộ chiều ngang. Menu `More` chứa `/history`, `/account`, `/support`, `/terms` và là đường vào duy nhất tới bốn route này trên mobile.
- `TopBar` và `SideRail` dùng chung quy tắc đổi luồng, không có hai bảng luật riêng.

| Vị trí | Control luồng |
|---|---|
| `/` | Hai lựa chọn của chooser; không có active flow giả định. |
| Entry `/ride/address` hoặc `/food` | Luồng đang đứng ở trạng thái active; luồng còn lại bấm được và bắn `select_flow`. |
| Giữa funnel (`/ride/pickup` trở đi, `/food/item/...` trở đi) | Luồng đang đứng active; **control đổi luồng còn lại bị disabled**, không tạo session lai. |
| Ngoài funnel (`/history`, `/account`, `/support`, `/terms`) | Cả hai luồng đều bấm được; `select_flow` ghi `screen_name` của màn entry đích. |

Việc mở lại `/`, quay lại entry hoặc đổi luồng ở vị trí được phép **không xoá draft** của ride hoặc food. Chỉ hành động kết thúc một lượt ở success mới reset session theo §2.

### 6.2 Hai bố cục và breakpoint

`ScreenShell` giữ nguyên năm prop cũ (`title`/`leading`/`trailing`/`children`/`footer`) và thêm `variant` / `aside` / `section` / `tabs` / `maxWidth`:

| variant | Hình dạng | Dùng cho |
|---|---|---|
| `split` | Panel trái 480px (tự cuộn) + `aside` chiếm phần còn lại, cao bằng panel | `address_selection`, `pickup_confirm`, `vehicle_selection`, `ride_confirm` — 4 màn ride có bản đồ |
| `wide` | Một cột canh giữa, bề ngang theo `maxWidth` | `promo_selection`, `ride_success`, toàn bộ luồng food, `/history` |

`home` **không thuộc danh sách `split`** và cũng không dùng map/panel; nó là chooser riêng. Bố cục `split` chỉ xếp panel và map cạnh nhau từ **1280px**. Từ 1120px đến dưới 1280px, desktop vẫn có `SideRail` nhưng `split` xếp chồng thành một cột; dưới 1120px mọi màn dùng gutter ngang **16px** và xếp chồng, không có thanh cuộn ngang.

### 6.3 Touch

Các control tương tác có vùng chạm **44-48px**; CTA chính dùng khoảng 48px, còn chip và control điều hướng không nhỏ hơn 44px. Dùng token spacing hiện có cho gutter 16px (`{spacing.lg}`), không tạo thêm giá trị spacing chỉ cho mobile.
