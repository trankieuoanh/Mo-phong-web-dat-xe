/**
 * Toan bo du lieu tinh cua app. Nguon: mock-data.md.
 *
 * CANH BAO: cac `id` o day di THANG vao `properties` cua event.
 * Doi mot id = du lieu cac phien cu khong ghep duoc voi phien moi.
 * Xem CLAUDE.md quy tac 5.
 *
 * File nay chi chua DU LIEU. Logic tinh tien nam o pricing.ts.
 */

/** Phi giao hang co dinh, luong Food. */
export const SHIPPING_FEE = 15_000;
export const CURRENCY = 'đ';

/**
 * Diem DON MAC DINH — app that tu dinh vi GPS, man `pickup_confirm` hien san
 * gia tri nay. KHONG con la hang so bat bien: man do gio co o tim, nguoi dung
 * doi duoc diem don, va `confirm_pickup` ghi lai lua chon do.
 *
 * `id` phai on dinh — no di thang vao `properties.pickup_id`, va
 * `pickup_id != 'pickup-current'` chinh la ti le nguoi doi diem don
 * (analysis-spec.md nhom 5). Xem mock-data.md muc 1.
 */
export const FIXED_PICKUP = {
  id: 'pickup-current',
  label: 'Vị trí hiện tại',
  address: '128 Xuân Thủy, Cầu Giấy, Hà Nội',
  lat: 21.0369,
  lon: 105.7856,
};


// ─────────────────────────────────────────────────────────────
// 1. Dia chi — luong Ride, man `address_selection`
//
// Day la danh sach DIEM DEN goi y ("Ban muon di den dau?").
// Diem don la hang so FIXED_PICKUP o tren.
// ─────────────────────────────────────────────────────────────

export interface Address {
  id: string;
  /** Ten ngan, hien thi dam. */
  label: string;
  /** Dia chi day du, hien thi mo ben duoi. */
  address: string;
  icon: 'home' | 'work' | 'school' | 'plane' | 'shop';
  /**
   * BAT BUOC. Dung de ve ban do va tinh tuyen duong that.
   * Toa do tra tu chinh Nominatim — cung nguon voi dia chi nguoi dung tu tim,
   * nen hai nhanh `preset` va `search` nam tren cung mot he quy chieu.
   */
  lat: number;
  lon: number;
}

/**
 * Nam dia chi goi y — hien khi o tim con trong.
 *
 * Truong `distanceKm` da bi XOA: no la khoang cach hardcode toi diem don CU.
 * Tu khi diem don doi duoc va tuyen duong tinh that, de lai truong do la bao
 * dam co luc man hinh hien "15.2 km" ngay canh mot tuyen duong 31 km.
 * Khoang cach goi y gio tinh tai cho bang haversineKm() tu diem don hien tai.
 */
export const ADDRESSES: Address[] = [
  {
    id: 'addr-home',
    label: 'Nhà',
    address: 'Số 12, ngõ 34 Trần Duy Hưng, Cầu Giấy, Hà Nội',
    icon: 'home',
    lat: 21.0052,
    lon: 105.7989,
  },
  {
    id: 'addr-office',
    label: 'Công ty',
    address: 'Landmark 72, Phạm Hùng, Nam Từ Liêm, Hà Nội',
    icon: 'work',
    lat: 21.0174,
    lon: 105.7836,
  },
  {
    id: 'addr-mall',
    label: 'Trung tâm thương mại',
    address: 'Vincom Mega Mall Royal City, Thanh Xuân, Hà Nội',
    icon: 'shop',
    lat: 21.0023,
    lon: 105.8160,
  },
  {
    id: 'addr-school',
    label: 'Trường',
    address: 'VinUniversity, Ocean Park, Gia Lâm, Hà Nội',
    icon: 'school',
    lat: 20.9886,
    lon: 105.9460,
  },
  {
    id: 'addr-airport',
    label: 'Sân bay',
    address: 'Sân bay Quốc tế Nội Bài, Sóc Sơn, Hà Nội',
    icon: 'plane',
    lat: 21.2189,
    lon: 105.8045,
  },
];

// ─────────────────────────────────────────────────────────────
// 2. Loai xe — luong Ride, man `vehicle_selection`
// ─────────────────────────────────────────────────────────────

export type VehicleType = 'bike' | 'car';

export interface Vehicle {
  id: string;
  type: VehicleType;
  name: string;
  description: string;
  /** VND — gia mo cua, DA GOM INCLUDED_KM km dau. */
  openingFare: number;
  /** VND cho moi km vuot qua INCLUDED_KM. */
  pricePerKm: number;
  etaMinutes: number;
  seats: number;
}

