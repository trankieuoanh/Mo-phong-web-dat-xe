# event-taxonomy.md — GSM ride-booking simulation

> Đây là **hợp đồng dữ liệu** của toàn dự án. Mọi event ghi vào Firestore phải khớp bảng dưới. Khi thêm màn/hành động mới, cập nhật file này TRƯỚC khi code.

## 1. Quy tắc chung

### `step_index` — vị trí bước trong luồng
- Là **số cố định gán cho từng bước**, không phải bộ đếm event tăng dần.
- `home` luôn là `0` cho cả hai luồng.
- Mọi event bắn trên cùng một màn dùng **chung** `step_index` của màn đó, trừ hai ngoại lệ dưới đây.
- **Ngoại lệ 1 — `add_to_cart` luôn là `3`**, dù bắn ở `food_menu` (step 1) hay `food_item_detail` (step 2). Nó là *hành động*, không phải màn hình.
- **Ngoại lệ 2 — `select_flow` luôn là `0`**, dù bắn ở `home` (step 0), `address_selection` (step 1), `food_menu` (step 1), hay từ một màn ngoài funnel (xem khung dưới mục `previous_screen`). Nó là mốc "bắt đầu luồng này", tức bước 0 của funnel luồng được chọn. Nếu để nó mang step của màn đang đứng, funnel của luồng được chọn sẽ **không có bước 0** và mọi tỉ lệ tính từ mẫu số đó đều sai.
- Bấm Back không làm `step_index` lùi — event `back` mang `step_index` của màn đang đứng khi bấm.
- Mục đích: script pandas chỉ cần `groupby('step_index').session_id.nunique()` là ra funnel.

### `previous_screen` — màn trước đó trong lịch sử điều hướng
- `screen_name` của màn ngay trước trong session.
- `null` ở màn đầu tiên của session (`home`).
- Ở lại một màn và bắn nhiều event → `previous_screen` **không đổi**, giữ nguyên giá trị của màn trước.
- Hệ quả phản trực giác: muốn biết người dùng **nhảy luồng từ đâu**, đọc `screen_name` của `select_flow`, **không phải** `previous_screen`. Một `select_flow` bắn ở `/ride/address` mang `screen_name: "address_selection"` nhưng `previous_screen: "home"` — vì `previous_screen` chỉ đổi khi có `screen_view` mới.

> **Một ngoại lệ của câu trên: `select_flow` bắn từ màn NGOÀI FUNNEL.** Bốn route `/history`, `/account`, `/support`, `/terms` cố ý không có `screen_name` (không nằm trong `SCREENS`). Khi người dùng bấm tab luồng ở sidebar từ một trong bốn màn đó, `select_flow` mang `screen_name` của màn **ĐÍCH** — `address_selection` nếu chọn ride, `food_menu` nếu chọn food — chứ không phải nơi bấm.
>
> Không có lựa chọn trung thực hơn: màn đang đứng không có tên nào để ghi. Và bỏ hẳn event thì tệ hơn nhiều — session sẽ vào luồng mà **thiếu bước 0**, làm funnel hiện bước 1 đông hơn bước 0, tức tỉ lệ chuyển đổi vượt 100% (`analysis/metrics.py` dòng 141-143 cảnh báo đúng điều này).
>
> Vì vậy khi đọc `screen_name` của `select_flow` để phân tích "nhảy luồng từ đâu", nhớ rằng giá trị `address_selection` / `food_menu` gộp **hai tình huống**: bấm tab ngay tại màn đầu luồng, và bấm tab từ một màn ngoài funnel.

### `flow` — luồng đang đi, kể cả khi chưa chọn
Ba giá trị: `"ride"`, `"food"`, `"none"`.

