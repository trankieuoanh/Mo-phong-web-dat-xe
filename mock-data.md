# mock-data.md — GSM ride-booking simulation

> Toàn bộ dữ liệu tĩnh của app. Hardcode trong `packages/shared/src/mock-data.ts`, **không** gọi API để lấy. Các `id` ở đây đi thẳng vào `properties` của event nên **không được đổi tuỳ tiện** — đổi id sẽ làm dữ liệu các phiên cũ không ghép được với phiên mới.
>
> **Logic tính tiền nằm ở file khác**: `packages/shared/src/pricing.ts` giữ `calcDiscount` (mục 3) và hai công thức tổng tiền (mục 6). Tách ra vì màn confirm hiển thị số tiền còn event `confirm_ride`/`place_order` ghi số tiền — hai chỗ đó bắt buộc ra cùng một con số.

## Hằng số chung

```ts
export const SHIPPING_FEE = 15000;   // phí giao hàng cố định, luồng Food
export const CURRENCY = 'đ';
```

Định dạng hiển thị: `35.000đ` (dấu chấm ngăn nghìn, `Intl.NumberFormat('vi-VN')`). Trong event luôn ghi **số nguyên** `35000`.

---

## 1. Địa chỉ (luồng Ride — `address_selection`)

```ts
export interface Address {
  id: string;
  label: string;      // tên ngắn hiển thị đậm
  address: string;    // địa chỉ đầy đủ hiển thị mờ bên dưới
  icon: 'home' | 'work' | 'school' | 'plane' | 'shop';
  distanceKm: number;   // chỉ để hiển thị, KHÔNG vào event
}
```

Sắp xếp theo `distanceKm` tăng dần — giống app thật.

| `id` | `label` | `address` | `icon` | `distanceKm` |
|---|---|---|---|---:|
| `addr-home` | Nhà | Số 12, ngõ 34 Trần Duy Hưng, Cầu Giấy, Hà Nội | `home` | 1.3 |
| `addr-office` | Công ty | Keangnam Landmark 72, Phạm Hùng, Nam Từ Liêm, Hà Nội | `work` | 3.8 |
| `addr-mall` | Trung tâm thương mại | Vincom Mega Mall Royal City, Thanh Xuân, Hà Nội | `shop` | 4.6 |
| `addr-school` | Trường | VinUniversity, Ocean Park, Gia Lâm, Hà Nội | `school` | 15.2 |
| `addr-airport` | Sân bay | Sân bay Quốc tế Nội Bài, Sóc Sơn, Hà Nội | `plane` | 27.5 |

Bảng trên là danh sách **điểm đến gợi ý** ở màn `address_selection` ("Bạn muốn đi đến đâu?") — hiện khi ô tìm còn trống, dưới tiêu đề "Địa chỉ đã lưu".

### Địa chỉ tìm được KHÔNG nằm trong file này

Từ khi ô tìm nối vào `GET /api/places` (Nominatim/OpenStreetMap), người dùng chọn được bất kỳ địa điểm nào ở Việt Nam. Những địa chỉ đó là **dữ liệu động**, không hardcode, `id` dạng `osm-<osm_type><osm_id>`.

Hệ quả cần nhớ: `getAddress(id)` chỉ tra được 5 dòng ở trên. Với địa chỉ tìm được nó trả `undefined` — nên nhãn hiển thị phải đi theo state (`ride.destination.label`) và phải được ghi vào chính event (`address_label`), chứ không tra ngược từ id. Xem `event-taxonomy.md` mục `ride_confirm`.

### Điểm đón — mặc định, không còn là hằng số

```ts
export const FIXED_PICKUP = {
  id: 'pickup-current',                            // id ổn định, đi vào properties
  label: 'Vị trí hiện tại',
  address: '128 Xuân Thủy, Cầu Giấy, Hà Nội',
};
```

Trước đây điểm đón là hằng số bất biến nên cố ý **không ghi event**: hằng số thì mọi document giống nhau, không phân biệt được session này với session kia. Giờ màn `pickup_confirm` có ô tìm điểm đón, nên đây là **giá trị khởi tạo** chứ không phải giá trị duy nhất, và `confirm_pickup` ghi lại `pickup_id` / `pickup_label` / `pickup_source`.

