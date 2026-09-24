# food-flow-design.md — thiết kế giao diện luồng Đặt đồ ăn

> Tài liệu này mô tả **giao diện** 6 màn của luồng food, đối xứng với `ride-flow-design.md`.
>
> Nó **không** thay thế `event-taxonomy.md`. Hợp đồng dữ liệu giữ nguyên: 23 `event_name`, `step_index` 0→7. Khi hai file mâu thuẫn, `event-taxonomy.md` thắng.

---

## 1. Mục đích & phạm vi

Luồng ride đã được nâng qua `ride-flow-design.md`; luồng food thì chưa từng có tài liệu nào — chính file đó ghi ở §1: *"Ngoài phạm vi: luồng Food (không đổi)"*. Hệ quả là sáu màn food vẫn ở mức wireframe: danh sách phẳng, không ảnh, không trạng thái tải/lỗi, không focus ring, và bề ngang panel nhảy 1120→880→760→600 qua từng bước.

Đồng thời, dữ liệu thật mới đi được nửa đường: `GET /api/restaurants` đã trả quán ăn thật, nhưng màn menu gọi nó bằng `DEFAULT_PICKUP` hardcode, và `status`/`error` của hook bị vứt đi.

> **Vòng test tay đầu tiên phát hiện một sự thật không nằm trong code:** máy chạy dự án **không kết nối được `*.openstreetmap.org`**, nên bản đồ trắng ở cả hai luồng và dải "Gần bạn" luôn rỗng. Hai triệu chứng trông như hai lỗi giao diện riêng biệt nhưng là một. Dự án vì thế đã chuyển tile sang CARTO, địa chỉ sang Photon, quán ăn sang Overpass — và hai cái sau **tốt hơn cái cũ** chứ không chỉ là còn sống. Xem `setup.md` và `api-endpoints.md` mục 3b.

**Việc của tài liệu này:** nâng lớp giao diện lên ngang luồng ride và cắm nó vào dữ liệu vị trí thật, **giữ nguyên hợp đồng dữ liệu** để dữ liệu sinh trước và sau khi nâng cấp ghép được vào cùng một funnel.

**Ngoài phạm vi:** luồng ride (không đổi), `screens.ts` (không đổi một dòng — thêm màn là đánh số lại `step_index` của cả luồng), authentication (`CLAUDE.md` quy tắc 11).

---

## 2. Ánh xạ spec → hợp đồng hiện có

### 2.1 Màn hình — không thêm, không bớt

| Bước | `screen_name` | Route | `step_index` |
|---|---|---|:--:|
| 1 — Danh sách món | `food_menu` | `/food` | 1 |
| 2 — Chi tiết món | `food_item_detail` | `/food/item/[itemId]` | 2 |
| *(hành động)* — Thêm vào giỏ | *(không phải màn)* | — | 3 |
| 4 — Giỏ hàng | `food_cart` | `/food/cart` | 4 |
| 5 — Chọn ưu đãi | `food_offer_selection` | `/food/offer` | 5 |
| 6 — Xác nhận đơn | `food_confirm` | `/food/confirm` | 6 |
| 7 — Đặt thành công | `food_success` | `/food/success` | 7 |

**Việc đổi địa chỉ giao KHÔNG được thành một route mới.** Thêm một màn là đánh số lại toàn bộ `step_index` của luồng food và làm dữ liệu cũ không ghép được với dữ liệu mới. Thay vào đó dùng **Pattern J** của `/ride/pickup` — hoán đổi thân panel ngay tại `food_menu` giữa nội dung menu và `<PlacePicker>`, kèm nút "Huỷ". Người dùng thấy một bước; funnel không thấy gì cả.

### 2.2 Event

**Không có `EventName` mới.** Toàn bộ bản nâng cấp nằm gọn trong 23 event đã chốt — đây là lý do nó rẻ.