`"none"` chỉ dùng cho **`screen_view` ở màn `home`** — lúc đó người dùng **chưa chọn luồng nào**, nên không giá trị nào khác là đúng. (`back_to_home` **không** mang `"none"`: nó bắn ở `ride_success` / `food_success`, tức lúc luồng đã xong, nên mang `"ride"` / `"food"` — xem bảng mục 3 và 4.) Ghi bừa `"ride"` sẽ thổi phồng mọi tỉ lệ "vào Home → chọn ride".

Hệ quả cho script pandas:
- Đếm funnel từng luồng: lọc `flow != 'none'`.
- Mẫu số "số người vào Home": đếm `session_id` duy nhất có `flow == 'none'`.
- `select_flow` **luôn** mang `flow` = giá trị được chọn, không phải `'none'`.

> **Từ khi sidebar thành tab, `home` mặc định là màn Đặt xe.** Tỉ lệ ride/food ở bước 0 vì thế **không còn** đo "người dùng tự chọn gì" mà đo "ride là mặc định". Dữ liệu bước 0 sinh trước và sau thay đổi này **không ghép được với nhau** — nếu đã có dữ liệu demo cũ thì phải sinh lại. Các bước từ 1 trở đi không bị ảnh hưởng.

### `screen_view`
- Bắn **một lần** khi mỗi màn mount lần đầu trong một lượt điều hướng.
- Quay lại màn cũ bằng Back → bắn `screen_view` mới (đây là một lượt xem mới).
- `properties: {}`.

### Session bỏ dở (abandon)
Không có event riêng. Một session được coi là bỏ dở khi **không tồn tại** event `confirm_ride` (luồng ride) hoặc `place_order` (luồng food). Điểm bỏ dở = `max(step_index)` của session đó.

### Quy ước đặt tên
- `event_name`, `screen_name`: `snake_case`, động từ trước (`select_vehicle`, `add_to_cart`).
- Khóa trong `properties`: `snake_case`.
- Giá tiền: **số nguyên VNĐ**, không format chuỗi (`35000`, không phải `"35.000đ"`).

---

## 2. Bảng màn hình

Bảng này được mã hoá **một lần duy nhất** thành `SCREENS` trong `packages/shared/src/screens.ts`. `trackEvent` tra bảng đó — không page nào gõ tay `step_index`.

| Luồng | `screen_name` | Route | `step_index` |
|---|---|---|---|
| chung (`flow: "none"`) | `home` | `/` | 0 |
| ride | `address_selection` | `/ride/address` | 1 |
| ride | `pickup_confirm` | `/ride/pickup` | 2 |
| ride | `vehicle_selection` | `/ride/vehicle` | 3 |
| ride | `promo_selection` | `/ride/promo` | 4 |
| ride | `ride_confirm` | `/ride/confirm` | 5 |
| ride | `finding_driver` | `/ride/finding-driver` | 6 |
| ride | `ride_success` | `/ride/success` | 7 |
| food | `food_menu` | `/food` | 1 |
| food | `food_item_detail` | `/food/item/[itemId]` | 2 |
| food | *(hành động `add_to_cart`)* | — | 3 |
| food | `food_cart` | `/food/cart` | 4 |
| food | `food_offer_selection` | `/food/offer` | 5 |
| food | `food_confirm` | `/food/confirm` | 6 |
| food | `food_success` | `/food/success` | 7 |

**Lưu ý về step 3 của luồng Food:** `DESIGN.md` coi "Thêm vào giỏ hàng" là một bước riêng, nhưng nó là **hành động**, không phải màn hình. Nên `add_to_cart` được gán `step_index: 3` trong khi `screen_name` vẫn là màn nơi nó được bắn (`food_item_detail` hoặc `food_menu`). Đây là chủ ý: "số người xem món" vs "số người thực sự thêm vào giỏ" là hai mốc funnel khác nhau và cần tách được.

---

## 3. Event luồng Ride

### `home` — step 0
| `event_name` | Khi nào | `properties` |
|---|---|---|
| `screen_view` | Mount màn Home | `{}` |
| `select_flow` | Bấm ô "Bạn muốn đi đâu?" (→ ride) hoặc tab "Đặt đồ ăn" ở sidebar (→ food) | `{ flow_chosen: "ride" \| "food" }` |

