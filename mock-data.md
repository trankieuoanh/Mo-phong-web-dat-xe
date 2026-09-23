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

Toạ độ tra từ chính Nominatim — cùng nguồn với địa chỉ người dùng tự tìm, nên ba nhánh `preset`, `search` và `map` (bấm trên bản đồ) nằm trên cùng một hệ quy chiếu.

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
export interface DiscountRule {
  id: string;
  code: string;
  title: string;
  description: string;
  type: 'fixed' | 'percent';
  value: number;          // fixed: số tiền VNĐ | percent: phần trăm
  maxDiscount?: number;   // chỉ với type 'percent'
  minOrder: number;       // giá trị tối thiểu để áp dụng

  // ── Bốn điều kiện linh hoạt, tất cả optional ──
  vehicleTypes?: VehicleType[];              // chỉ áp cho hạng xe này (Ride)
  minDistanceKm?: number;                    // quãng đường tối thiểu (Ride)
  activeHours?: { from: number; to: number };// giờ vàng [from, to), from > to = vắt qua nửa đêm
  appliesTo?: 'subtotal' | 'shipping';       // mặc định 'subtotal'
}
```

Bốn trường cuối đều **optional**, nên ba mã viết trước khi có chúng vẫn giữ nguyên nghĩa: vắng hết = một luật chỉ phụ thuộc `minOrder`.

| `id` | `code` | `title` | `type` | `value` | `maxDiscount` | `minOrder` | điều kiện thêm |
|---|---|---|---|---|---|---|---|
| `promo-10k` | `GSM10K` | Giảm 10.000đ | `fixed` | 10000 | — | 0 | — |
| `promo-20` | `GSM20` | Giảm 20%, tối đa 30.000đ | `percent` | 20 | 30000 | 50000 | — |
| `promo-new` | `NEWGSM` | Giảm 50% chuyến đầu, tối đa 40.000đ | `percent` | 50 | 40000 | 0 | — |
| `promo-bike` | `GSMBIKE` | Giảm 15% xe máy, tối đa 20.000đ | `percent` | 15 | 20000 | 0 | `vehicleTypes: ['bike']` |
| `promo-car` | `GSMCAR` | Giảm 30.000đ cho xe ô tô | `fixed` | 30000 | — | 80000 | `vehicleTypes: ['car']` |
| `promo-lunch` | `GSMTRUA` | Giờ vàng trưa: giảm 25.000đ | `fixed` | 25000 | — | 40000 | `activeHours: 11→13` |
| `promo-far` | `GSMFAR` | Chuyến xa: giảm 12%, tối đa 50.000đ | `percent` | 12 | 50000 | 0 | `minDistanceKm: 8` |

**Quy tắc tính giảm giá** (dùng chung cho Promo và Offer):
```ts
function calcDiscount(rule, subtotal: number, shippingFee = 0): number {
  if (subtotal < rule.minOrder) return 0;                     // minOrder LUÔN xét trên subtotal
  const base = rule.appliesTo === 'shipping' ? shippingFee : subtotal;
  if (rule.type === 'fixed') return Math.min(rule.value, base);
  const raw = Math.floor(base * rule.value / 100);
  return rule.maxDiscount ? Math.min(raw, rule.maxDiscount) : raw;
}
```

> **`calcDiscount` cố ý KHÔNG xét `vehicleTypes` / `minDistanceKm` / `activeHours`.** Hàm này chạy ở **ba** chỗ cho cùng một chuyến — màn chọn ưu đãi, màn xác nhận, và lúc ghi `confirm_ride` / `place_order` — và cả ba bắt buộc ra cùng một con số (xem §6). Nếu nó xét cả giờ vàng thì người chọn mã lúc 12:59 rồi bấm xác nhận lúc 13:01 sẽ thấy giá nhảy, và `discount_amount` trong event lệch hẳn số hiện trên màn hình. Bốn điều kiện đó gác **quyền dùng**, và chỉ được xét một lần — ở `ruleBlock()`, ngay trước khi người dùng chọn. **Chọn rồi thì ưu đãi thuộc về họ.**

**Xét quyền dùng** — `ruleBlock(rule, subtotal, ctx)` trả `null` khi dùng được, ngược lại trả điều kiện **đầu tiên** chưa thoả, theo thứ tự `vehicle` → `distance` → `hours` → `min_order`. Cụ thể trước, chung chung sau: với người đang chọn ô tô mà nhìn mã `GSMBIKE`, "Chỉ áp dụng cho xe máy" nói đúng vấn đề, còn "Cần đơn tối thiểu" thì không nói gì cả.

`ruleBlock` trả về **dữ liệu, không phải câu chữ** (`packages/shared` không được biết tới `formatVnd`); việc đổi sang tiếng Việt nằm ở `formatRuleBlock()` trong `apps/web/lib/format.ts` — một chỗ duy nhất cho cả hai màn.

> **`activeHours` và bẫy hydration.** `ctx.hour` phải được đọc trong `useEffect`, **không** đọc lúc render: Next prerender client component ở server, mà giờ server (UTC) lệch giờ máy (UTC+7). Cùng quy ước đã ghi cho `mealOfHour()` ở §4. `hour === undefined` (lượt render đầu) được coi là **ngoài giờ**, nên server và lượt hydrate đầu cho ra cùng một HTML: cả hai đều vẽ mã giờ vàng ở trạng thái khoá.

Khuyến mãi không đủ điều kiện vẫn **hiển thị nhưng bị disable**, kèm dòng giải thích — người dùng thấy được lý do, và ta không ghi event cho lựa chọn bị disable.

---

## 4. Menu món ăn (luồng Food — `food_menu`)

> **Không còn trường `restaurant`.** Tên quán giờ đến từ **OpenStreetMap** chứ không từ file này — xem mục 4b. Món được gắn vào quán nào là do **tag `cuisine` THẬT** của quán đó quyết định.

```ts
export type FoodCategory = 'main' | 'drink' | 'dessert';
export type Meal = 'breakfast' | 'lunch' | 'dinner';

