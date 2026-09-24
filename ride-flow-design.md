# ride-flow-design.md — thiết kế giao diện luồng Đặt xe

> Tài liệu này mô tả **giao diện** 6 màn của luồng ride, bám theo bản hướng dẫn thiết kế app GSM thật.
>
> Nó **không** thay thế `event-taxonomy.md`. Hợp đồng dữ liệu giữ nguyên: 19 `event_name`, `step_index` 0→6. Khi hai file mâu thuẫn, `event-taxonomy.md` thắng.

---

## 1. Mục đích & phạm vi

Luồng ride hiện tại chạy đúng nhưng nhìn như một bản wireframe: sáu màn danh sách phẳng, không bản đồ, hai hạng xe. Bản hướng dẫn thiết kế mô tả app thật — bản đồ, bottom sheet, sáu hạng xe, ghi chú tài xế, phương thức thanh toán, màn ưu đãi có tab và ô nhập mã.

**Việc của tài liệu này:** nâng lớp giao diện lên mức đó, trong khi **giữ nguyên hợp đồng dữ liệu** để dữ liệu sinh trước và sau khi nâng cấp vẫn ghép được vào cùng một funnel.

Nguyên tắc xuyên suốt: *giao diện bám app thật, dữ liệu bám taxonomy đã chốt.* Chỗ nào hai bên không thoả hiệp được thì dữ liệu thắng, và lý do được ghi lại ngay tại chỗ.

**Ngoài phạm vi:** luồng Food (không đổi), backend (không đổi), `lib/shared/types.ts` và `screens.ts` (không đổi một dòng nào).

---

## 2. Ánh xạ spec → hợp đồng hiện có

Đây là phần cần mentor duyệt trước tiên.

### 2.1 Màn hình

Năm màn của spec ánh xạ **1–1** vào năm màn ride hiện có, đúng thứ tự:

| Spec | `screen_name` | Route | `step_index` |
|---|---|---|:--:|
| Màn 1 — SearchDestinationScreen | `address_selection` | `/ride/address` | 1 |
| Màn 2 — ConfirmPickupScreen | `pickup_confirm` | `/ride/pickup` | 2 |
| Màn 3 — ServiceSelectionScreen | `vehicle_selection` | `/ride/vehicle` | 3 |
| Màn 4 — VoucherScreen | `promo_selection` | `/ride/promo` | 4 |
| Màn 5 — ServiceSelection (sau khi áp mã) | `ride_confirm` | `/ride/confirm` | 5 |
| *(spec không có)* | `ride_success` | `/ride/success` | 6 |

Hai chỗ lệch so với spec, và lý do:

**Màn 3 và Màn 5 của spec là cùng một màn**, chỉ khác ở chỗ đã áp mã ưu đãi hay chưa. Ở đây tách thành hai route, vì funnel cần hai mốc riêng: *"đã chọn xe"* và *"đã bấm đặt"* là hai tỉ lệ rớt khác nhau, và khoảng cách giữa chúng chính là câu hỏi đáng giá nhất của luồng này. Gộp lại thì mất luôn khả năng đo. Bù lại, hai route **dùng chung khung giao diện** (`MapCanvas` + bottom sheet) nên với người dùng vẫn là một màn liền mạch.

**Màn 4 là overlay trong spec**, ở đây là route thật. Bắt buộc, vì `screen_view` của `promo_selection` là mốc đo "bao nhiêu người mở xem ưu đãi". Vẫn trình bày dạng sheet phủ toàn màn với nút `X` ở góc để cảm giác vẫn là overlay.

**Màn `ride_success` không có trong spec** nhưng giữ nguyên: funnel cần một mốc kết thúc rõ ràng, và `screen-map.md` §5 đã chốt là route thật chứ không phải toast.

### 2.2 Event

| Tên trong spec | Event dùng thật | Ghi chú |
|---|---|---|
| `click_destination_option` | `select_address` | **thêm khoá** `address_source` |
| `confirm_pickup_point` | `confirm_pickup` | **thêm khoá** `driver_note` |
| `select_vehicle_type` | `select_vehicle` | `{ vehicle_id, vehicle_type, base_price }` — giữ nguyên |
| `click_voucher_button` | *(không cần)* | `screen_view` của `promo_selection` đã là mốc đó |
| `apply_voucher_success` | `select_promo` | `{ promo_id, promo_code, discount_amount }` — giữ nguyên |
| `submit_booking_click` | `confirm_ride` | **thêm khoá** `payment_method` |