/**
 * Sau hang xe — mock-data.md muc 2.
 *
 * `basePrice` DA BI XOA: gia khong con la thuoc tinh cua hang xe ma la ham cua
 * (hang xe, quang duong) — xem calcFare() trong pricing.ts.
 *
 * Cac he so duoc chon de MOT CHUYEN 15 KM ra dung con so `basePrice` cu
 * (58.000 / 72.000 / 145.000 / 149.000 / 161.000 / 194.000). Do la rang buoc
 * tu dat khi chuyen sang tinh theo km: 15 km la quang duong cua FIXED_ROUTE
 * da xoa, nen moi anh chup man hinh va ghi chep demo tu truoc van khop, va
 * chi co CACH TINH doi chu khong phai THANG GIA.
 *
 * `veh-bike` va `veh-car` GIU NGUYEN id (CLAUDE.md quy tac 5).
 * Phan tich lua chon xe nen gom theo `type` (2 nhom) chu khong theo `id`
 * (6 nhom) — vai chuc session ma chia 6 thi moi nhom khong con noi duoc gi.
 */
export const VEHICLES: Vehicle[] = [
  {
    id: 'veh-bike',
    type: 'bike',
    name: 'Green Bike',
    description: 'Xe máy điện, nhanh và tiết kiệm',
    openingFare: 15_000,
    pricePerKm: 3_300,
    etaMinutes: 2,
    seats: 1,
  },
  {
    id: 'veh-bike-plus',
    type: 'bike',
    name: 'Green Bike Plus',
    description: 'Xe máy điện đời mới, tài xế kinh nghiệm',
    openingFare: 20_000,
    pricePerKm: 4_000,
    etaMinutes: 3,
    seats: 1,
  },
  {
    id: 'veh-mini',
    type: 'car',
    name: 'Green Mini',
    description: 'Xe điện 3 chỗ, giá tốt nhất',
    openingFare: 28_000,
    pricePerKm: 9_000,
    etaMinutes: 3,
    seats: 3,
  },
  {
    id: 'veh-car',
    type: 'car',
    name: 'Green Car',
    description: 'Xe điện 4 chỗ, êm và mát',
    openingFare: 32_000,
    pricePerKm: 9_000,
    etaMinutes: 3,
    seats: 4,
  },
  {
    id: 'veh-premium',
    type: 'car',
    name: 'Green Premium',
    description: 'Xe điện hạng sang 4 chỗ',
    openingFare: 35_000,
    pricePerKm: 9_700,
    etaMinutes: 3,
    seats: 4,
  },
  {
    id: 'veh-limo',
    type: 'car',
    name: 'Green Limo',
    description: 'Xe điện 6 chỗ, rộng rãi cho nhóm',
    openingFare: 46_000,
    pricePerKm: 11_400,
    etaMinutes: 4,
    seats: 6,
  },
];

// ─────────────────────────────────────────────────────────────
// 3. Khuyen mai (Ride) va Uu dai (Food) — chung mot interface
// ─────────────────────────────────────────────────────────────

export interface DiscountRule {
  id: string;
  code: string;
  title: string;
  description: string;
  type: 'fixed' | 'percent';
  /** fixed: so tien VND | percent: phan tram. */
  value: number;
  /** Chi voi type 'percent'. */
  maxDiscount?: number;
  /** Gia tri toi thieu de ap dung. */
  minOrder: number;
}

/** Luong Ride, man `promo_selection`. */
export const PROMOS: DiscountRule[] = [
  {
    id: 'promo-10k',
    code: 'GSM10K',
    title: 'Giảm 10.000đ',
    description: 'Áp dụng cho mọi chuyến xe, không yêu cầu giá trị tối thiểu',
    type: 'fixed',
    value: 10_000,
    minOrder: 0,
  },
  {
    id: 'promo-20',
    code: 'GSM20',
    title: 'Giảm 20%, tối đa 30.000đ',
    description: 'Áp dụng cho chuyến từ 50.000đ',
    type: 'percent',
    value: 20,
    maxDiscount: 30_000,
    minOrder: 50_000,
  },
  {
    id: 'promo-new',
    code: 'NEWGSM',
    title: 'Giảm 50% chuyến đầu, tối đa 40.000đ',
    description: 'Dành cho khách hàng lần đầu đặt xe Green SM',
    type: 'percent',
    value: 50,
    maxDiscount: 40_000,
    minOrder: 0,
  },
];

/**
 * Luong Food, man `food_offer_selection`.
 * Ap len TIEN HANG (cart_total), khong ap len phi giao — tru `offer-freeship`.
 */
export const OFFERS: DiscountRule[] = [
  {
    id: 'offer-freeship',
    code: 'FREESHIP',
    title: 'Miễn phí giao hàng',
    description: 'Giảm trọn phí giao hàng 15.000đ cho mọi đơn',
    type: 'fixed',
    value: SHIPPING_FEE,
    minOrder: 0,
  },
  {
    id: 'offer-15',
    code: 'FOOD15',
    title: 'Giảm 15%, tối đa 25.000đ',
    description: 'Áp dụng cho đơn hàng từ 100.000đ',
    type: 'percent',
    value: 15,
    maxDiscount: 25_000,
    minOrder: 100_000,
  },
  {
    id: 'offer-25k',
    code: 'FOOD25K',
    title: 'Giảm 25.000đ cho đơn từ 150.000đ',
    description: 'Áp dụng cho đơn hàng từ 150.000đ',
    type: 'fixed',
    value: 25_000,
    minOrder: 150_000,
  },
];

