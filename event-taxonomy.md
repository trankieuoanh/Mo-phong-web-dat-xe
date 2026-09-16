# event-taxonomy.md — GSM ride-booking simulation

> Đây là **hợp đồng dữ liệu** của toàn dự án. Mọi event ghi vào Firestore phải khớp bảng dưới. Khi thêm màn/hành động mới, cập nhật file này TRƯỚC khi code.

## 1. Quy tắc chung

### `step_index` — vị trí bước trong luồng
- Là **số cố định gán cho từng bước**, không phải bộ đếm event tăng dần.
- `home` luôn là `0` cho cả hai luồng.
- Mọi event bắn trên cùng một màn dùng **chung** `step_index` của màn đó.
- Bấm Back không làm `step_index` lùi — event `back` mang `step_index` của màn đang đứng khi bấm.
- Mục đích: script pandas chỉ cần `groupby('step_index').session_id.nunique()` là ra funnel.

### `previous_screen` — màn trước đó trong lịch sử điều hướng
- `screen_name` của màn ngay trước trong session.
- `null` ở màn đầu tiên của session (`home`).
- Ở lại một màn và bắn nhiều event → `previous_screen` **không đổi**, giữ nguyên giá trị của màn trước.

### `flow` — luồng đang đi, kể cả khi chưa chọn
Ba giá trị: `"ride"`, `"food"`, `"none"`.

`"none"` chỉ dùng cho hai event ở màn `home` (`screen_view` và `back_to_home`) — lúc đó người dùng **chưa chọn luồng nào**, nên không giá trị nào khác là đúng. Ghi bừa `"ride"` sẽ thổi phồng mọi tỉ lệ "vào Home → chọn ride".

Hệ quả cho script pandas:
- Đếm funnel từng luồng: lọc `flow != 'none'`.
- Mẫu số "số người vào Home": đếm `session_id` duy nhất có `flow == 'none'`.
- `select_flow` **luôn** mang `flow` = giá trị được chọn, không phải `'none'`.

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
| `select_flow` | Bấm 1 trong 2 nút lớn | `{ flow_chosen: "ride" \| "food" }` |

> `select_flow` luôn ghi `flow` = giá trị được chọn (không phải `null`), để đếm được tỉ lệ chọn giữa 2 luồng.

### `address_selection` — step 1
| `event_name` | Khi nào | `properties` |
|---|---|---|
| `screen_view` | Mount | `{}` |
| `select_address` | Chọn 1 địa chỉ trong danh sách | `{ address_id, address_label }` |
| `back` | Bấm quay lại | `{ to_screen: "home" }` |

> **`address_id` / `address_label` là ĐIỂM ĐẾN.** Màn này hỏi "Bạn muốn đi đến đâu?"; điểm đón là hằng số `FIXED_PICKUP` ("Vị trí hiện tại") nên **không ghi event** cho nó. Điểm đến là địa chỉ duy nhất biến thiên trong một session, nên nó giữ tên khoá `address_id` ở cả ba event dùng khoá này (`select_address`, `confirm_pickup`, `confirm_ride`).

### `pickup_confirm` — step 2
| `event_name` | Khi nào | `properties` |
|---|---|---|
| `screen_view` | Mount | `{}` |
| `confirm_pickup` | Xác nhận điểm đón | `{ address_id, driver_note }` |
| `change_address` | Bấm "Đổi điểm đến" | `{ address_id }` (điểm đến đang bị bỏ) |

> `driver_note` là chuỗi người dùng tự gõ ở ô "Thêm ghi chú cho bác tài", **chuỗi rỗng** khi không nhập (không phải `null`) — để pandas đếm `(df.driver_note != '').mean()` ra ngay tỉ lệ dùng. Đây là trường duy nhất trong cả app do người dùng tự nhập.
| `back` | Bấm quay lại | `{ to_screen: "address_selection" }` |

### `vehicle_selection` — step 3
| `event_name` | Khi nào | `properties` |
|---|---|---|
| `screen_view` | Mount | `{}` |
| `select_vehicle` | Chọn loại xe | `{ vehicle_id, vehicle_type: "bike" \| "car", base_price }` |
| `back` | Bấm quay lại | `{ to_screen: "pickup_confirm" }` |

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
| `confirm_ride` | Bấm nút xác nhận cuối | `{ address_id, vehicle_id, vehicle_type, promo_id \| null, base_price, discount_amount, final_price, payment_method }` |
| `back` | Bấm quay lại | `{ to_screen: "promo_selection" }` |

> `confirm_ride` là **event kết thúc funnel ride**. Session có event này = hoàn thành.
>
> `payment_method` là `"cash"` hoặc `"qr"`, mặc định `"cash"`. Ghi lại vì đây là một lựa chọn của người dùng ở bước cuối — không ghi thì không biết ai đổi khỏi mặc định.

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