**Không có `EventName` mới.** Toàn bộ spec nằm gọn trong 19 event đã chốt — đây là lý do bản nâng cấp này rẻ. Chỉ thêm khoá vào `properties`, đúng quy trình `event-taxonomy.md` §6 mục 2 (field đặc thù theo loại event → cho vào `properties`, Firestore không cần migrate, pandas dùng `.fillna()`).

Các khoá mới, ghi vào `event-taxonomy.md` §3:

| Event | Khoá mới | Kiểu | Vì sao đáng ghi |
|---|---|---|---|
| `select_address` | `address_source` | `"preset" \| "search"` | Đo được ô tìm có thực sự cần không, hay 5 gợi ý đã đủ. Phải là khoá riêng chứ không đoán qua tiền tố id |
| `confirm_pickup` | `driver_note` | `string` (rỗng nếu không nhập) | Đo được tỉ lệ người thực sự dùng ô ghi chú — một câu hỏi UX thật, và là trường duy nhất người dùng tự gõ trong cả app |
| `confirm_pickup` | `pickup_id`, `pickup_label`, `pickup_source` | `string` | Điểm đón từ hằng số thành lựa chọn thật. `pickup_id != "pickup-current"` chính là tỉ lệ người đổi điểm đón |
| `confirm_ride` | `payment_method` | `"cash" \| "qr"` | Là một lựa chọn của người dùng ở bước cuối; không ghi thì không biết ai đổi khỏi mặc định |
| `confirm_ride` | `address_label`, `address_source`, `pickup_id`, `pickup_label` | `string` | Event này phải **tự mô tả đủ một chuyến đi**: màn `/history` dựng bảng từ riêng nó, và với địa chỉ tự tìm thì không có bảng nào tra id ra tên |

---

## 3. Chi tiết từng màn

Class viết theo bảng ánh xạ ở `tailwind-theme.md` §4. Không giá trị nào nằm ngoài token (`CLAUDE.md` quy tắc 4).

Khung chung: `ScreenShell` — rail trái + top bar, rồi một trong hai bố cục desktop (`screen-map.md` §6):

| Màn | `variant` | Cột phải (`aside`) |
|---|---|---|
| 1 `address_selection` | `split` | `<MapCanvas variant="pickup" fill />` |
| 2 `pickup_confirm` | `split` | `<MapCanvas variant="pickup" label={pickup.label} fill />` |
| 3 `vehicle_selection` | `split` | `<MapCanvas variant="route" fill />` |
| 4 `promo_selection` | `wide`, `max-w-[600px]` | — (màn này vốn là overlay, không có bản đồ) |
| 5 `ride_confirm` | `split` | `<MapCanvas variant="route" fill />` |
| 6 `ride_success` | `wide`, `max-w-[600px]` | — |

Nút hành động chính nằm ở footer của `Panel`, dính đáy panel chứ không dính đáy màn hình.

---

### Màn 1 — `/ride/address` · `address_selection` · step 1

**Mục tiêu:** chọn **điểm đến** — *"Bạn muốn đi đến đâu?"*, đúng như spec.

> **Điểm đến là lựa chọn chính; điểm đón có giá trị mặc định nhưng đổi được ở Màn 2.** `ADDRESSES` là danh sách điểm đến **gợi ý**, hiện khi ô tìm còn trống. Điểm đón khởi tạo bằng `DEFAULT_PICKUP` (`"Vị trí hiện tại"`) — giống app thật, nơi GPS tự xác định rồi người dùng xác nhận lại.
>
> Hai địa chỉ dùng **hai bộ khoá riêng** trong event: `address_*` cho điểm đến, `pickup_*` cho điểm đón. Không cái nào tốn thêm `step_index` — ô tìm điểm đón nằm ngay trong Màn 2 chứ không phải một màn mới.

| Khối | Thành phần | Class | Event |
|---|---|---|---|
| Nav-bar | `BackButton` + selector `Hà Nội 🇻🇳` | `nav-bar` | `back` → `home` |
| Hành động nhanh | "Sử dụng vị trí hiện tại" | `category-button` | — *(trang trí)* |
| Ô tìm kiếm | `<PlacePicker>` — input + icon kính lúp | `text-input`: `bg-canvas-soft rounded-md p-lg t-body-md` | — *(chỉ tra cứu)* |
| Danh sách | Kết quả `GET /api/places`, hoặc 5 gợi ý từ `ADDRESSES` khi ô trống | `request-form-input-row` | `select_address` |
| Footer | "Địa chỉ đã lưu" · "Tìm trên bản đồ" · toggle sáp nhập tỉnh | `category-button` | — *(trang trí)* |