> `select_flow` luôn ghi `flow` = giá trị được chọn (không phải `null`), và luôn `step_index: 0` (mục 1).
>
> **Không có `properties` phân biệt lối vào** vì cặp (`screen_name`, `flow_chosen`) đã đủ: `home`+`ride` = ô tìm kiếm giữa panel, `home`+`food` = tab sidebar, còn `screen_name` khác `home` = nhảy luồng từ sidebar.

### `address_selection` — step 1
| `event_name` | Khi nào | `properties` |
|---|---|---|
| `screen_view` | Mount | `{}` |
| `select_address` | Chọn 1 địa chỉ (gợi ý hoặc kết quả tìm) | `{ address_id, address_label, address_source }` |
| `select_flow` | Bấm tab "Đặt đồ ăn" ở sidebar — **`step_index: 0`**, `flow: "food"` | `{ flow_chosen: "food" }` |
| `back` | Bấm quay lại | `{ to_screen: "home" }` |

> **`address_id` / `address_label` là ĐIỂM ĐẾN.** Màn này hỏi "Bạn muốn đi đến đâu?". Điểm đến giữ tên khoá `address_id` ở cả ba event dùng khoá này (`select_address`, `confirm_pickup`, `confirm_ride`). Điểm đón dùng bộ khoá riêng `pickup_*` — xem màn `pickup_confirm`.
>
> **`address_source`** nhận **ba** giá trị — ba cách chọn địa chỉ, ba hành vi khác nhau. Mỗi nhóm có tập `address_id` riêng:
>
> | `address_source` | nghĩa | dạng `address_id` | ví dụ |
> |---|---|---|---|
> | `preset` | 1 trong 5 gợi ý ở `mock-data.md` mục 1 | `addr-*`, tập đóng 5 giá trị | `addr-home` |
> | `search` | tự gõ tìm, dữ liệu từ `GET /api/places` | `osm-<osm_type><osm_id>`, tập mở | `osm-N240109189` |
> | `map` | **tự bấm một điểm trên bản đồ** | `map-<lat>-<lon>` làm tròn 5 chữ số, tập mở | `map-21.03946-105.78294` |
>
> Nhánh `map` dùng nút "Tìm trên bản đồ" ở `/ride/address`, hoặc "Đổi điểm đón" ở `/ride/pickup`. Nhãn (`address_label`) là tên tra được qua `GET /api/reverse`; toạ độ giữ nguyên chỗ người dùng bấm chứ không lấy toạ độ Photon trả về, nên hai lần bấm cùng một chỗ ra cùng một `address_id`.
>
> Phải ghi `address_source` thành một khoá riêng chứ **không** đoán qua tiền tố id: tiền tố là chi tiết cài đặt, đổi nhà cung cấp địa chỉ là mọi script pandas cũ sai im lặng. Dùng `osm_type + osm_id` chứ **không** dùng `place_id` của Nominatim — `place_id` đổi mỗi lần họ build lại cơ sở dữ liệu, tức dữ liệu tuần này không ghép được với tuần sau (đúng điều `CLAUDE.md` quy tắc 5 muốn tránh).

### `pickup_confirm` — step 2
| `event_name` | Khi nào | `properties` |
|---|---|---|
| `screen_view` | Mount | `{}` |
| `confirm_pickup` | Xác nhận điểm đón | `{ address_id, pickup_id, pickup_label, pickup_source, driver_note }` |
| `change_address` | Bấm "Đổi điểm đến" | `{ address_id }` (điểm đến đang bị bỏ) |
| `back` | Bấm quay lại | `{ to_screen: "address_selection" }` |