| Event | Thay đổi | Vì sao |
|---|---|---|
| `change_address` | **Tái dùng** cho `food_menu` (trước đây chỉ có ở luồng ride) | Dòng "Giao tới" bấm được, mà `ride-flow-design.md` §8 quy định: một nút bấm được mà không bắn event là một khoảng mù. Tên đã có sẵn trong union nên không phải sửa `types.ts`. |
| `search_item` | **Thêm khoá** `restaurant_count` | Ô tìm giờ tìm cả quán thật lẫn món. `result_count` giữ nguyên nghĩa **số món** để dữ liệu cũ vẫn ghép được; số quán là một con số khác và phải có khoá riêng. |
| `select_offer` | **Đổi thời điểm bắn**, không đổi properties | Xem §7. |
| `place_order` | **Thêm khoá** `address_label`, `address_source` | Event kết thúc funnel phải tự mô tả đủ một đơn hàng — `/history` dựng lại đơn từ riêng nó mà không biết giao đi đâu. Cùng lý do `confirm_ride` của luồng ride mang địa chỉ. |

Mọi event còn lại giữ nguyên tên và nguyên khoá, kể cả sự bất đối xứng cố ý của `discovery_source` (có ở `add_to_cart` bắn từ `food_menu`, không có ở `food_item_detail`).

---

## 3. Chi tiết từng màn

Class viết theo bảng ánh xạ ở `tailwind-theme.md` §4. Không giá trị nào nằm ngoài token (`CLAUDE.md` quy tắc 4).

**Bố cục:** `screen-map.md` §6 chốt **cả sáu màn food đều là `variant="wide"`**. Muốn có bản đồ thì dùng `<MapCanvas fill={false} />` (chế độ `aspect-[4/3]`) **bên trong** panel, không đổi sang `split`.

**Bề ngang thống nhất:** `/food` giữ `max-w-[1120px]` vì lưới món cần chỗ; **năm màn còn lại dùng `max-w-[760px]`**. Hiện panel co giãn thấy rõ khi đi qua funnel — đó là dấu hiệu wireframe rõ nhất còn lại.

### 3.1 `food_menu` — `/food`

| Khối | Thành phần | Class | Event |
|---|---|---|---|
| Header | `BackButton` + "Đặt đồ ăn" | `nav-bar` | `back` → `home` |
| Giao tới | nhãn + địa chỉ + pill "Đổi" | `t-caption text-mute` / `t-body-md-strong` / `bg-canvas text-primary-dark rounded-pill` | `change_address` khi chốt |
| Ô tìm | `Icon search` + input + nút xoá | `bg-canvas-soft rounded-md p-lg` | `search_item` (debounce 600ms) |
| Gợi ý bữa | 3 chip, chip trùng giờ có "· bây giờ" | `category-button` | `select_meal` |
| Gần bạn | dải `RestaurantCard` cuộn ngang | `bg-canvas-soft rounded-xl w-[240px]` | `select_restaurant` |
| Loại món | "Tất cả" + `FOOD_CATEGORIES` | `category-button` | `filter_category` |
| Lưới món | `FoodThumb` + tên + mô tả + giá + nút "+" | `bg-canvas-soft rounded-xl` | `select_item` / `add_to_cart` |
| Footer | "Xem giỏ hàng (n) · tổng" | `button-primary` | *(điều hướng)* |

**Giải phẫu một thẻ món.** Cả thẻ là **một** `<button>` (`select_item`); nút "+" là một `<button>` riêng nằm chồng lên, không lồng nhau. Hiện `<li>` sáng lên khi hover nhưng hàng giá nằm ngoài vùng bấm — hover vào chỗ không bấm được là một lời nói dối nhỏ, và nó lặp lại ở mọi thẻ.

**Bốn cách tìm món vẫn loại trừ nhau** — một `Filter` union duy nhất, để `discovery_source` chỉ là phép đọc trường `kind`.

**`menuOf(place, 6)`** thay cho mặc định 3: chọn một quán mà lưới tụt xuống còn 3 thẻ trông như lỗi. `item_count` trong `select_restaurant` phải đọc **cùng** giá trị — event nói 3 mà màn hình hiện 6 là hai nguồn sự thật.

**Trạng thái dải "Gần bạn":** `loading` → 4 skeleton card; `error` → `EmptyState` + nút "Thử lại"; `ready` nhưng rỗng → dòng giải thích. Hiện cả ba trạng thái gộp thành "không render gì", và `error` của hook **không nơi nào đọc**.

### 3.2 `food_item_detail` — `/food/item/[itemId]`

Hai cột `md:grid-cols-2`: trái `FoodThumb` lớn (4:3), phải tên + kiểu bếp + mô tả + giá + `QuantityStepper`.