**Một dòng địa chỉ** gồm: icon tròn (`icon-button-circular`) · `label` (`.t-body-md-strong`) · khoảng cách (`.t-caption text-mute`, **chỉ có với địa chỉ gợi ý**) · `address` đầy đủ (`.t-body-sm text-body`). Dòng đang chọn có `ring-2 ring-primary`.

**Ô tìm kiếm gọi `GET /api/places`** (Photon/OpenStreetMap qua `app/api/places/route.ts`), debounce 400 ms, chỉ gọi từ 3 ký tự trở lên, huỷ request cũ bằng `AbortController`. **Không bắn event**: kết quả cuối cùng đã nằm trong `select_address`; ghi thêm event cho mỗi ký tự gõ vào chỉ làm nhiễu.

`select_address` mang thêm **`address_source`** (`'preset' | 'search'`) để phân tích tách được "chọn gợi ý" với "tự tìm" — xem `event-taxonomy.md`.

**Suy biến êm khi mất mạng:** Nominatim rớt hoặc trả 429 → hiện một dòng cảnh báo **nhưng vẫn liệt kê 5 địa chỉ gợi ý**, luồng đi tiếp được bình thường. Cùng tinh thần với `trackEvent().catch(() => {})`: hạ tầng lỗi không được kẹt người dùng.

**Không có `FlowGuard`** — đây là bước đầu luồng.

---

### Màn 2 — `/ride/pickup` · `pickup_confirm` · step 2

**Mục tiêu:** xác nhận **hoặc đổi** điểm đón, xem lại điểm đến, nhập ghi chú cho tài xế.

> **Ô tìm điểm đón nằm trong chính màn này, không phải một route riêng.** Thêm một màn là đánh số lại toàn bộ `step_index` và làm dữ liệu cũ không ghép được với dữ liệu mới (§9). Bấm "Đổi điểm đón" chỉ đổi nội dung panel, `screen_name` và `step_index` giữ nguyên.

| Khối | Thành phần | Class | Event |
|---|---|---|---|
| Nav-bar | `BackButton` | `nav-bar` | `back` → `address_selection` |
| Bản đồ | `<MapCanvas variant="pickup" label={pickup.label} fill />` | — | — |
| Sheet · điểm đón | `pickup.label` + "bán kính 10 m" *(chỉ khi chưa đổi)* | `.t-display-sm` + `.t-caption text-mute` | — |
| Sheet · điểm đón | `pickup.address` | `.t-body-sm text-body` | — |
| Sheet · điểm đón | "Đổi điểm đón" → mở `<PlacePicker>` ngay trong panel | `category-button` | — *(chỉ đổi state)* |
| Sheet · điểm đến | `label` + `address` của địa chỉ vừa chọn | `.t-body-md-strong` + `.t-body-sm text-body` | — |
| Sheet · ghi chú | input "Thêm ghi chú cho bác tài (ví dụ: gần cổng)" | `text-input` | — *(ghi vào state)* |
| Sheet · phụ | "Đổi điểm đến" | `button-secondary` | `change_address` |
| Footer | "Chọn điểm đón này" | `button-primary` | `confirm_pickup` |

`confirm_pickup` mang `{ address_id, driver_note }` — `address_id` là **điểm đến**; điểm đón là hằng số nên không ghi. `driver_note` là chuỗi rỗng khi người dùng không nhập — **không** dùng `null`, để pandas đếm `(df.driver_note != '').mean()` ra ngay tỉ lệ dùng.

Nút re-center GPS và dòng "bán kính 10 m" là trang trí — không có toạ độ thật để re-center về.

`FlowGuard`: `ready={Boolean(ride.addressId)}`, `fallback="/ride/address"`.

---

### Màn 3 — `/ride/vehicle` · `vehicle_selection` · step 3

**Mục tiêu:** chọn hạng xe.

| Khối | Thành phần | Class | Event |
|---|---|---|---|
| Nav-bar | `BackButton` + "Đặt hộ" | `nav-bar` | `back` → `pickup_confirm` |
| Bản đồ | `<MapCanvas variant="route" />` + tooltip `34 phút • 15 km` | — | — |
| Sheet · danh sách | 6 hạng xe từ `VEHICLES` | `request-form-input-row` | `select_vehicle` |
| Sheet · banner | "Boost — có xe nhanh hơn" | `card-soft-tinted` | — *(trang trí)* |
| Sheet · thanh toán | "Tiền mặt" (mặc định) | `category-button` | — *(trang trí ở màn này)* |
| Sheet · ưu đãi | nút "Ưu đãi" | `category-button` | — *(chỉ điều hướng)* |
| Sheet · điều hướng | "Hẹn giờ" · "GreenNow" | `category-button` | — *(trang trí)* |
| Footer | "Tiếp tục" | `button-primary` | — *(chỉ điều hướng)* |