> `driver_note` là chuỗi người dùng tự gõ ở ô "Thêm ghi chú cho bác tài", **chuỗi rỗng** khi không nhập (không phải `null`) — để pandas đếm `(df.driver_note != '').mean()` ra ngay tỉ lệ dùng.
>
> **Điểm đón giờ biến thiên.** Trước đây nó là hằng số `FIXED_PICKUP` nên cố ý không ghi event: hằng số thì mọi document giống nhau, không phân biệt được session này với session kia. Từ khi màn này có ô tìm điểm đón, nó thành một lựa chọn thật của người dùng và **phải đo được** — một thao tác làm được mà không ghi lại là một khoảng mù trong dữ liệu (`ride-flow-design.md` mục 8).
>
> `pickup_source` nhận cùng **ba** giá trị với `address_source` (`preset` / `search` / `map`). Điểm đón mặc định có `pickup_id = "pickup-current"` và `pickup_source = "preset"`, nên **`pickup_id != "pickup-current"` chính là tỉ lệ người đổi điểm đón**.

### `vehicle_selection` — step 3
| `event_name` | Khi nào | `properties` |
|---|---|---|
| `screen_view` | Mount | `{}` |
| `select_vehicle` | Chọn loại xe | `{ vehicle_id, vehicle_type: "bike" \| "car", base_price, distance_km }` |
| `back` | Bấm quay lại | `{ to_screen: "pickup_confirm" }` |

> **`base_price` đã đổi nghĩa.** Trước đây nó là giá cố định của hạng xe (`Vehicle.basePrice`); giờ giá tính theo quãng đường thật: `giá mở cửa + đơn giá/km × số km vượt quá 2 km đầu` (`mock-data.md` mục 2).
>
> Vì vậy `base_price` **chỉ đọc được khi có `distance_km` đi kèm** — hai chuyến cùng hạng xe mà khác quãng đường thì khác giá, và so `base_price` giữa hai session không nói lên điều gì nếu không chuẩn hoá theo km. Đó là lý do `distance_km` phải nằm ngay trong chính event này chứ không chỉ ở `confirm_ride`: người bỏ dở ở bước chọn xe không bao giờ sinh ra `confirm_ride`.

### `promo_selection` — step 4
| `event_name` | Khi nào | `properties` |
|---|---|---|
| `screen_view` | Mount | `{}` |
| `select_promo` | Chọn 1 khuyến mãi | `{ promo_id, promo_code, discount_amount }` |
| `skip_promo` | Bấm "Bỏ qua" | `{}` |
| `back` | Bấm quay lại | `{ to_screen: "vehicle_selection" }` |

> `discount_amount` là **số tiền giảm thực tế đã tính** (VNĐ), không phải phần trăm — để pandas cộng trực tiếp.

### `ride_confirm` — step 5
| `event_name` | Khi nào | `properties` |
|---|---|---|
| `screen_view` | Mount | `{}` |
| `confirm_ride` | Bấm nút xác nhận cuối | `{ address_id, address_label, address_source, pickup_id, pickup_label, distance_km, duration_min, route_source, vehicle_id, vehicle_type, promo_id \| null, base_price, discount_amount, final_price, payment_method }` |
| `back` | Bấm quay lại | `{ to_screen: "promo_selection" }` |

> `confirm_ride` là **event kết thúc funnel ride**. Session có event này = hoàn thành.
>
> `payment_method` là `"cash"` hoặc `"qr"`, mặc định `"cash"`. Ghi lại vì đây là một lựa chọn của người dùng ở bước cuối — không ghi thì không biết ai đổi khỏi mặc định.
>
> **`route_source`** là `"osrm"` (tuyến đường thật, lấy từ `GET /api/route`) hoặc `"straight"` (dịch vụ định tuyến không trả lời nên đã suy biến về đường nối thẳng, quãng đường tính theo đường chim bay).
>
> **Bắt buộc phải có khoá này.** Thiếu nó thì một chuyến 8 km đường thật và một chuyến 8 km đường chim bay trông giống hệt nhau trong dữ liệu, mà đường chim bay luôn ngắn hơn đường thật đáng kể. Mọi phân tích theo quãng đường sẽ trộn lẫn hai loại và không có cách nào tách ra về sau. Khi phân tích, lọc `route_source == 'osrm'` trước khi so sánh quãng đường hay giá.
>
> `distance_km` là số thực (làm tròn 1 chữ số thập phân), `duration_min` là số nguyên phút.