Tên biến giữ nguyên `FIXED_PICKUP` để không phải sửa mọi chỗ import; "fixed" giờ đọc là "mặc định".

Điểm đến giữ tên khoá `address_id` trong `select_address` / `confirm_pickup` / `confirm_ride`; điểm đón dùng bộ khoá riêng `pickup_*`.

Quãng đường của chuyến **vẫn là hằng số**, dùng để hiển thị "34 phút • 15 km" ở màn chọn xe và màn xác nhận, **không** vào event. Nó không đổi theo địa chỉ dù giờ đã có toạ độ thật: tính quãng đường thật cần dịch vụ định tuyến, mà app này không đặt xe thật nên con số đó không thêm gì cho phân tích funnel:

```ts
export const FIXED_ROUTE = { distanceKm: 15, durationMin: 34 };
```

---

## 2. Loại xe (luồng Ride — `vehicle_selection`)

```ts
export interface Vehicle {
  id: string;
  type: 'bike' | 'car';
  name: string;
  description: string;
  basePrice: number;   // VNĐ, giá cố định cho chuyến (không tính theo km)
  etaMinutes: number;
  seats: number;
}
```

| `id` | `type` | `name` | `description` | `basePrice` | `etaMinutes` | `seats` |
|---|---|---|---|---|---|---|
| `veh-bike` | `bike` | Green Bike | Xe máy điện, nhanh và tiết kiệm | 58000 | 2 | 1 |
| `veh-bike-plus` | `bike` | Green Bike Plus | Xe máy điện đời mới, tài xế kinh nghiệm | 72000 | 3 | 1 |
| `veh-mini` | `car` | Green Mini | Xe điện 3 chỗ, giá tốt nhất | 145000 | 3 | 3 |
| `veh-car` | `car` | Green Car | Xe điện 4 chỗ, êm và mát | 149000 | 3 | 4 |
| `veh-premium` | `car` | Green Premium | Xe điện hạng sang 4 chỗ | 161000 | 3 | 4 |
| `veh-limo` | `car` | Green Limo | Xe điện 6 chỗ, rộng rãi cho nhóm | 194000 | 4 | 6 |

> **Sửa đổi so với bản trước** (`ride-flow-design.md` mục 5.1). Bản cũ chỉ có 2 lựa chọn (Xe máy / Ô tô) kèm ghi chú "không thêm hạng xe khác — làm loãng mẫu funnel". Ghi chú đó bị ghi đè có chủ ý để bám sát app GSM thật.
>
> - `veh-bike` và `veh-car` **giữ nguyên `id`** (quy tắc 5), nhưng đổi `name` và `basePrice` để cùng thang giá với 4 hạng còn lại (đều cho cùng một chuyến 15 km). Hệ quả: `base_price` của phiên cũ và phiên mới **không so sánh trực tiếp được**.
> - Đổi lại cách phân tích: gom theo **`vehicle_type`** (2 nhóm bike/car) thay vì theo từng `vehicle_id` (6 nhóm). Vài chục session mà chia 6 thì mỗi nhóm không còn nói được gì. `vehicle_id` vẫn nằm trong event để sau này nhiều dữ liệu hơn thì bóc tách được.
> - **58.000 và 72.000 là hai con số duy nhất không lấy từ bản hướng dẫn thiết kế** — ảnh chụp chỉ có 4 hạng ô tô. Cần mentor xác nhận.

---

## 3. Khuyến mãi (luồng Ride — `promo_selection`)

```ts
export interface Promo {
  id: string;
  code: string;
  title: string;
  description: string;
  type: 'fixed' | 'percent';
  value: number;          // fixed: số tiền VNĐ | percent: phần trăm
  maxDiscount?: number;   // chỉ với type 'percent'
  minOrder: number;       // giá trị tối thiểu để áp dụng
}
```