**Một dòng xe** gồm: icon (`bike`/`car` từ `components/Icon.tsx`) · `name` (`.t-body-md-strong`) · `description` (`.t-body-sm text-body`) · "Đón trong N phút · M chỗ" (`.t-caption text-mute`) · **giá của chuyến này** = `calcFare(vehicle, route.distanceKm)` (`.t-body-md-strong`, format `formatVnd`). Dòng đang chọn: `ring-2 ring-primary`.

Nút "Ưu đãi" và nút "Tiếp tục" **đều điều hướng sang `/ride/promo`** — spec có nút Ưu đãi riêng, giữ cả hai cho giống, nhưng không bắn event cho việc điều hướng (`screen_view` của màn sau đã ghi nhận).

Nút "Tiếp tục" **disabled** khi chưa chọn xe.

`FlowGuard`: `ready={Boolean(ride.addressId)}`, `fallback="/ride/address"`.

---

### Màn 4 — `/ride/promo` · `promo_selection` · step 4

**Mục tiêu:** chọn, nhập, hoặc bỏ qua mã ưu đãi.

| Khối | Thành phần | Class | Event |
|---|---|---|---|
| Nav-bar | nút `X` + tiêu đề "Ưu đãi" | `nav-bar` | `back` → `vehicle_selection` |
| Tab | "Mã ưu đãi" *(active)* · "VPoint" | `category-button` | — *(VPoint trang trí)* |
| Ô nhập mã | `<DiscountCodeInput />` | `text-input` + `button-subtle` | — *(chỉ tick chọn)* |
| Banner | gói hội viên | `card-soft-tinted` | — *(trang trí)* |
| Danh sách | 7 promo từ `PROMOS` + checkbox | `request-form-input-row` | — *(chỉ tick chọn)* |
| Footer | "Bỏ qua ưu đãi và tiếp tục" / "Áp dụng mã" | `button-subtle` / `button-primary` | `skip_promo` / `select_promo` |

Nút `X` vẫn là `BackButton from="promo_selection" to="vehicle_selection"` — hình chữ X nhưng hành vi và event y hệt nút Back, để `to_screen` khớp `event-taxonomy.md`.

**Nút footer đổi theo trạng thái:** chưa tick promo nào → "Bỏ qua ưu đãi và tiếp tục" (`skip_promo`, `promoId = null`). Đã tick → "Áp dụng mã" (`select_promo`, `promoId = id`). Cả hai đều `router.push('/ride/confirm')`.

**Ô nhập mã** là component `DiscountCodeInput`, **dùng chung với `/food/offer`** — chép khối này thành hai bản là đúng loại trùng lặp mà `PlacePicker` đã cảnh báo ở đầu file của nó. Gõ đúng `code` (không phân biệt hoa thường) rồi bấm "Áp dụng" → tick promo tương ứng, **chưa bắn event**. Gõ sai → `Mã không hợp lệ`. Gõ đúng nhưng chưa đủ điều kiện → nói rõ **điều kiện nào** chưa thoả, chứ không báo chung chung: nhập `GSMBIKE` trong lúc đang chọn ô tô mà chỉ nhận được "Mã không hợp lệ" thì người dùng sẽ gõ lại thêm vài lần vô ích.

**Promo không đủ điều kiện** vẫn hiển thị nhưng `disabled`, kèm dòng giải thích `.t-caption text-mute` — giữ nguyên quy tắc `mock-data.md` §3. Câu giải thích không còn gắn cứng "Cần đơn tối thiểu X" mà đến từ `formatRuleBlock(ruleBlock(...))`, nên nói đúng điều kiện đang chặn:

| Điều kiện | Mã ví dụ | Dòng hiện ra |
|---|---|---|
| `vehicleTypes` | `GSMBIKE`, `GSMCAR` | Chỉ áp dụng cho xe máy |
| `minDistanceKm` | `GSMFAR` | Cho chuyến từ 8 km |
| `activeHours` | `GSMTRUA` | Chỉ áp dụng 11:00–13:00 |
| `minOrder` | `GSM20` | Cần đơn tối thiểu 50.000đ |

`ctx` truyền vào `ruleBlock` ở màn này là `{ vehicleType, distanceKm, hour }` — hạng xe và quãng đường đã có sẵn từ `getVehicle` + `routeOrFallback`, còn `hour` **phải đọc trong `useEffect`** (bẫy hydration, `mock-data.md` §3). Các điều kiện này chỉ gác **quyền dùng**; `calcDiscount` không xét chúng, để số tiền ở màn này, màn xác nhận và trong `confirm_ride` luôn bằng nhau.