> **Vì sao lặp lại `address_label` / `pickup_label` ở đây** dù chúng đã có ở `select_address` và `confirm_pickup`: đây là event **tự mô tả đủ một chuyến đi**. Màn `/history` dựng bảng lịch sử từ riêng các document `confirm_ride`, không join ngược về event trước. Và với `address_source == "search"` hoặc `"map"` thì **không có bảng nào để tra id ra tên** — `getAddress("osm-N240109189")` trả `undefined`, `getAddress("map-21.03946-105.78294")` cũng vậy. Không lặp lại nhãn ở đây thì cột điểm đi/điểm đến trống với mọi địa chỉ người dùng tự tìm hoặc tự bấm trên bản đồ.

### `finding_driver` — step 6

| `event_name` | Khi nào | `properties` |
|---|---|---|
| `screen_view` | Mount | `{}` |
| `driver_searching` | Mount (bắt đầu tìm tài xế) | `{}` |
| `driver_assigned` | Sau 2-3s (tự động tìm thấy tài xế) | `{ driver_id, driver_name, driver_phone, vehicle_plate, eta_min }` |
| `cancel_ride` | Bấm "Hủy đơn" | `{ cancel_reason: "user_cancelled", cancel_stage: "finding_driver", address_id, address_label, address_source, pickup_id, pickup_label, distance_km, duration_min, route_source, vehicle_id, vehicle_type, promo_id \| null, base_price, discount_amount, final_price, payment_method }` |
| `back` | (Vô hiệu hóa — app thật không cho quay lại) | `{ to_screen: "ride_confirm" }` |

> **Vô hiệu hóa nút Back trình duyệt** khi ở màn này — giống app thật, không cho người dùng quay lại màn xác nhận sau khi đã bấm "Đặt xe". Dùng `history.pushState` + `popstate` listener push lại state hiện tại.
>
> `driver_assigned` bắn tự động sau 2-3s giả lập tìm tài xế, ngay tại màn `finding_driver` (step 6). Không có màn `driver_arriving` riêng.
>
> `cancel_ride` mirror toàn bộ fields của `confirm_ride` để màn `/history` hiển thị được chi tiết chuyến đã hủy. `cancel_stage` cho biết hủy ở giai đoạn nào.

### `ride_success` — step 7
| `event_name` | Khi nào | `properties` |
|---|---|---|
| `screen_view` | Mount | `{}` |
| `back_to_home` | Bấm "Về trang chủ" | `{}` |

---

## 4. Event luồng Food

### `food_menu` — step 1
| `event_name` | Khi nào | `properties` |
|---|---|---|
| `screen_view` | Mount | `{}` |
| `search_item` | Ngừng gõ 600ms ở ô tìm món, query ≥ 2 ký tự | `{ query, result_count, restaurant_count }` |
| `filter_category` | Bấm chip loại món | `{ category }` |
| `select_meal` | Bấm chip bữa (sáng/trưa/tối) | `{ meal, is_default }` |
| `change_address` | Chốt một địa chỉ giao mới ở dòng "Giao tới" | `{ address_id, address_label, address_source }` |
| `select_restaurant` | Bấm 1 quán ở dải "Gần bạn" | `{ restaurant_id, restaurant_name, distance_km, item_count, cuisine }` |
| `select_item` | Bấm vào 1 món để mở chi tiết | `{ item_id, item_name, price, discovery_source }` |
| `add_to_cart` | Thêm nhanh từ màn menu (không mở chi tiết) | xem mục `add_to_cart` bên dưới |
| `select_flow` | Bấm tab "Đặt xe" ở sidebar — **`step_index: 0`**, `flow: "ride"` | `{ flow_chosen: "ride" }` |
| `back` | Bấm quay lại | `{ to_screen: "home" }` |