Thêm **tên quán** đọc từ `food.restaurantName` trong context — hiện ngữ cảnh "món tại X" mất hẳn khi rời màn menu. Thêm dòng "Đã có N trong giỏ" khi món đã có.

Nút trừ phải `disabled` thật ở số lượng 1. Hiện nó vẫn bấm được còn hàm xử lý lặng lẽ `return` — một control trông sống mà không làm gì.

### 3.3 `food_cart` — `/food/cart`

Giỏ rỗng render **`EmptyState` thật** + CTA "Xem thực đơn", không redirect. `useScreenView` gọi ở đầu page nên `screen_view` vốn **đã** bắn trước cả khi `FlowGuard` kịp redirect — bỏ guard không đổi số event. (Phải xác nhận bằng curl trước khi commit; nếu khác thì giữ guard.)

Card tổng tiền phải có **hàng tổng cộng** `border-t border-canvas pt-lg` (Pattern D). Hiện chỉ có "Tiền hàng" + "Phí giao hàng" — giỏ hàng không nói cho người dùng biết họ sắp trả bao nhiêu, trong khi mọi bước của luồng ride đều hiện giá đang chạy.

Mỗi dòng: `FoodThumb` `size-14` + tên + **đơn giá** + `QuantityStepper` + nút xoá.

### 3.4 `food_offer_selection` — `/food/offer`

**Tick rồi xác nhận** (Pattern M của `/ride/promo`): bấm một ưu đãi chỉ set state local và hiện check bubble; footer đổi giữa `primary` "Áp dụng ưu đãi" và `subtle` "Bỏ qua". Xem §7 cho hệ quả dữ liệu.

Row theo Pattern A: ô icon `ticket` + tiêu đề + mô tả + dòng "Giảm X". Ưu đãi không đủ điều kiện giữ `opacity-50 cursor-not-allowed` + dòng lý do `.t-caption text-mute`, và **không bắn event nào** (`mock-data.md` §5).

**Ô nhập mã `<DiscountCodeInput />` ở đầu màn.** Trước đây chỉ `/ride/promo` có ô này, nên hai funnel song song mà một bên thiếu hẳn một cách tương tác — `offer_usage` và `promo_usage` vì thế không so sánh được với nhau (`analysis-spec.md` §97, §100). Cùng component, cùng hành vi: gõ đúng mã thì tick chọn, **chưa bắn event**; `select_offer` vẫn chỉ bắn ở footer.

Dòng lý do đến từ `formatRuleBlock(ruleBlock(offer, cartTotal, { hour }))`, nên nói đúng điều kiện đang chặn — "Chỉ áp dụng 05:00–10:00" cho `SANG20`, "Cần đơn tối thiểu 300.000đ" cho `FOOD50K`. Luồng food không có hạng xe lẫn quãng đường nên `ctx` chỉ mang `hour`, và **`hour` phải đọc trong `useEffect`** đúng như `mealOfHour()` ở `/food` (bẫy hydration).

Số tiền giảm dùng `calcDiscount(offer, cartTotal, SHIPPING_FEE)` — tham số thứ ba là bắt buộc ở màn này vì `FREESHIP` và `SHIP50` giảm trên **phí giao**, không phải trên tiền hàng.

### 3.5 `food_confirm` — `/food/confirm`

Hiện màn này chỉ có số lượng và tiền — một màn xác nhận đơn mà không nói giao tới đâu, từ quán nào, bao giờ tới. Thêm:

- Địa chỉ giao (từ `food.origin`) + `<MapCanvas fill={false} />` trong panel wide.
- Tên quán + ETA.
- **Chip ưu đãi Pattern E**: `bg-primary-dark text-on-primary rounded-pill` với `−số tiền`. Đây là chỗ duy nhất trong app cyan được dùng làm nền trạng thái tích cực; luồng food đang mất nó.

`place_order` giữ nguyên 6 khoá cũ và **thêm `address_label` + `address_source`** — `/history` dựng lại đơn từ chính document này, và trước đây nó không thể nói đơn được giao đi đâu. Xem `event-taxonomy.md`.

### 3.6 `food_success` — `/food/success`