`FlowGuard`: `ready={Boolean(ride.addressId && ride.vehicleId)}`, `fallback="/ride/address"`.

---

### Màn 5 — `/ride/confirm` · `ride_confirm` · step 5

**Mục tiêu:** tóm tắt, chọn phương thức thanh toán, đặt xe.

Dùng **lại đúng khung của Màn 3** (bản đồ + bottom sheet) để người dùng thấy mình vẫn ở cùng một màn, chỉ khác nội dung sheet.

| Khối | Thành phần | Class | Event |
|---|---|---|---|
| Nav-bar | `BackButton` | `nav-bar` | `back` → `promo_selection` |
| Bản đồ | `<MapCanvas variant="route" />` | — | — |
| Sheet · tuyến | hai hàng "Điểm đón = `FIXED_PICKUP.label`" và "Điểm đến = `address.label`" | `card-content` | — |
| Sheet · xe | hạng xe đã chọn + giá gốc | `card-content` | — |
| Sheet · ưu đãi | badge xanh "`promo.title` · −X đ", hoặc "Không áp dụng" | `category-button` | — |
| Sheet · thanh toán | "Tiền mặt" / "QR" — chọn được | `category-button` + `ring-2 ring-primary` | — *(ghi vào state)* |
| Sheet · tổng | "Tổng cộng" + `finalPrice` | `.t-display-sm` | — |
| Footer | "Đặt xe" | `button-primary` | `confirm_ride` |

Số tiền lấy từ `calcRideTotals(calcFare(vehicle, route.distanceKm), promo)` — **cùng một hàm** với lúc ghi event, nên số trên màn và số trong dữ liệu không thể lệch nhau. Tuyến đường được lấy **một lần** ở Màn 2 rồi cất vào `RideDraft.route`; hai lần fetch có thể ra hai quãng đường hơi khác nhau và làm hỏng chính điều đó.

`confirm_ride` mang `{ address_id, vehicle_id, vehicle_type, promo_id|null, base_price, discount_amount, final_price, payment_method }`.

`FlowGuard`: `ready={Boolean(addressId && vehicleId && promoId !== undefined)}`, `fallback="/ride/address"`.

---

### Màn 6 — `/ride/success` · `ride_success` · step 6

Giữ nguyên như hiện tại: icon tích cyan, tiêu đề "Đặt xe thành công", card tóm tắt (điểm đến · hạng xe · tổng thanh toán), nút "Về trang chủ" → `back_to_home` → `resetAll()` → `router.replace('/')`.

Không có `BackButton` — dùng `replace` để Back không quay ngược vào session đã đóng.

Vẫn phải **chụp tóm tắt vào `useState` trước khi gọi `clearRide()`**, nếu không màn hình trống ngay sau lần render đầu.

---

## 4. `MapCanvas` — bản đồ thật

Bản trước vẽ một lưới phố **bịa** với tuyến đường hằng số, nên hai chuyến đi khác hẳn nhau vẫn ra cùng một hình. Giờ cả nền lẫn tuyến đều theo toạ độ thật.

```ts
interface MapCanvasProps {
  pickup: Place;
  destination?: Place;      // không có = chỉ ghim điểm đón
  route?: RouteResult | null;
  label?: string;
  fill?: boolean;           // cao bằng panel khi nằm ở cột `aside`
}
```

**Vẫn không dùng thư viện bản đồ** (`CLAUDE.md` quy tắc 8). Một bản đồ tĩnh chỉ cần chiếu Web Mercator và xếp một lưới thẻ `<img>`:

1. `ResizeObserver` đo khung.
2. Chọn zoom lớn nhất mà toàn bộ tuyến vẫn lọt, chừa lề 12%.
3. `x = (lon+180)/360 · 256·2^z`, `y = (1 − ln(tan φ + sec φ)/π)/2 · 256·2^z`.
4. Xếp `<img src="https://tile.openstreetmap.org/{z}/{x}/{y}.png">` định vị tuyệt đối.
5. Phủ `<svg>`: polyline tuyến (viền trắng dưới, `primary-dark` trên — để nổi trên nền tile nhiều màu) + hai ghim.

**Dòng `© OpenStreetMap` là bắt buộc** — điều khoản dùng tile yêu cầu, không phải chi tiết thẩm mỹ.

Cụm `+`/`−` và nút re-center **giờ làm thật** (đổi zoom, đưa khung về vừa khít tuyến). Chúng không bắn event vì không đổi bất kỳ lựa chọn nào của người dùng — khác với một nút bấm được mà không làm gì, thứ mục 8 gọi là khoảng mù.