> **Bốn cách tìm món, và `discovery_source` là khoá nối chúng với kết quả.**
> Màn menu có 4 bộ lọc **loại trừ nhau**: chip loại món, ô tìm tên, quán ở dải
> "Gần bạn", và chip bữa. `discovery_source` ghi bộ lọc **đang bật lúc bấm món**,
> nhận 1 trong 5 giá trị: `"all" | "category" | "search" | "restaurant" | "meal"`.
> Nhờ nó mới trả lời được câu hỏi chính: *lối khám phá nào dẫn tới `add_to_cart`
> nhiều nhất*. Không có nó thì 4 bộ lọc chỉ đếm được lượt bấm, không đo được hiệu quả.
>
> `discovery_source` có ở `select_item` và ở `add_to_cart` **bắn từ `food_menu`**.
> `add_to_cart` bắn từ `food_item_detail` **không có** khoá này — lúc đó người
> dùng đã rời màn menu, bộ lọc không còn ý nghĩa. Script pandas phải chịu được
> cột vắng; `column()` trong `analysis/metrics.py` đã làm đúng việc đó.
>
> **`result_count` mới là con số đáng giá của `search_item`**, không phải `query`:
> `result_count == 0` nghĩa là người dùng tìm một món mà thực đơn không có — đó
> là danh sách món nên bổ sung.
>
> **`result_count` vẫn chỉ đếm MÓN, kể cả khi ô tìm đã tìm được cả quán.**
> Số quán thật khớp từ khoá đi vào khoá riêng `restaurant_count`. Nhồi hai thứ
> vào một con số sẽ làm mọi bản ghi `search_item` sinh trước bản nâng cấp này
> không còn so sánh được với bản ghi sinh sau — cùng một tên cột mà hai nghĩa là
> kiểu sai **không có triệu chứng**. `restaurant_count` vắng mặt ở dữ liệu cũ;
> `column()` trong `analysis/metrics.py` đã chịu được cột vắng.
>
> **`change_address` ở `food_menu`** là lúc người dùng chốt một địa chỉ giao khác
> ở dòng "Giao tới" (mặc định lấy từ GPS, hoặc `DEFAULT_PICKUP` khi bị từ chối).
> Dùng lại đúng tên event của luồng ride chứ không đặt tên mới — cùng một hành vi
> "đổi một địa điểm đã chọn", và thêm một `EventName` chỉ để phân biệt luồng là
> thừa khi `flow` và `screen_name` đã nói điều đó. Phân tích luồng ride phải lọc
> theo `screen_name`, không chỉ theo tên event.
>
> Việc đổi địa chỉ **không phải một màn hình**: nó hoán đổi thân panel ngay tại
> `food_menu` (xem `food-flow-design.md` §2.1). Thêm một route là đánh số lại
> `step_index` của cả luồng food.
>
> **`is_default`** của `select_meal` = chip vừa bấm có trùng bữa mà hệ thống tự
> đoán theo giờ hay không. Tách được "đoán đúng" khỏi "người dùng phải tự sửa".
>
> **`restaurant_id`** là id `osm-<T><osm_id>` do `GET /api/restaurants` trả về —
> cùng khuôn với `address_id` của địa chỉ tự tìm, và ổn định qua các lần
> Nominatim build lại cơ sở dữ liệu (`CLAUDE.md` quy tắc 5).
>
> **`cuisine` là mảng tag THẬT của OpenStreetMap, ghi nguyên văn** — `["vietnamese"]`,
> `["thịt_nướng","grill","yakiniku","barbecue"]`, hoặc **`[]`**. Ghi nguyên văn chứ
> không quy đổi sẵn về nhãn của app: bảng quy đổi (`CUISINE_ALIASES` trong
> `packages/shared/src/food.ts`) là thứ sẽ còn sửa, còn tag thô thì không đổi —
> lưu tag thô nên dữ liệu cũ vẫn đọc lại được sau mỗi lần ta sửa bảng.
>
> **`cuisine == []` là một con số đáng đo, không phải lỗi.** Trong mẫu 120 quán
> thật ở Hà Nội, **một nửa không khai báo `cuisine`** — đó là độ phủ thật của dữ
> liệu cộng đồng. Những quán này lùi về thực đơn món Việt (kiểu bếp áp đảo trong
> mẫu) thay vì hiện thực đơn rỗng.
>
> **`search_item` bắn sau khi ngừng gõ, không phải mỗi phím.** Debounce ở đây để
> **gộp event** chứ không phải để giảm tải mạng — việc tìm món chạy hoàn toàn ở
> client trên 8 món có sẵn, không gọi API nào.

