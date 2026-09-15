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
 * Diem den co dinh — KHONG co man chon diem den trong pham vi du an,
 * va KHONG ghi event cho no. Chi de UI du nghia. Xem mock-data.md muc 1.
 */
export const FIXED_DESTINATION = 'Hồ Gươm, Hoàn Kiếm, Hà Nội';

// ─────────────────────────────────────────────────────────────
// 1. Dia chi — luong Ride, man `address_selection`
// ─────────────────────────────────────────────────────────────

export interface Address {
  id: string;
  /** Ten ngan, hien thi dam. */
  label: string;
  /** Dia chi day du, hien thi mo ben duoi. */
  address: string;
  icon: 'home' | 'work' | 'school' | 'plane' | 'shop';
}

export const ADDRESSES: Address[] = [
  {
    id: 'addr-home',
    label: 'Nhà',
    address: 'Số 12, ngõ 34 Trần Duy Hưng, Cầu Giấy, Hà Nội',
    icon: 'home',
  },
  {
    id: 'addr-office',
    label: 'Công ty',
    address: 'Keangnam Landmark 72, Phạm Hùng, Nam Từ Liêm, Hà Nội',
    icon: 'work',
  },
  {
    id: 'addr-school',
    label: 'Trường',
    address: 'VinUniversity, Ocean Park, Gia Lâm, Hà Nội',
    icon: 'school',
  },
  {
    id: 'addr-airport',
    label: 'Sân bay',
    address: 'Sân bay Quốc tế Nội Bài, Sóc Sơn, Hà Nội',
    icon: 'plane',
  },
  {
    id: 'addr-mall',
    label: 'Trung tâm thương mại',
    address: 'Vincom Mega Mall Royal City, Thanh Xuân, Hà Nội',
    icon: 'shop',
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
  /** VND, gia co dinh cho chuyen — khong tinh theo km. */
  basePrice: number;
  etaMinutes: number;
  seats: number;
}

export const VEHICLES: Vehicle[] = [
  {
    id: 'veh-bike',
    type: 'bike',
    name: 'Xe máy',
    description: 'Nhanh, tiết kiệm cho quãng ngắn',
    basePrice: 25_000,
    etaMinutes: 3,
    seats: 1,
  },
  {
    id: 'veh-car',
    type: 'car',
    name: 'Ô tô',
    description: 'Xe điện 4 chỗ, êm và mát',
    basePrice: 75_000,
    etaMinutes: 6,
    seats: 4,
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

export interface FoodItem {
  id: string;
  name: string;
  restaurant: string;
  price: number;
  category: FoodCategory;
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
    description: 'Thịt nướng than hoa, pate gan và rau thơm trong vỏ bánh giòn.',
  },
  {
    id: 'pho-bo-02',
    name: 'Phở bò tái',
    restaurant: 'Phở Thìn Bờ Hồ',
    price: 55_000,
    category: 'main',
    description: 'Nước dùng ninh xương 12 tiếng, bò tái mềm, hành trần.',
  },
  {
    id: 'bun-cha-03',
    name: 'Bún chả Hà Nội',
    restaurant: 'Bún Chả Hương Liên',
    price: 50_000,
    category: 'main',
    description: 'Chả viên và chả miếng nướng than, nước chấm chua ngọt.',
  },
  {
    id: 'com-tam-04',
    name: 'Cơm tấm sườn bì chả',
    restaurant: 'Cơm Tấm Ba Ghiền',
    price: 60_000,
    category: 'main',
    description: 'Sườn nướng mật ong, bì trộn thính, chả trứng hấp.',
  },
  {
    id: 'banh-xeo-05',
    name: 'Bánh xèo miền Tây',
    restaurant: 'Bánh Xèo Ăn Là Ghiền',
    price: 65_000,
    category: 'main',
    description: 'Vỏ bánh vàng giòn, nhân tôm thịt giá, ăn kèm rau sống.',
  },
  {
    id: 'tra-sua-06',
    name: 'Trà sữa trân châu đường đen',
    restaurant: 'Phúc Long',
    price: 45_000,
    category: 'drink',
    description: 'Trà sữa đậm vị, trân châu đường đen nấu trong ngày.',
  },
  {
    id: 'ca-phe-07',
    name: 'Cà phê sữa đá',
    restaurant: 'Highlands Coffee',
    price: 29_000,
    category: 'drink',
    description: 'Cà phê robusta rang đậm, sữa đặc, đá viên.',
  },
  {
    id: 'che-08',
    name: 'Chè khúc bạch',
    restaurant: 'Chè Bốn Mùa',
    price: 32_000,
    category: 'dessert',
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