Màu: tile là ảnh bên ngoài, không phải token. Mọi thứ **ta vẽ** vẫn chỉ dùng token trong `globals.css`.


## 5. Mock data

### 5.1 Sáu hạng xe — giá tính theo km

Thay bảng ở `mock-data.md` §2. Giữ `veh-bike` và `veh-car` (`CLAUDE.md` quy tắc 5), thêm 4 `id` mới. `type` vẫn chỉ `'bike' | 'car'` nên `vehicle_type` trong event không đổi kiểu.

**`basePrice` đã bị xoá.** Giá không còn là thuộc tính của hạng xe mà là hàm của (hạng xe, quãng đường):

```
base_price = round((openingFare + max(0, distance_km − 2) × pricePerKm) / 1000) × 1000
```

| `id` | `type` | `name` | `openingFare` | `pricePerKm` | `etaMinutes` | `seats` | 15 km ra |
|---|---|---|---:|---:|:--:|:--:|---:|
| `veh-bike` | `bike` | Green Bike | 15000 | 3300 | 2 | 1 | 58.000 |
| `veh-bike-plus` | `bike` | Green Bike Plus | 20000 | 4000 | 3 | 1 | 72.000 |
| `veh-mini` | `car` | Green Mini | 28000 | 9000 | 3 | 3 | 145.000 |
| `veh-car` | `car` | Green Car | 32000 | 9000 | 3 | 4 | 149.000 |
| `veh-premium` | `car` | Green Premium | 35000 | 9700 | 3 | 4 | 161.000 |
| `veh-limo` | `car` | Green Limo | 46000 | 11400 | 4 | 6 | 194.000 |

Ba điều phải biết trước khi áp dụng bảng này:

1. **Hệ số được chọn để một chuyến 15 km ra đúng giá cố định cũ** — cột cuối. 15 km là quãng đường của `FIXED_ROUTE` đã xoá, nên mọi ảnh chụp màn hình và ghi chép demo từ trước vẫn khớp; chỉ **cách tính** đổi, không phải **thang giá**.
2. **`base_price` chỉ đọc được khi có `distance_km` đi kèm.** Đó là lý do `select_vehicle` mang thêm `distance_km` — người bỏ dở ở bước chọn xe không bao giờ sinh ra `confirm_ride`.
3. **Phân tích lựa chọn xe theo `vehicle_type`** (2 nhóm bike/car) thay vì theo từng `vehicle_id`. Với 30 session ride thì 2 nhóm còn nói được điều gì đó, 6 nhóm thì không. Vẫn giữ `vehicle_id` trong event để sau này nhiều dữ liệu hơn thì bóc tách được.

### 5.2 Điểm đón mặc định — và `FIXED_ROUTE` đã bị xoá

```ts
export const FIXED_PICKUP = {
  id: 'pickup-current',
  label: 'Vị trí hiện tại',
  address: '128 Xuân Thủy, Cầu Giấy, Hà Nội',
  lat: 21.0369,
  lon: 105.7856,
};
```

Đây là **giá trị khởi tạo**, không còn là hằng số bất biến: Màn 2 có ô tìm điểm đón, và `confirm_pickup` ghi lại `pickup_id` / `pickup_label` / `pickup_source`.

**`FIXED_ROUTE = { distanceKm: 15, durationMin: 34 }` đã bị xoá.** Quãng đường và thời gian giờ lấy từ `GET /api/route` (OSRM) theo đúng hai điểm người dùng chọn, nên chúng biến thiên và **đi vào event**: `confirm_ride` mang `distance_km`, `duration_min`, `route_source`.

`route_source` là `'osrm'` hoặc `'straight'`. Bắt buộc phải có: đường chim bay luôn ngắn hơn đường bộ đáng kể — đo thực tế Cầu Giấy → Nội Bài là **20,3 km** so với **25 km** đường thật — nên trộn hai loại sẽ kéo mọi thống kê quãng đường xuống một cách vô hình.

### 5.3 Toạ độ trong `Address`

`distanceKm` đã bị xoá, thay bằng `lat` / `lon` **bắt buộc**:

| `id` | `lat` | `lon` | cách điểm đón (haversine) |
|---|---:|---:|---:|
| `addr-home` | 21.0052 | 105.7989 | 3.8 km |
| `addr-office` | 21.0174 | 105.7836 | 2.2 km |
| `addr-mall` | 21.0023 | 105.8160 | 5.0 km |
| `addr-school` | 20.9886 | 105.9460 | 17.5 km |
| `addr-airport` | 21.2189 | 105.8045 | 20.3 km |