export type Cuisine =
  | 'vietnamese' | 'japanese' | 'korean' | 'grill'
  | 'pizza' | 'american' | 'seafood' | 'cafe' | 'dessert';

export interface FoodItem {
  id: string;
  name: string;
  price: number;
  category: FoodCategory;
  cuisine: Cuisine;      // nối món với tag `cuisine` thật của quán
  meals: Meal[];         // bữa nào hợp ăn món này
  description: string;
  image?: string;        // đường dẫn trong apps/web/public — ĐỂ TRỐNG ở cả 29 món
}
```

**`image` vắng mặt ở toàn bộ 29 món, và đó là trạng thái đúng.** Lệnh cấm ảnh thật ở mục này không đổi; trường này tồn tại để hôm nào có ảnh thì thả file vào `apps/web/public/food/<id>.webp` rồi điền đường dẫn là xong, không phải sửa component nào. Khi vắng, `FoodThumb` vẽ khung có glyph theo `cuisine` (`tailwind-theme.md` mục 7). `image` **không đi vào event**.

**Ba trục phân loại, vuông góc với nhau:** `category` là *loại* món (chính / uống / tráng miệng), `meals` là *lúc* ăn, `cuisine` là *kiểu bếp*. Mỗi trục là một bộ lọc khác nhau ở màn menu.

**29 món, phủ 9 kiểu bếp.** Danh sách kiểu bếp được chọn từ **mẫu 120 quán ăn thật ở Hà Nội** (lấy qua Nominatim), theo tần suất giảm dần: `vietnamese` 28, `regional` 6, `japanese` 5, `korean` 3, `pizza` 3, `noodle` 3, `barbecue` 3, `dessert` 2, `french` 2, `phở` 2 — chứ không phải đoán.

| kiểu bếp | số món | `id` |
|---|:--:|---|
| `vietnamese` | 5 | `banh-mi-01`, `pho-bo-02`, `bun-cha-03`, `com-tam-04`, `banh-xeo-05` |
| `cafe` | 3 | `tra-sua-06`, `ca-phe-07`, `nuoc-ep-27` |
| `dessert` | 3 | `che-08`, `kem-28`, `banh-flan-29` |
| `japanese` | 3 | `sushi-09`, `ramen-10`, `gyoza-11` |
| `korean` | 3 | `kimbap-12`, `bibimbap-13`, `ga-ran-14` |
| `grill` | 3 | `suon-nuong-15`, `ba-chi-nuong-16`, `bo-nuong-17` |
| `pizza` | 3 | `pizza-margherita-18`, `pizza-hai-san-19`, `mi-y-20` |
| `american` | 3 | `burger-21`, `khoai-tay-22`, `hot-dog-23` |
| `seafood` | 3 | `tom-nuong-24`, `muc-chien-25`, `lau-hai-san-26` |

> **Tám `id` đầu giữ nguyên** (`banh-mi-01` … `che-08`) — chúng đi thẳng vào `properties` của event, đổi là dữ liệu cũ và mới không ghép được (`CLAUDE.md` quy tắc 5). Món mới nối tiếp cùng định dạng `<tên-món>-<số>`.

`description`: một câu ngắn, **không đi vào event**.

**Ảnh món: DÙNG ẢNH THẬT.** (Quy tắc cũ — "không dùng ảnh thật, mỗi món là một ô 4:3 với ký tự đầu của tên món" — **đã bỏ**: 29 ô chữ cái gần như giống hệt nhau làm cả lưới trông như bản nháp, và đó là điều đầu tiên người dùng thử nhận xét.)

Ảnh **tải sẵn về repo**, không gọi mạng lúc chạy:

- `scripts/fetch-food-images.mjs` lấy ảnh từ **Wikimedia Commons** về `apps/web/public/food/<id>.jpg`.
- Giấy phép và tác giả từng ảnh ghi ở **`apps/web/public/food/CREDITS.md`**. Ảnh Commons phần lớn là CC BY / CC BY-SA nên **ghi công là bắt buộc**, không phải phép lịch sự.
- Trường `image` trên `FoodItem` vẫn **optional**: món nào không có ảnh đúng thì để trống, và `FoodThumb` lui về khung có glyph theo `cuisine`. Một ô glyph thì thật thà, còn một tấm ảnh sai món thì không.

> **Tìm ảnh tự động là trò đoán, và nó đoán sai 8/29 lần ở vòng đầu** — một khoanh thịt quay cho "bánh mì", một nồi lá dứa cho "chè", một gói khoai tây **có logo thương hiệu** cho "khoai tây chiên". Vì vậy script cho phép **ghim cứng tên tệp** cho từng món, và danh sách ghim hiện tại chính là kết quả của việc đã xem từng ảnh một. Xem lại bằng mắt sau mỗi lần chạy lại.

### 4b. Nhà hàng — dữ liệu THẬT, không có trong file này

Dải "Gần bạn" lấy quán từ **`GET /api/restaurants`** (Nominatim, `amenity=restaurant` quanh `DEFAULT_PICKUP`). **Không có danh sách nhà hàng nào để chốt ở đây** — `restaurant_id` là id `osm-<T><osm_id>`, cùng khuôn với địa chỉ người dùng tự tìm.

Mỗi quán mang thêm **dữ liệu thật** đọc từ `extratags` của OSM: `cuisine`, `openingHours`, `phone` (kiểu `Restaurant` trong `packages/shared/src/places.ts`).

**Quán thật ↔ món nối với nhau bằng `menuOf(restaurant)`** (`packages/shared/src/food.ts`): quy đổi tag `cuisine` thô sang kiểu bếp qua `CUISINE_ALIASES`, lọc món theo kiểu bếp đó, rồi xoay danh sách theo một hàm băm FNV-1a của `restaurant.id`. Bốn tính chất bắt buộc:

1. **Theo kiểu bếp thật** — quán `japanese` ra sushi/ramen, quán `barbecue` ra đồ nướng. Trước đây mọi quán đều bốc từ cùng một rổ món Việt, nên một quán Nhật vẫn hiện ra bánh mì.
2. **Tất định** — cùng một quán luôn ra cùng thực đơn, ở mọi phiên và mọi máy. Nếu ngẫu nhiên thì `select_restaurant` và `add_to_cart` trong cùng một phiên sẽ kể hai câu chuyện khác nhau.
3. **Có đường lùi** — **một nửa số quán thật không khai báo `cuisine`**, và có tag ta không nhận ra (`russian`, `french`, `indian`…). Khi đó lùi về món Việt thay vì trả thực đơn rỗng: một quán không có món nào là ngõ cụt trong luồng.
4. **Không lưu sẵn khoảng cách** — `distance_km` tính tại chỗ bằng `haversineKm` từ điểm đón hiện tại, đúng bài học đã ghi ở mục 1.

`CUISINE_ALIASES` phải chịu được **ba điều bất ngờ của dữ liệu thật**: một quán có nhiều giá trị ngăn bằng `;` (`asian;oriental;vietnamese`); có tag **tiếng Việt có dấu** (`phở`, `nướng`, `hàn_quốc`, `hải_sản`) nên phải `normalizeVi` trước khi tra bảng; và `regional` — giá trị phổ biến thứ hai — trong ngữ cảnh Việt Nam nghĩa là món địa phương nên quy về `vietnamese`.

**Giá thì vẫn phải tự đặt**: không nguồn mở nào có giá món ăn thật.

## 5. Ưu đãi (luồng Food — `food_offer_selection`)

Cùng interface `DiscountRule` với Promo, áp lên **tiền hàng** (`cart_total`) — trừ những mã có `appliesTo: 'shipping'`, áp lên **phí giao**.

| `id` | `code` | `title` | `type` | `value` | `maxDiscount` | `minOrder` | điều kiện thêm |
|---|---|---|---|---|---|---|---|
| `offer-freeship` | `FREESHIP` | Miễn phí giao hàng | `fixed` | 15000 | — | 0 | `appliesTo: 'shipping'` |
| `offer-15` | `FOOD15` | Giảm 15%, tối đa 25.000đ | `percent` | 15 | 25000 | 100000 | — |
| `offer-25k` | `FOOD25K` | Giảm 25.000đ cho đơn từ 150.000đ | `fixed` | 25000 | — | 150000 | — |
| `offer-ship-half` | `SHIP50` | Giảm 50% phí giao | `percent` | 50 | — | 0 | `appliesTo: 'shipping'` |
| `offer-breakfast` | `SANG20` | Bữa sáng: giảm 20%, tối đa 20.000đ | `percent` | 20 | 20000 | 0 | `activeHours: 5→10` |
| `offer-latenight` | `DEM15K` | Ăn khuya: giảm 15.000đ | `fixed` | 15000 | — | 60000 | `activeHours: 21→2` |
| `offer-big` | `FOOD50K` | Giảm 50.000đ cho đơn từ 300.000đ | `fixed` | 50000 | — | 300000 | — |

> **`offer-freeship` đổi hành vi ở đơn nhỏ** (id và code **không đổi**). Trước đây base là `cart_total`, nên `Math.min(15_000, cart_total)` cắt mất phần giảm: đơn 10.000đ chỉ được giảm 10.000đ, tức **vẫn trả 5.000đ phí giao** — trái với chính `title` của nó. Với `appliesTo: 'shipping'`, base là `SHIPPING_FEE` nên luôn giảm trọn 15.000đ và `final_total` đúng bằng `cart_total`. Dữ liệu sinh trước thay đổi này có `discount_amount` thấp hơn ở các đơn dưới 15.000đ.
>
> `offer-latenight` là cửa sổ **duy nhất vắt qua nửa đêm** trong cả hai danh sách — đúng ca mà `isHourInWindow()` phải xử lý riêng (phép so sánh thẳng `from <= h && h < to` trả về false cho **mọi** giờ khi `from > to`).

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