Hero: vòng tròn `size-20` + `Icon check`. **Nền đổi từ `bg-primary` sang `bg-primary-dark`**: trắng trên `#00B4B8` chỉ đạt 2.6:1, dưới chuẩn AA (`tailwind-theme.md` §0b, và `PrimaryButton.tsx` đã cảnh báo đúng tổ hợp này).

Hai hàng tổng kết lúc `summary` còn `null` render `Skeleton`, không phải chuỗi `'—'` trần.

---

## 4. Dữ liệu thật: vị trí & tìm quán

**Vị trí.** `lib/use-current-place.ts` gọi `navigator.geolocation.getCurrentPosition` (timeout 8s). Mọi nhánh thất bại — từ chối, timeout, trình duyệt không hỗ trợ — lui về `DEFAULT_PICKUP` với `status: 'fallback'`, và màn hình nói rõ điều đó.

Toạ độ có trước và dùng được ngay, rồi **`GET /api/reverse` nâng nhãn lên địa chỉ thật** (`21.0369,105.7856` → `Ngõ 1 Phố Phan Văn Trường, Cầu Giấy, Hà Nội`). Reverse là bước phụ, không chặn luồng: dải "Gần bạn" chỉ cần lat/lon.

Vị trí GPS **phải được ghi vào `food.origin`**. Thiếu bước này là một bug thật đã từng làm màn xác nhận nói dối: màn menu hiện đúng vị trí người dùng trong khi màn confirm đọc context rỗng và hiện địa chỉ mặc định hardcode, ghim bản đồ sai chỗ — hai màn nói hai địa chỉ khác nhau cho cùng một đơn.

**Tìm quán.** `GET /api/restaurants` dùng **Overpass**, không phải Nominatim. Nominatim là geocoder nên `amenity=restaurant` trả về 6-hoặc-0 quán ngay giữa Cầu Giấy; Overpass truy vấn theo bán kính và trả về ~80 quán ở đúng toạ độ đó. Lọc theo tên làm ở JS bằng `normalizeVi` nên gõ không dấu vẫn ra ("pho" → "Phở"). Chi tiết ở `api-endpoints.md` mục 3b-bis.

**Menu vẫn là dữ liệu tĩnh.** OpenStreetMap không có thực đơn và không nguồn mở nào có giá món thật. Quán là thật, thực đơn suy ra từ tag `cuisine` thật qua `menuOf()` — xem `mock-data.md` §4b. Tài liệu này không giả vờ ngược lại.

**Ảnh món là ảnh thật**, tải sẵn về `public/food/` từ Wikimedia Commons (`scripts/fetch-food-images.mjs`), ghi công ở `CREDITS.md`. Món thiếu ảnh lui về khung glyph.

---

## 5. State bổ sung

```ts
interface FoodDraft {
  origin?: Place;          // địa chỉ giao — GPS hoặc người dùng chọn
  restaurantId?: string;   // quán đang xem, để sống qua bước confirm
  restaurantName?: string;
}
```
sessionStorage key `gsm_food_draft`. `clearCart()` xoá luôn.

**Bộ lọc menu vẫn KHÔNG lên context** — `screen-map.md` §3 cố ý như vậy, và giữ nguyên. Chỉ `origin` và quán đã chọn mới lên, vì hai thứ đó phải sống tới màn confirm; cái còn lại đã nằm trong event (`discovery_source`).

---

## 6. Component dùng chung mới

| Component | Thay cho |
|---|---|
| `QuantityStepper` | 2 bản `QtyButton` lệch màu nền |
| `SummaryRow` | `Row` copy **5 lần** qua cả hai luồng |
| `FoodThumb` | 4 chỗ tự vẽ ô chữ cái |
| `Skeleton` | — (rút từ `PlacePicker`) |
| `EmptyState` | 1 dòng text trần |
| `RestaurantCard` | card viết thẳng trong `page.tsx` |

**`FoodThumb` — ảnh món không cần ảnh.** `mock-data.md` §4 cấm ảnh thật và không có field ảnh. Giữ nguyên lệnh cấm, nâng chất lượng khung: nền `bg-gradient-to-br from-canvas-soft to-surface-pressed` (hai token có sẵn — không sinh giá trị mới), một glyph theo `cuisine` ở `text-primary-dark`, chữ cái đầu làm lớp nền mờ. `FoodItem` thêm `image?: string` **để trống toàn bộ 29 món**, để sau này thả ảnh vào `public/food/<id>.webp` là chạy, không phải sửa code.