Khoảng cách hiển thị ở Màn 1 **tính tại chỗ** bằng `haversineKm()` từ điểm đón hiện tại. Trường hardcode cũ là khoảng cách tới điểm đón **cũ**, nên từ khi điểm đón đổi được nó bảo đảm có lúc hiện sai.

---

## 6. State — `RideDraft` thêm hai trường

`lib/app-context.tsx`:

```ts
interface RideDraft {
  addressId?: string;
  vehicleId?: string;
  promoId?: string | null;
  driverNote?: string;              // mới — Màn 2
  paymentMethod?: 'cash' | 'qr';    // mới — Màn 5, mặc định 'cash'
}
```

Vẫn ghi xuống khoá `gsm_ride_draft` qua `useEffect` sẵn có — không cần khoá `sessionStorage` mới, không cần đụng `session.ts`.

Chỉ **2** lựa chọn thanh toán chứ không 3. Lý do giống mục 5.1: mỗi lựa chọn thêm là một lần chia nhỏ mẫu.

`promoId` giữ nguyên ba trạng thái `undefined` (chưa tới bước) / `null` (đã bỏ qua) / `id` — `FlowGuard` của Màn 5 dựa vào đó.

---

## 7. Hai thay đổi hành vi

Spec đổi cách chọn từ "bấm là đi luôn" sang "chọn rồi bấm nút xác nhận". Việc này đổi số lượng event sinh ra, nên phải ghi lại:

| Màn | Hiện tại | Sau khi đổi | Hệ quả với dữ liệu |
|---|---|---|---|
| Màn 3 — chọn xe | Bấm xe → bắn `select_vehicle` → chuyển màn ngay | Bấm xe → bắn `select_vehicle`, **ở lại màn**; nút "Tiếp tục" mới chuyển màn | Một session có thể có **nhiều** `select_vehicle`. Đây là dữ liệu tốt — đo được sự phân vân giữa các hạng xe. Funnel không hỏng vì đếm bằng `groupby('step_index').session_id.nunique()`. |
| Màn 4 — chọn ưu đãi | Bấm promo → bắn `select_promo` → chuyển màn ngay | Bấm promo chỉ tick chọn; nút "Áp dụng mã" mới bắn `select_promo` + chuyển màn | Đúng **một** `select_promo` mỗi session — sạch hơn hiện tại. |

Script phân tích cần biết: khi đếm "hạng xe được chọn", lấy `select_vehicle` **cuối cùng** của mỗi session, không phải cái đầu.

---

## 8. Thành phần chỉ để trang trí

Những khối dưới đây **render tĩnh hoặc `disabled`, không bắn event, không đổi state**:

| Màn | Thành phần |
|---|---|
| 1 | Selector tỉnh/thành "Hà Nội" · "Sử dụng vị trí hiện tại" · icon tim yêu thích · nút `...` mỗi dòng · "Địa chỉ đã lưu" · "Tìm trên bản đồ" · toggle "hiển thị địa chỉ sau sáp nhập tỉnh" |
| 2 | Nút re-center GPS · dòng "bán kính 10 m" |
| 3 | Nút "Đặt hộ" · banner "Boost" · thanh thanh toán · "Hẹn giờ" · "GreenNow" |
| 4 | Tab "VPoint" · banner gói hội viên |
| mọi màn | **`SideRail`** — bốn mục "Tài khoản phụ" / "Trung tâm hỗ trợ" / "Điều khoản" / "Thu gọn menu", cùng hai mục luồng khi KHÔNG ở màn đầu luồng (`/`, `/ride/address`, `/food`). Tab trong `TopBar`. Chip người dùng trong `UserMenu` (trừ "Đăng xuất") |
| mọi màn có bản đồ | Cụm nút `+`/`−`, nút re-center, tooltip địa chỉ trong `MapCanvas` |

Lý do — và đây là điều quan trọng nhất trong tài liệu này:

> **Một nút bấm được mà không bắn event là hành vi không đo được.** Người dùng đi một đường, dữ liệu kể một đường khác, và đến Tuần 5 thì không còn cách nào biết bên nào đúng. Render tĩnh thì trung thực hơn: nhìn vẫn đầy đủ như app thật, mà không tạo ra khoảng mù trong dữ liệu.

Ngoại lệ duy nhất: **ô tìm kiếm ở Màn 1** có lọc được danh sách nhưng không bắn event — vì lựa chọn cuối cùng đã nằm trong `select_address`, còn việc gõ phím thì không phải một bước funnel.

---

## 9. Cố ý không làm

