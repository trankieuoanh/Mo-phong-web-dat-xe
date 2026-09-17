# event-taxonomy.md — GSM ride-booking simulation

> Đây là **hợp đồng dữ liệu** của toàn dự án. Mọi event ghi vào Firestore phải khớp bảng dưới. Khi thêm màn/hành động mới, cập nhật file này TRƯỚC khi code.

## 1. Quy tắc chung

### `step_index` — vị trí bước trong luồng
- Là **số cố định gán cho từng bước**, không phải bộ đếm event tăng dần.
- `home` luôn là `0` cho cả hai luồng.
- Mọi event bắn trên cùng một màn dùng **chung** `step_index` của màn đó, trừ hai ngoại lệ dưới đây.
- **Ngoại lệ 1 — `add_to_cart` luôn là `3`**, dù bắn ở `food_menu` (step 1) hay `food_item_detail` (step 2). Nó là *hành động*, không phải màn hình.
- **Ngoại lệ 2 — `select_flow` luôn là `0`**, dù bắn ở `home` (step 0), `address_selection` (step 1) hay `food_menu` (step 1). Nó là mốc "bắt đầu luồng này", tức bước 0 của funnel luồng được chọn. Nếu để nó mang step của màn đang đứng, funnel của luồng được chọn sẽ **không có bước 0** và mọi tỉ lệ tính từ mẫu số đó đều sai.
- Bấm Back không làm `step_index` lùi — event `back` mang `step_index` của màn đang đứng khi bấm.
- Mục đích: script pandas chỉ cần `groupby('step_index').session_id.nunique()` là ra funnel.

### `previous_screen` — màn trước đó trong lịch sử điều hướng
- `screen_name` của màn ngay trước trong session.
- `null` ở màn đầu tiên của session (`home`).
- Ở lại một màn và bắn nhiều event → `previous_screen` **không đổi**, giữ nguyên giá trị của màn trước.
- Hệ quả phản trực giác: muốn biết người dùng **nhảy luồng từ đâu**, đọc `screen_name` của `select_flow`, **không phải** `previous_screen`. Một `select_flow` bắn ở `/ride/address` mang `screen_name: "address_selection"` nhưng `previous_screen: "home"` — vì `previous_screen` chỉ đổi khi có `screen_view` mới.

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
| ride | `ride_success` | `/ride/success` | 6 |
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
> **`address_source`** là `"preset"` (1 trong 5 địa chỉ gợi ý ở `mock-data.md` mục 1) hoặc `"search"` (người dùng tự gõ tìm, dữ liệu từ `GET /api/places`). Hai nhóm có tập `address_id` khác hẳn nhau:
>
> | `address_source` | dạng `address_id` | ví dụ |
> |---|---|---|
> | `preset` | `addr-*`, tập đóng 5 giá trị | `addr-home` |
> | `search` | `osm-<osm_type><osm_id>`, tập mở | `osm-N240109189` |
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
> `pickup_source` nhận cùng hai giá trị với `address_source`. Điểm đón mặc định có `pickup_id = "pickup-current"` và `pickup_source = "preset"`, nên **`pickup_id != "pickup-current"` chính là tỉ lệ người đổi điểm đón**.

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

> **Vì sao lặp lại `address_label` / `pickup_label` ở đây** dù chúng đã có ở `select_address` và `confirm_pickup`: đây là event **tự mô tả đủ một chuyến đi**. Màn `/history` dựng bảng lịch sử từ riêng các document `confirm_ride`, không join ngược về event trước. Và với `address_source == "search"` thì **không có bảng nào để tra id ra tên** — `getAddress("osm-N240109189")` trả `undefined`. Không lặp lại nhãn ở đây thì cột điểm đi/điểm đến trống với mọi địa chỉ người dùng tự tìm.

### `ride_success` — step 6
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
| `select_item` | Bấm vào 1 món để mở chi tiết | `{ item_id, item_name, price }` |
| `add_to_cart` | Thêm nhanh từ màn menu (không mở chi tiết) | xem mục `add_to_cart` bên dưới |
| `select_flow` | Bấm tab "Đặt xe" ở sidebar — **`step_index: 0`**, `flow: "ride"` | `{ flow_chosen: "ride" }` |
| `back` | Bấm quay lại | `{ to_screen: "home" }` |

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
| `select_offer` | Chọn 1 ưu đãi | `{ offer_id, offer_code, discount_amount }` |
| `skip_offer` | Bấm "Bỏ qua" | `{}` |
| `back` | Bấm quay lại | `{ to_screen: "food_cart" }` |

### `food_confirm` — step 6
| `event_name` | Khi nào | `properties` |
|---|---|---|
| `screen_view` | Mount | `{}` |
| `place_order` | Bấm nút đặt đơn cuối | `{ item_count, cart_total, shipping_fee, offer_id \| null, discount_amount, final_total }` |
| `back` | Bấm quay lại | `{ to_screen: "food_offer_selection" }` |

> `place_order` là **event kết thúc funnel food**.

### `food_success` — step 7
| `event_name` | Khi nào | `properties` |
|---|---|---|
| `screen_view` | Mount | `{}` |
| `back_to_home` | Bấm "Về trang chủ" | `{}` |

---

## 5. Tổng hợp `event_name` (19 giá trị)

```
screen_view, back, back_to_home, select_flow,
select_address, confirm_pickup, change_address, select_vehicle,
select_promo, skip_promo, confirm_ride,
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