Glyph mới vẽ thẳng vào `components/Icon.tsx` (`bowl`, `cup`, `cake`, `fish`, `pizza`, `grill`) — `CLAUDE.md` quy tắc 8 cấm **thư viện** icon, không cấm vẽ thêm path.

---

## 7. Thay đổi hành vi & hệ quả phân tích

**`select_offer` đổi từ "bắn khi bấm row" sang "bắn khi bấm footer".** Hiện bấm một ưu đãi là điều hướng ngay, nên một phiên có thể sinh **nhiều** `select_offer` (quay lại rồi chọn lại), và trạng thái `ring-2 ring-primary` gần như không bao giờ nhìn thấy được. Sau thay đổi: đúng **một** `select_offer` mỗi phiên, giống `select_promo` của luồng ride, và hai funnel so sánh được với nhau. Properties không đổi.

Dữ liệu sinh trước thay đổi này: lấy bản ghi `select_offer` **cuối cùng** trong phiên.

**`change_address` xuất hiện trên `food_menu`.** Phân tích luồng ride lọc theo `screen_name` chứ không chỉ theo tên event thì không ảnh hưởng.

---

## 8. Thành phần trang trí (không bắn event)

Nguyên tắc `ride-flow-design.md` §8: *một nút bấm được mà không bắn event là một hành vi không đo được.* Những thứ sau **phải** render static hoặc `disabled`, kèm `aria-hidden` khi thuần trang trí:

- Tab top bar `['Đặt món','Đang diễn ra','Đơn đã lưu']` — trang trí ở cả sáu màn.
- Chip kiểu bếp trên `RestaurantCard`, dòng giờ mở cửa, số điện thoại.
- ETA và mã đơn ở `food_confirm` / `food_success`.
- `UserMenu` (`CLAUDE.md` quy tắc 11).

Ngoại lệ có chủ đích: cặp tab luồng thêm vào `TopBar` cho màn hẹp **có** bắn `select_flow` qua `trackSelectFlow`, và chỉ bấm được trên 3 route entry — đúng bảng `FLOW_ENTRY` của `SideRail`.

---

## 9. Cố ý không làm

Ảnh món thật (`mock-data.md` §4) · màn đăng nhập (quy tắc 11) · màn mới trong luồng food (đánh số lại `step_index`) · `variant="split"` cho food (`screen-map.md` §6) · thư viện mới (quy tắc 8) · đổi `id` món/ưu đãi (quy tắc 5) · đổi properties của `place_order` (`/history` đọc lại) · reverse-geocode toạ độ GPS · màn báo lỗi đặt đơn.

---

## 10. Checklist nghiệm thu

```bash
npm run typecheck && npm run lint && npm run build

curl -s "localhost:3000/api/restaurants?lat=21.0369&lon=105.7856&q=pho" | jq '.[] | {label, cuisine}'

# Đi hết luồng food trên localhost:3000, rồi:
curl -s "localhost:3000/api/events?session_id=<id>" | jq '.[] | {event_name, screen_name, step_index}'
```

Phải đúng:
- **6 `screen_view`**, không hơn (Strict Mode nhân đôi là bẫy đã biết).
- `step_index`: `food_menu` 1 · `food_item_detail` 2 · `add_to_cart` 3 · `food_cart` 4 · `food_offer_selection` 5 · `food_confirm` 6 · `food_success` 7.
- Đúng **một** `select_offer` mỗi phiên.
- `place_order` đủ 6 khoá.

Kiểm tra quy tắc dự án:
```bash
grep -rn "lib/server" app components lib --include=*.tsx  # rỗng ngoài app/api/
grep -rn "trackEvent(\|useScreenView(" app/history         # rỗng
grep -n "OpenStreetMap" components/MapCanvas.tsx          # còn dòng ghi công
```

Kiểm tra bằng mắt: tắt `lib/server` → `/food` vẫn dùng được, dải "Gần bạn" hiện lỗi kèm nút thử lại chứ không biến mất · từ chối quyền vị trí → lui về `DEFAULT_PICKUP` kèm caption · thu nhỏ xuống 375px → vẫn đổi được luồng · đi bằng phím Tab qua từng màn → mọi control đều thấy focus ring.