// ─────────────────────────────────────────────────────────────
// 4. Menu mon an — luong Food, man `food_menu`
// ─────────────────────────────────────────────────────────────

export type FoodCategory = 'main' | 'drink' | 'dessert';

/**
 * Bua an trong ngay. Truc nay VUONG GOC voi `FoodCategory`: mot mon uong van an
 * duoc ca ba bua, con mot mon chinh chua chac hop bua sang.
 */
export type Meal = 'breakfast' | 'lunch' | 'dinner';

export interface FoodItem {
  id: string;
  name: string;
  /**
   * Ten quan GOC cua mon — chi de hien thi o the mon khi KHONG loc theo quan.
   * Khi nguoi dung chon mot quan that o dai "Gan ban", the mon phai hien ten
   * quan DANG CHON chu khong phai truong nay (xem app/food/page.tsx).
   */
  restaurant: string;
  price: number;
  category: FoodCategory;
  /** Bua nao hop an mon nay — dung cho dai goi y sang/trua/toi. */
  meals: Meal[];
  /** Khong di vao event — chi de hien thi. */
  description: string;
}

export const FOOD_ITEMS: FoodItem[] = [
  {
    id: 'banh-mi-01',
    name: 'Bánh mì thịt nướng',
    restaurant: 'Bánh Mì 25',
    price: 35_000,
    category: 'main',
    meals: ['breakfast', 'lunch'],
    description: 'Thịt nướng than hoa, pate gan và rau thơm trong vỏ bánh giòn.',
  },
  {
    id: 'pho-bo-02',
    name: 'Phở bò tái',
    restaurant: 'Phở Thìn Bờ Hồ',
    price: 55_000,
    category: 'main',
    meals: ['breakfast', 'lunch', 'dinner'],
    description: 'Nước dùng ninh xương 12 tiếng, bò tái mềm, hành trần.',
  },
  {
    id: 'bun-cha-03',
    name: 'Bún chả Hà Nội',
    restaurant: 'Bún Chả Hương Liên',
    price: 50_000,
    category: 'main',
    meals: ['lunch', 'dinner'],
    description: 'Chả viên và chả miếng nướng than, nước chấm chua ngọt.',
  },
  {
    id: 'com-tam-04',
    name: 'Cơm tấm sườn bì chả',
    restaurant: 'Cơm Tấm Ba Ghiền',
    price: 60_000,
    category: 'main',
    meals: ['lunch', 'dinner'],
    description: 'Sườn nướng mật ong, bì trộn thính, chả trứng hấp.',
  },
  {
    id: 'banh-xeo-05',
    name: 'Bánh xèo miền Tây',
    restaurant: 'Bánh Xèo Ăn Là Ghiền',
    price: 65_000,
    category: 'main',
    meals: ['lunch', 'dinner'],
    description: 'Vỏ bánh vàng giòn, nhân tôm thịt giá, ăn kèm rau sống.',
  },
  {
    id: 'tra-sua-06',
    name: 'Trà sữa trân châu đường đen',
    restaurant: 'Phúc Long',
    price: 45_000,
    category: 'drink',
    meals: ['lunch', 'dinner'],
    description: 'Trà sữa đậm vị, trân châu đường đen nấu trong ngày.',
  },
  {
    id: 'ca-phe-07',
    name: 'Cà phê sữa đá',
    restaurant: 'Highlands Coffee',
    price: 29_000,
    category: 'drink',
    meals: ['breakfast', 'lunch'],
    description: 'Cà phê robusta rang đậm, sữa đặc, đá viên.',
  },
  {
    id: 'che-08',
    name: 'Chè khúc bạch',
    restaurant: 'Chè Bốn Mùa',
    price: 32_000,
    category: 'dessert',
    meals: ['lunch', 'dinner'],
    description: 'Khúc bạch phô mai mềm, nhãn lồng và hạnh nhân rang.',
  },
];

export const FOOD_CATEGORIES: { id: FoodCategory; label: string }[] = [
  { id: 'main', label: 'Món chính' },
  { id: 'drink', label: 'Đồ uống' },
  { id: 'dessert', label: 'Tráng miệng' },
];

// ─────────────────────────────────────────────────────────────
// Tra cuu theo id
// ─────────────────────────────────────────────────────────────

export const getAddress = (id: string): Address | undefined =>
  ADDRESSES.find((a) => a.id === id);

export const getVehicle = (id: string): Vehicle | undefined =>
  VEHICLES.find((v) => v.id === id);

export const getPromo = (id: string): DiscountRule | undefined =>
  PROMOS.find((p) => p.id === id);

export const getOffer = (id: string): DiscountRule | undefined =>
  OFFERS.find((o) => o.id === id);

export const getFoodItem = (id: string): FoodItem | undefined =>
  FOOD_ITEMS.find((f) => f.id === id);