### `food_item_detail` — step 2
| `event_name` | Khi nào | `properties` |
|---|---|---|
| `screen_view` | Mount | `{}` |
| `change_quantity` | Tăng/giảm số lượng trước khi thêm | `{ item_id, quantity }` |
| `add_to_cart` | Bấm "Thêm vào giỏ" | xem bên dưới |
| `back` | Bấm quay lại | `{ to_screen: "food_menu" }` |

### `add_to_cart` — step 3 (hành động)
`screen_name` = màn nơi bắn (`food_item_detail` hoặc `food_menu`), `step_index` = **3**.

```json
{ "item_id": "banh-mi-01", "item_name": "Bánh mì thịt nướng", "price": 35000,
  "quantity": 2, "cart_size_after": 3, "cart_total_after": 125000 }
```
- `cart_size_after`: tổng **số lượng món** trong giỏ sau khi thêm (không phải số dòng).
- `cart_total_after`: tổng tiền hàng sau khi thêm, **chưa gồm** phí giao và ưu đãi.
- `discovery_source`: **chỉ có khi bắn từ `food_menu`** (thêm nhanh ngay trên lưới món) — bộ lọc đang bật lúc bấm. Bắn từ `food_item_detail` thì khoá này vắng mặt; xem ghi chú ở bảng `food_menu`.

### `food_cart` — step 4
| `event_name` | Khi nào | `properties` |
|---|---|---|
| `screen_view` | Mount | `{}` |
| `change_quantity` | Sửa số lượng trong giỏ | `{ item_id, quantity, cart_total_after }` |
| `remove_from_cart` | Xoá 1 dòng khỏi giỏ | `{ item_id, item_name, quantity_removed, cart_size_after, cart_total_after }` |
| `proceed_to_offer` | Bấm "Tiếp tục" | `{ cart_size, cart_total }` |
| `back` | Bấm quay lại | `{ to_screen: "food_menu" }` |

### `food_offer_selection` — step 5
| `event_name` | Khi nào | `properties` |
|---|---|---|
| `screen_view` | Mount | `{}` |
| `select_offer` | Bấm "Áp dụng ưu đãi" ở footer, sau khi đã tick 1 ưu đãi | `{ offer_id, offer_code, discount_amount }` |
| `skip_offer` | Bấm "Bỏ qua" | `{}` |
| `back` | Bấm quay lại | `{ to_screen: "food_cart" }` |

> **`select_offer` bắn lúc XÁC NHẬN, không phải lúc bấm vào ưu đãi.** Tick một
> ưu đãi chỉ đổi trạng thái tại chỗ; event bắn khi bấm nút ở footer — đúng mô
> hình `select_promo` của luồng ride. Nhờ vậy mỗi phiên có **đúng một**
> `select_offer` và hai funnel so sánh được với nhau.
>
> Bản cũ bắn ngay lúc bấm rồi điều hướng luôn, nên một phiên có thể sinh nhiều
> `select_offer` (quay lại rồi chọn lại). **Với dữ liệu sinh trước thay đổi này,
> lấy bản ghi `select_offer` cuối cùng trong phiên** — cùng cách xử lý đã ghi cho
> `select_vehicle` ở luồng ride. Properties không đổi.