- **Không thêm màn chọn điểm đón riêng.** Điểm đón là hằng số `FIXED_PICKUP`, xác nhận ngay tại Màn 2. Thêm một màn nữa là đánh số lại toàn bộ `step_index`, làm dữ liệu cũ và mới không ghép được (`CLAUDE.md` quy tắc 6).
- **Không thêm `EventName` mới.** Toàn bộ spec đã nằm gọn trong 19 event.
- ~~**Không dùng bản đồ thật.**~~ Không còn áp dụng: `MapCanvas` giờ render tile OpenStreetMap thật và tuyến đường thật từ OSRM. Vẫn **không thêm thư viện bản đồ** — tile là thẻ `<img>`, tuyến là `fetch`, nên `CLAUDE.md` quy tắc 8 không bị phá. Xem mục 4.
- **Không cho kéo/pan bản đồ.** Zoom và re-center là đủ; kéo thả cần quản lý trạng thái con trỏ và tải tile động — nhiều code cho thứ không ai dùng trong một luồng 6 bước.
- **Không định tuyến nhiều chặng, không giao thông thời gian thực.**
- **Không thêm màn thất bại.** App mô phỏng luôn thành công (`screen-map.md` §5).
- ~~**Không đổi `max-width` xuống 430px.**~~ Không còn áp dụng: `screen-map.md` §6 đã chuyển sang desktop-first theo `sample_ui/`. Panel trái của bố cục `split` rộng 480px; bố cục `wide` đặt bề ngang qua prop `maxWidth`.

## 10. Cần mentor chốt

1. **Giá xe máy 58.000 / 72.000** — tự đề xuất, spec không có.
2. **Đổi giá `veh-bike` / `veh-car`** (25.000→58.000, 75.000→149.000) có được không, hay giữ giá cũ và chấp nhận bốn hạng ô tô lệch thang.
3. **Sáu hạng xe có làm loãng mẫu không** — phương án giảm nhẹ đã có ở mục 5.1 (phân tích theo `vehicle_type`), nhưng đây là đánh đổi thật giữa "giống app thật" và "đủ mẫu để nói được điều gì".
4. **Hai khoá `properties` mới** (`driver_note`, `payment_method`) — có nằm trong danh sách 17 trường mentor đang chuẩn bị không (`event-taxonomy.md` §6).

---

## 11. Checklist nghiệm thu

Sau khi code xong theo tài liệu này:

**Dữ liệu**
```bash
curl "localhost:3000/api/events?session_id=<id>" | jq '.[] | {event_name, screen_name, step_index}'
```
- [ ] Đúng **6** `screen_view`, `step_index` chạy 0 → 6, không lặp, không nhảy cóc
- [ ] Không có `event_name` nào ngoài 19 giá trị ở `event-taxonomy.md` §5
- [ ] `confirm_pickup` có khoá `driver_note` (chuỗi rỗng khi không nhập)
- [ ] `confirm_ride` có khoá `payment_method` với giá trị `cash` hoặc `qr`
- [ ] `final_price` trong `confirm_ride` **khớp đúng** số hiển thị ở Màn 5

**Giao diện**
- [ ] Màn 1 hỏi **"Bạn muốn đi đến đâu?"**, ô tìm kiếm lọc được 5 điểm đến
- [ ] Màn 2 hiện **Điểm đón = "Vị trí hiện tại"** (không đổi theo lựa chọn) và **Điểm đến = địa chỉ vừa chọn**; bấm "Đổi điểm đến" quay về Màn 1 và vẫn bắn `change_address`
- [ ] Màn 5 hiện đủ hai hàng Điểm đón / Điểm đến; Màn 6 hiện "Điểm đến"
- [ ] `MapCanvas` hiện ở Màn 2, 3, 5; không nhấp nháy hay đổi hình khi re-render
- [ ] Sáu hạng xe hiện đủ, dòng đang chọn có `ring-2 ring-primary`
- [ ] Ô nhập mã ở Màn 4 nhận đúng 3 `code`, gõ sai hiện lỗi mà không bắn event
- [ ] Mọi thành phần ở mục 8 **không bấm được** hoặc bấm không sinh event
- [ ] Không tràn ngang ở khổ 390px và 430px

**Quy tắc dự án**
```bash
grep -rn "step_index" app/      # chỉ được có trong comment
grep -rn "NEXT_PUBLIC_" app components lib        # phải rỗng
npm run typecheck && npm run lint && npm run build
```

**Thứ tự code đề xuất:** `mock-data.ts` (toạ độ + bảng giá theo km) → `route.ts` + `pricing.ts` → BE `/api/route` → `MapCanvas.tsx` → `app-context.tsx` → Màn 1 → 2 → 3 → 4 → 5. Mỗi màn xong thì click kiểm `screen_view` đúng một lần trước khi sang màn sau.
