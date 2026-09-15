# mock-data.md — GSM ride-booking simulation

> Toàn bộ dữ liệu tĩnh của app. Hardcode trong `lib/mock-data.ts`, **không** gọi API để lấy. Các `id` ở đây đi thẳng vào `properties` của event nên **không được đổi tuỳ tiện** — đổi id sẽ làm dữ liệu các phiên cũ không ghép được với phiên mới.

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
}
```

| `id` | `label` | `address` | `icon` |
|---|---|---|---|
| `addr-home` | Nhà | Số 12, ngõ 34 Trần Duy Hưng, Cầu Giấy, Hà Nội | `home` |
| `addr-office` | Công ty | Keangnam Landmark 72, Phạm Hùng, Nam Từ Liêm, Hà Nội | `work` |
| `addr-school` | Trường | VinUniversity, Ocean Park, Gia Lâm, Hà Nội | `school` |
| `addr-airport` | Sân bay | Sân bay Quốc tế Nội Bài, Sóc Sơn, Hà Nội | `plane` |
| `addr-mall` | Trung tâm thương mại | Vincom Mega Mall Royal City, Thanh Xuân, Hà Nội | `shop` |

Điểm đến: **không có màn chọn điểm đến** trong phạm vi dự án — chỉ chọn điểm đón. Nếu UI cần hiển thị điểm đến cho đủ nghĩa, dùng chuỗi cố định `"Hồ Gươm, Hoàn Kiếm, Hà Nội"` và **không** ghi event cho nó.

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
| `veh-bike` | `bike` | Xe máy | Nhanh, tiết kiệm cho quãng ngắn | 25000 | 3 | 1 |
| `veh-car` | `car` | Ô tô | Xe điện 4 chỗ, êm và mát | 75000 | 6 | 4 |

> `DESIGN.md` chốt đúng 2 lựa chọn (Xe máy / Ô tô). Không thêm hạng xe khác — mỗi lựa chọn thêm sẽ làm loãng mẫu funnel khi chỉ có vài chục session.

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