### `food_confirm` — step 6
| `event_name` | Khi nào | `properties` |
|---|---|---|
| `screen_view` | Mount | `{}` |
| `place_order` | Bấm nút đặt đơn cuối | `{ item_count, cart_total, shipping_fee, offer_id \| null, discount_amount, final_total, address_label, address_source }` |
| `back` | Bấm quay lại | `{ to_screen: "food_offer_selection" }` |

> `place_order` là **event kết thúc funnel food**.
>
> **Hai khoá địa chỉ là bổ sung mới**, cùng lý do với `confirm_ride` của luồng
> ride: event này phải **tự mô tả đủ một đơn hàng**. `/history` dựng lại đơn từ
> riêng nó, và trước đây bảng lịch sử không thể nói đơn được giao đi đâu.
>
> | Khoá | Kiểu | Ý nghĩa |
> |---|---|---|
> | `address_label` | `string` | Nhãn địa chỉ giao — tên đường thật khi có GPS (qua `/api/reverse`), hoặc nhãn địa chỉ người dùng chọn |
> | `address_source` | `"preset" \| "search" \| "map"` | `preset` = GPS hoặc địa chỉ gợi ý; `search` = người dùng tự tìm; `map` = tự bấm trên bản đồ |
>
> **Không ghi `lat`/`lon`.** Toạ độ GPS của người dùng là dữ liệu vị trí chính
> xác, còn phân tích chỉ cần biết *có đổi địa chỉ hay không* — nhãn đã đủ trả lời.
> Dữ liệu sinh trước thay đổi này vắng hai cột; `column()` trong
> `analysis/metrics.py` đã chịu được cột vắng.

### `food_success` — step 7
| `event_name` | Khi nào | `properties` |
|---|---|---|
| `screen_view` | Mount | `{}` |
| `back_to_home` | Bấm "Về trang chủ" | `{}` |

---

## 5. Tổng hợp `event_name` (26 giá trị)

```
screen_view, back, back_to_home, select_flow,
select_address, confirm_pickup, change_address, select_vehicle,
select_promo, skip_promo, confirm_ride,
driver_searching, driver_assigned, cancel_ride,
search_item, filter_category, select_meal, select_restaurant,
select_item, change_quantity, add_to_cart,
remove_from_cart, proceed_to_offer, select_offer, skip_offer, place_order
```

Khai báo trong `packages/shared/src/types.ts`: union type `EventName` (để TypeScript bắt lỗi gõ sai) **và** mảng `EVENT_NAMES` (để validator ở `apps/api` kiểm tra lúc chạy). Hai thứ này được một type assertion buộc phải khớp nhau — thêm giá trị vào union mà quên thêm vào mảng sẽ lỗi build, nếu không validator sẽ lặng lẽ từ chối một event hoàn toàn hợp lệ.

---

## 6. Chỗ chờ danh sách 17 trường của mentor

Schema hiện tại có **9 field top-level** (`session_id`, `user_id`, `flow`, `event_name`, `screen_name`, `previous_screen`, `step_index`, `platform`, `created_at`). Khi mentor chốt danh sách 17 trường:

1. Field dùng để **lọc/sắp xếp thường xuyên** → thêm vào top-level document.
2. Field **đặc thù theo loại event** → thêm vào `properties`.
3. Cập nhật bảng ở mục 3–4 của file này, rồi `packages/shared/src/types.ts` (union `EventName` + mảng `EVENT_NAMES`, và `EventPayload` nếu là field top-level), `packages/shared/src/screens.ts` nếu là màn mới, và `apps/api/src/validators/event.validator.ts` nếu cần luật kiểm tra riêng.
4. Firestore **không cần migrate** — document cũ thiếu field mới vẫn đọc được, script pandas xử lý bằng `.fillna()`.
