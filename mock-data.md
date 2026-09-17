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
  lat: number;        // BẮT BUỘC — dùng để vẽ bản đồ và tính tuyến đường
  lon: number;
}
```

| `id` | `label` | `address` | `icon` | `lat` | `lon` |
|---|---|---|---|--:|--:|
| `addr-home` | Nhà | Số 12, ngõ 34 Trần Duy Hưng, Cầu Giấy, Hà Nội | `home` | 21.0052 | 105.7989 |
| `addr-office` | Công ty | Landmark 72, Phạm Hùng, Nam Từ Liêm, Hà Nội | `work` | 21.0174 | 105.7836 |
| `addr-mall` | Trung tâm thương mại | Vincom Mega Mall Royal City, Thanh Xuân, Hà Nội | `shop` | 21.0023 | 105.8160 |
| `addr-school` | Trường | VinUniversity, Ocean Park, Gia Lâm, Hà Nội | `school` | 20.9886 | 105.9460 |
| `addr-airport` | Sân bay | Sân bay Quốc tế Nội Bài, Sóc Sơn, Hà Nội | `plane` | 21.2189 | 105.8045 |

Toạ độ tra từ chính Nominatim — cùng nguồn với địa chỉ người dùng tự tìm, nên hai nhánh `preset` và `search` nằm trên cùng một hệ quy chiếu.

> **`distanceKm` đã bị xoá.** Nó là khoảng cách hardcode tới điểm đón **cũ** (`1.3`, `3.8`, … `27.5`). Từ khi điểm đón đổi được và tuyến đường tính thật, để lại trường đó là bảo đảm có lúc màn hình hiện "15.2 km" ngay cạnh một tuyến đường 31 km. Khoảng cách gợi ý giờ tính tại chỗ bằng `haversineKm()` từ điểm đón hiện tại — đúng cho cả địa chỉ gợi ý lẫn địa chỉ tự tìm, và không bao giờ lệch khỏi bản đồ.

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
  lat: 21.0369,
  lon: 105.7856,
};
```

Trước đây điểm đón là hằng số bất biến nên cố ý **không ghi event**: hằng số thì mọi document giống nhau, không phân biệt được session này với session kia. Giờ màn `pickup_confirm` có ô tìm điểm đón, nên đây là **giá trị khởi tạo** chứ không phải giá trị duy nhất, và `confirm_pickup` ghi lại `pickup_id` / `pickup_label` / `pickup_source`.

Tên biến giữ nguyên `FIXED_PICKUP` để không phải sửa mọi chỗ import; "fixed" giờ đọc là "mặc định".

Điểm đến giữ tên khoá `address_id` trong `select_address` / `confirm_pickup` / `confirm_ride`; điểm đón dùng bộ khoá riêng `pickup_*`.

> **`FIXED_ROUTE` đã bị xoá.** Nó từng là hằng số `{ distanceKm: 15, durationMin: 34 }` cấp số liệu cho chip "34 phút • 15 km". Quãng đường và thời gian giờ lấy từ `GET /api/route` (OSRM) theo đúng hai điểm người dùng chọn, nên chúng **biến thiên theo từng chuyến** và **đi vào event** — `confirm_ride` mang `distance_km`, `duration_min`, `route_source`. Xem `event-taxonomy.md`.

---

## 2. Loại xe (luồng Ride — `vehicle_selection`)

```ts
export interface Vehicle {
  id: string;
  type: 'bike' | 'car';
  name: string;
  description: string;
  openingFare: number;   // VNĐ — giá mở cửa, đã gồm INCLUDED_KM km đầu
  pricePerKm: number;    // VNĐ mỗi km vượt quá INCLUDED_KM
  etaMinutes: number;
  seats: number;
}
```

