# screen-map.md — GSM ride-booking simulation

Đặc tả phía client: route, state, session, và hợp đồng của helper `trackEvent`. Nội dung event xem `event-taxonomy.md`; dữ liệu tĩnh xem `mock-data.md`.

## 1. Quyết định routing: mỗi bước là một route riêng

Mỗi màn hình = **một page App Router riêng**, không dùng một page + state để chuyển bước.

Lý do: `previous_screen` và Back của trình duyệt hoạt động đúng miễn phí, URL phản ánh đúng vị trí trong luồng nên demo cho mentor dễ hơn, và refresh giữa chừng không văng về đầu luồng.

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
  api/
    events/route.ts
    health/route.ts
```

Mọi page của 2 luồng đều là **client component** (`'use client'`) vì cần đọc state giỏ hàng / lựa chọn và bắn event. Chỉ `app/api/**` chạy server-side.

### Bảo vệ luồng (guard)
Vào thẳng một URL giữa luồng mà state rỗng (ví dụ mở `/ride/confirm` khi chưa chọn xe) → `redirect` về bước đầu của luồng (`/ride/address` hoặc `/food`) và **không bắn event nào**. Tránh sinh session rác trong dữ liệu phân tích.

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

**Reset session:** khi bấm `back_to_home` ở màn success, sinh `session_id` **mới** và xoá toàn bộ draft. Một session vì thế luôn tương ứng đúng một lần đi qua funnel — nếu không reset, một người click 5 lần sẽ nằm chung một session và mọi tỉ lệ conversion đều sai.

`crypto.randomUUID()` chỉ chạy được phía client → đọc/ghi storage trong `useEffect`, không đọc lúc render, tránh lỗi hydration mismatch của Next.js.

---

## 3. State trong app

Dùng React Context, không thêm thư viện state (đúng như `techstack.md`).

```ts
// lib/app-context.tsx
interface AppState {
  sessionId: string;
  userId: string;
  ride:  { addressId?: string; vehicleId?: string; promoId?: string | null };
  cart:  CartLine[];                 // { itemId, quantity }
  offerId?: string | null;
}
```

- Một `AppProvider` duy nhất trong `app/layout.tsx`.
- Ghi kèm `sessionStorage` (`gsm_ride_draft`, `gsm_cart`, `gsm_offer`) để F5 giữa luồng không mất lựa chọn.
- Giỏ hàng lưu **`itemId` + `quantity`**, không lưu `price`/`name` — giá lấy từ `mock-data.ts` lúc render, để đổi giá trong mock không làm giỏ hàng cũ sai.
- Clear: `ride` sau `confirm_ride`; `cart` + `offerId` sau `place_order`; tất cả sau `back_to_home`.
- `promoId`/`offerId` phân biệt 3 trạng thái: `undefined` = chưa tới bước đó, `null` = đã bỏ qua, `"promo-10k"` = đã chọn.

---

## 4. Hợp đồng `trackEvent`

```ts
// lib/track.ts — client-only
export function trackEvent(input: {
  flow: 'ride' | 'food';
  eventName: EventName;
  screenName: ScreenName;
  previousScreen: ScreenName | null;
  stepIndex: number;
  properties?: Record<string, unknown>;
}): void;   // ← trả về void, KHÔNG phải Promise
```

**Quy tắc bắt buộc:**

1. **Không `async`, trả `void`.** Không ai `await` được → không thể vô tình chặn điều hướng. Đây là lỗi dễ mắc nhất trong loại app này: `await` trước `router.push` làm UI khựng ~200ms mỗi lần bấm.
2. **`fetch(...).catch(() => {})`** — API lỗi hoặc mạng rớt tuyệt đối không được làm vỡ luồng UI. Mất một event chấp nhận được; kẹt người dùng thì không.
3. **`keepalive: true`** trong `fetch` — event cuối (`confirm_ride`, `place_order`) vẫn gửi được khi điều hướng xảy ra ngay sau đó.
4. **Không retry, không hàng đợi offline.** Ngoài phạm vi 6 tuần.
5. Helper tự chèn `session_id` và `user_id`; component gọi **không** truyền hai trường này. `platform` do server gắn.
6. `properties` mặc định `{}` khi không truyền.

```ts
export function trackEvent(input) {
  const body = { session_id: getSessionId(), user_id: getUserId(),
                 flow: input.flow, event_name: input.eventName,
                 screen_name: input.screenName, previous_screen: input.previousScreen,
                 step_index: input.stepIndex, properties: input.properties ?? {} };
  fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {});
}
```

### Hook `useScreenView`
```ts
useScreenView({ flow, screenName, previousScreen, stepIndex });
```
Bắn `screen_view` một lần khi mount. Dùng `useRef` chặn lần chạy thứ hai của React Strict Mode trong `next dev` — nếu không, **mọi `screen_view` sẽ bị nhân đôi** và funnel sai gấp đôi. Đây là bẫy phải xử lý ngay từ màn đầu tiên.

`previousScreen` lấy từ một biến module-level trong `lib/track.ts`, cập nhật mỗi lần `screen_view` bắn thành công — không tự suy ra từ route, vì Back của trình duyệt sẽ làm suy luận đó sai.

---

## 5. Màn hình kết thúc

Cả hai luồng có màn success riêng (route thật, không phải toast/modal) để funnel có mốc kết thúc rõ ràng.

**`/ride/success`** — icon tích cyan, "Đặt xe thành công", tóm tắt điểm đón + loại xe + giá cuối, nút `Về trang chủ`.

**`/food/success`** — tương tự, tóm tắt số món + tổng tiền cuối, nút `Về trang chủ`.

Cả hai: bấm `Về trang chủ` → bắn `back_to_home` → reset session (mục 2) → `router.replace('/')`. Dùng `replace` chứ không `push` để Back không quay ngược vào màn success của session đã đóng.

Không có màn lỗi/thất bại — app mô phỏng luôn thành công.

---

## 6. Responsive

Ưu tiên **mobile-first**: đây là mô phỏng app đặt xe, khung tham chiếu là điện thoại. Container chính `max-width: 480px`, canh giữa trên desktop. Breakpoint desktop trong `DESIGN.md` áp cho landing marketing của Green SM, không áp cho luồng đặt xe của dự án này.

Nút hành động chính của mỗi bước **dính đáy màn hình** (`sticky bottom-0`), cao tối thiểu 44px, cách mép dưới bằng `env(safe-area-inset-bottom)`.