| `id` | `code` | `title` | `type` | `value` | `maxDiscount` | `minOrder` |
|---|---|---|---|---|---|---|
| `promo-10k` | `GSM10K` | Giảm 10.000đ | `fixed` | 10000 | — | 0 |
| `promo-20` | `GSM20` | Giảm 20%, tối đa 30.000đ | `percent` | 20 | 30000 | 50000 |
| `promo-new` | `NEWGSM` | Giảm 50% chuyến đầu, tối đa 40.000đ | `percent` | 50 | 40000 | 0 |

**Quy tắc tính giảm giá** (dùng chung cho Promo và Offer):
```ts
function calcDiscount(rule, subtotal: number): number {
  if (subtotal < rule.minOrder) return 0;
  if (rule.type === 'fixed') return Math.min(rule.value, subtotal);
  const raw = Math.floor(subtotal * rule.value / 100);
  return rule.maxDiscount ? Math.min(raw, rule.maxDiscount) : raw;
}
```
Khuyến mãi không đủ điều kiện (`subtotal < minOrder`) vẫn **hiển thị nhưng bị disable**, kèm dòng giải thích — người dùng thấy được lý do, và ta không ghi event cho lựa chọn bị disable.

---

## 4. Menu món ăn (luồng Food — `food_menu`)

```ts
export interface FoodItem {
  id: string;
  name: string;
  restaurant: string;
  price: number;
  category: 'main' | 'drink' | 'dessert';
  description: string;
}
```

| `id` | `name` | `restaurant` | `price` | `category` |
|---|---|---|---|---|
| `banh-mi-01` | Bánh mì thịt nướng | Bánh Mì 25 | 35000 | `main` |
| `pho-bo-02` | Phở bò tái | Phở Thìn Bờ Hồ | 55000 | `main` |
| `bun-cha-03` | Bún chả Hà Nội | Bún Chả Hương Liên | 50000 | `main` |
| `com-tam-04` | Cơm tấm sườn bì chả | Cơm Tấm Ba Ghiền | 60000 | `main` |
| `banh-xeo-05` | Bánh xèo miền Tây | Bánh Xèo Ăn Là Ghiền | 65000 | `main` |
| `tra-sua-06` | Trà sữa trân châu đường đen | Phúc Long | 45000 | `drink` |
| `ca-phe-07` | Cà phê sữa đá | Highlands Coffee | 29000 | `drink` |
| `che-08` | Chè khúc bạch | Chè Bốn Mùa | 32000 | `dessert` |

> `id` giữ đúng định dạng `<tên-món>-<số>` như ví dụ đã có sẵn trong `db-design.md`.

`description`: một câu ngắn, agent tự viết khi implement — trường này **không đi vào event** nên không cần chốt trước.

Ảnh món: không dùng ảnh thật. Mỗi món render một ô tỉ lệ 4:3 nền `canvas-soft` với ký tự đầu của tên món đặt ở giữa — tránh phụ thuộc file ảnh và vẫn đúng tinh thần "khung ảnh 4:3" trong `DESIGN.md`.

---

## 5. Ưu đãi (luồng Food — `food_offer_selection`)

Cùng interface với `Promo`, áp lên **tiền hàng** (`cart_total`), không áp lên phí giao — trừ `offer-freeship`.

| `id` | `code` | `title` | `type` | `value` | `maxDiscount` | `minOrder` |
|---|---|---|---|---|---|---|
| `offer-freeship` | `FREESHIP` | Miễn phí giao hàng | `fixed` | 15000 | — | 0 |
| `offer-15` | `FOOD15` | Giảm 15%, tối đa 25.000đ | `percent` | 15 | 25000 | 100000 |
| `offer-25k` | `FOOD25K` | Giảm 25.000đ cho đơn từ 150.000đ | `fixed` | 25000 | — | 150000 |

---

## 6. Công thức tổng tiền

**Ride** (`ride_confirm`):
```
final_price = base_price - discount_amount
```

**Food** (`food_confirm`):
```
cart_total  = Σ (price × quantity)
final_total = cart_total + SHIPPING_FEE - discount_amount
```
`offer-freeship` giảm đúng bằng `SHIPPING_FEE` nên `final_total` = `cart_total`. Không có thuế, không phụ phí.

Mọi giá trị đều là số nguyên VNĐ; dùng `Math.floor` khi tính phần trăm để không sinh số lẻ.