| `id` | `type` | `name` | `description` | `openingFare` | `pricePerKm` | `etaMinutes` | `seats` |
|---|---|---|---|--:|--:|--:|--:|
| `veh-bike` | `bike` | Green Bike | Xe máy điện, nhanh và tiết kiệm | 15000 | 3300 | 2 | 1 |
| `veh-bike-plus` | `bike` | Green Bike Plus | Xe máy điện đời mới, tài xế kinh nghiệm | 20000 | 4000 | 3 | 1 |
| `veh-mini` | `car` | Green Mini | Xe điện 3 chỗ, giá tốt nhất | 28000 | 9000 | 3 | 3 |
| `veh-car` | `car` | Green Car | Xe điện 4 chỗ, êm và mát | 32000 | 9000 | 3 | 4 |
| `veh-premium` | `car` | Green Premium | Xe điện hạng sang 4 chỗ | 35000 | 9700 | 3 | 4 |
| `veh-limo` | `car` | Green Limo | Xe điện 6 chỗ, rộng rãi cho nhóm | 46000 | 11400 | 4 | 6 |

### Giá tính theo quãng đường

```ts
export const INCLUDED_KM = 2;   // giá mở cửa đã bao gồm 2 km đầu

export function calcFare(vehicle: Vehicle, distanceKm: number): number {
  const extra = Math.max(0, distanceKm - INCLUDED_KM);
  // Làm tròn tới 1.000đ — tiền lẻ tới hàng đơn vị trông như lỗi, không như giá.
  return Math.round((vehicle.openingFare + extra * vehicle.pricePerKm) / 1000) * 1000;
}
```

**Các hệ số được chọn để một chuyến 15 km ra đúng con số `basePrice` cũ.** Không phải trùng hợp — đó là ràng buộc tự đặt khi chuyển sang tính theo km: 15 km là quãng đường của `FIXED_ROUTE` đã xoá, nên mọi ảnh chụp màn hình và ghi chép demo từ trước vẫn khớp, và chỉ có **cách tính** đổi chứ không phải **thang giá**.

| `id` | 15 km ra | `basePrice` cũ |
|---|--:|--:|
| `veh-bike` | 57.900 → **58.000** | 58.000 |
| `veh-bike-plus` | **72.000** | 72.000 |
| `veh-mini` | **145.000** | 145.000 |
| `veh-car` | **149.000** | 149.000 |
| `veh-premium` | 161.100 → **161.000** | 161.000 |
| `veh-limo` | 194.200 → **194.000** | 194.000 |

> **`basePrice` đã bị xoá khỏi `Vehicle`.** Giá không còn là thuộc tính của hạng xe mà là hàm của (hạng xe, quãng đường). Khoá event `base_price` giữ nguyên tên nhưng đổi nghĩa thành "giá của chuyến này" — xem `event-taxonomy.md` mục `vehicle_selection`.
>
> **Hệ quả cho phân tích:** `base_price` chỉ so sánh được giữa các session khi đã chuẩn hoá theo `distance_km`. Vì vậy `select_vehicle` mang `distance_km` đi kèm.

> **Ghi chú cũ còn giá trị** (`ride-flow-design.md` mục 5.1): `veh-bike` và `veh-car` **giữ nguyên `id`** (quy tắc 5). Phân tích lựa chọn xe nên gom theo **`vehicle_type`** (2 nhóm) thay vì từng `vehicle_id` (6 nhóm) — vài chục session mà chia 6 thì mỗi nhóm không nói được gì.

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
base_price  = round((openingFare + max(0, distance_km - 2) × pricePerKm) / 1000) × 1000
final_price = base_price - discount_amount
```
`distance_km` lấy từ `GET /api/route` (OSRM). Khi dịch vụ định tuyến không trả lời, nó là khoảng cách đường chim bay và `route_source` ghi `"straight"` — giá vẫn tính bằng đúng công thức trên, chỉ đầu vào kém chính xác hơn.

**Food** (`food_confirm`):
```
cart_total  = Σ (price × quantity)
final_total = cart_total + SHIPPING_FEE - discount_amount
```
`offer-freeship` giảm đúng bằng `SHIPPING_FEE` nên `final_total` = `cart_total`. Không có thuế, không phụ phí.

Mọi giá trị đều là số nguyên VNĐ; dùng `Math.floor` khi tính phần trăm để không sinh số lẻ.
