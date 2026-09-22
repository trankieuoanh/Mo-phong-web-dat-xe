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

  // ── Bon dieu kien duoi day deu OPTIONAL, va deu chi gac QUYEN DUNG ──
  //
  // Vang het = mot luat chi phu thuoc `minOrder`, tuc dung y het ba ma dau
  // tien viet truoc khi co chung. Do la ly do chung phai optional: them dieu
  // kien moi khong duoc lam mot luat cu nao doi nghia.
  //
  // KHONG cai nao trong so nay tham gia tinh TIEN. Ly do o dau calcDiscount()
  // trong pricing.ts — mot uu dai da chon thi thuoc ve nguoi dung roi.

  /** Chi ap cho cac hang xe nay. Vang = moi hang. Chi luong Ride. */
  vehicleTypes?: VehicleType[];
  /** Quang duong toi thieu (km). Chi luong Ride. */
  minDistanceKm?: number;
  /**
   * Gio vang, cua so nua mo [from, to) theo gio dia phuong 0-23.
   * `from > to` nghia la vat qua nua dem (21 -> 2).
   */
  activeHours?: { from: number; to: number };
  /**
   * Tien giam tinh TREN cai gi. Mac dinh 'subtotal' (gia chuyen / tien hang).
   *
   * 'shipping' = giam tren PHI GIAO. Phan biet nay khong phai tieu xao: mot ma
   * "giam 50% phi giao" ma tinh 50% tren tien hang thi sai bet, con
   * `offer-freeship` truoc day bi `Math.min(value, cartTotal)` cat mat nen don
   * duoi 15.000d khong he duoc mien phi giao that.
   *
   * `minOrder` VAN xet tren tien hang du appliesTo la gi — "don toi thieu" noi
   * ve don hang, khong noi ve phi giao.
   */
  appliesTo?: 'subtotal' | 'shipping';
}

/** Nhan tieng Viet cua hang xe — dung khi giai thich vi sao mot ma bi khoa. */
export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  bike: 'xe máy',
  car: 'ô tô',
};

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
  {
    id: 'promo-bike',
    code: 'GSMBIKE',
    title: 'Giảm 15% xe máy, tối đa 20.000đ',
    description: 'Chỉ áp dụng cho Green Bike',
    type: 'percent',
    value: 15,
    maxDiscount: 20_000,
    minOrder: 0,
    vehicleTypes: ['bike'],
  },
  {
    id: 'promo-car',
    code: 'GSMCAR',
    title: 'Giảm 30.000đ cho xe ô tô',
    description: 'Áp dụng cho chuyến ô tô từ 80.000đ',
    type: 'fixed',
    value: 30_000,
    minOrder: 80_000,
    vehicleTypes: ['car'],
  },
  {
    id: 'promo-lunch',
    code: 'GSMTRUA',
    title: 'Giờ vàng trưa: giảm 25.000đ',
    description: 'Đặt xe từ 11:00 đến 13:00, chuyến từ 40.000đ',
    type: 'fixed',
    value: 25_000,
    minOrder: 40_000,
    activeHours: { from: 11, to: 13 },
  },
  {
    id: 'promo-far',
    code: 'GSMFAR',
    title: 'Chuyến xa: giảm 12%, tối đa 50.000đ',
    description: 'Áp dụng cho chuyến từ 8 km',
    type: 'percent',
    value: 12,
    maxDiscount: 50_000,
    minOrder: 0,
    minDistanceKm: 8,
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
    // `appliesTo` la thu lam cai `title` tren kia thanh su that. Truoc day base
    // la cartTotal, nen `Math.min(15_000, cartTotal)` cat mat phan giam o don
    // nho: don 10.000d chi duoc giam 10.000d, tuc VAN tra phi giao 5.000d.
    appliesTo: 'shipping',
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
  {
    id: 'offer-ship-half',
    code: 'SHIP50',
    title: 'Giảm 50% phí giao',
    description: 'Giảm nửa phí giao hàng cho mọi đơn',
    type: 'percent',
    value: 50,
    minOrder: 0,
    // 50% cua PHI GIAO (7.500d), khong phai 50% cua tien hang.
    appliesTo: 'shipping',
  },
  {
    id: 'offer-breakfast',
    code: 'SANG20',
    title: 'Bữa sáng: giảm 20%, tối đa 20.000đ',
    description: 'Đặt món từ 05:00 đến 10:00',
    type: 'percent',
    value: 20,
    maxDiscount: 20_000,
    minOrder: 0,
    activeHours: { from: 5, to: 10 },
  },
  {
    id: 'offer-latenight',
    code: 'DEM15K',
    title: 'Ăn khuya: giảm 15.000đ',
    description: 'Đặt món từ 21:00 đến 02:00, đơn từ 60.000đ',
    type: 'fixed',
    value: 15_000,
    minOrder: 60_000,
    // Cua so DUY NHAT vat qua nua dem trong ca hai danh sach — day chinh la ca
    // ma `isHourInWindow` phai xu ly rieng, xem pricing.ts.
    activeHours: { from: 21, to: 2 },
  },
  {
    id: 'offer-big',
    code: 'FOOD50K',
    title: 'Giảm 50.000đ cho đơn từ 300.000đ',
    description: 'Áp dụng cho đơn hàng từ 300.000đ',
    type: 'fixed',
    value: 50_000,
    minOrder: 300_000,
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

/**
 * Kieu bep. KHONG phai mot nhan tu dat: day la truc de noi mon an voi tag
 * `cuisine` THAT cua quan tren OpenStreetMap.
 *
 * Danh sach nay duoc chon tu mau 120 quan an that o Ha Noi (50% co tag
 * `cuisine`), theo tan suat giam dan: vietnamese 28, regional 6, japanese 5,
 * korean 3, pizza 3, noodle 3, barbecue 3, dessert 2, french 2, pho 2...
 * Bang quy doi tag tho -> gia tri o day nam trong food.ts (`CUISINE_ALIASES`).
 */
export type Cuisine =
  | 'vietnamese'
  | 'japanese'
  | 'korean'
  | 'grill'
  | 'pizza'
  | 'american'
  | 'seafood'
  | 'cafe'
  | 'dessert';

export interface FoodItem {
  id: string;
  name: string;
  price: number;
  category: FoodCategory;
  /** Noi mon voi tag `cuisine` that cua quan — xem menuOf() trong food.ts. */
  cuisine: Cuisine;
  /** Bua nao hop an mon nay — dung cho dai goi y sang/trua/toi. */
  meals: Meal[];
  /** Khong di vao event — chi de hien thi. */
  description: string;
  /**
   * Duong dan anh trong apps/web/public, vi du `/food/banh-mi-01.jpg`.
   *
   * ANH THAT, tai san ve repo bang scripts/fetch-food-images.mjs tu Wikimedia
   * Commons. App KHONG goi mang de lay anh — tep nam san trong `public`.
   *
   * Giay phep va tac gia tung anh ghi o `apps/web/public/food/CREDITS.md`. Anh
   * Commons phan lon la CC BY/CC BY-SA nen viec ghi cong la BAT BUOC, khong phai
   * phep lich su.
   *
   * Van optional: mon nao khong tim duoc anh dung thi de trong, va `FoodThumb`
   * lui ve khung co glyph theo kieu bep. Mot o glyph thi that tha, con mot tam
   * anh sai mon thi khong.
   *
   * KHONG di vao event.
   */
  image?: string;
}

/**
 * Thuc don dung chung cho MOI quan that.
 *
 * KHONG con truong `restaurant`: ten quan gio den tu OpenStreetMap chu khong
 * phai tu file nay. Mot mon duoc gan vao quan nao la do tag `cuisine` THAT cua
 * quan do quyet dinh (food.ts), nen mot quan japanese se khong con hien ra
 * "Banh Mi 25" nua.
 *
 * Gia thi van phai tu dat: khong nguon mo nao co gia mon an that.
 */
export const FOOD_ITEMS: FoodItem[] = [
  // ── vietnamese — kieu bep pho bien nhat trong mau (28/60) ──
  {
    id: 'banh-mi-01',
    name: 'Bánh mì thịt nướng',
    price: 35_000,
    category: 'main',
    cuisine: 'vietnamese',
    meals: ['breakfast', 'lunch'],
    description: 'Thịt nướng than hoa, pate gan và rau thơm trong vỏ bánh giòn.',
    image: '/food/banh-mi-01.jpg',
  },
  {
    id: 'pho-bo-02',
    name: 'Phở bò tái',
    price: 55_000,
    category: 'main',
    cuisine: 'vietnamese',
    meals: ['breakfast', 'lunch', 'dinner'],
    description: 'Nước dùng ninh xương 12 tiếng, bò tái mềm, hành trần.',
    image: '/food/pho-bo-02.jpg',
  },
  {
    id: 'bun-cha-03',
    name: 'Bún chả Hà Nội',
    price: 50_000,
    category: 'main',
    cuisine: 'vietnamese',
    meals: ['lunch', 'dinner'],
    description: 'Chả viên và chả miếng nướng than, nước chấm chua ngọt.',
    image: '/food/bun-cha-03.jpg',
  },
  {
    id: 'com-tam-04',
    name: 'Cơm tấm sườn bì chả',
    price: 60_000,
    category: 'main',
    cuisine: 'vietnamese',
    meals: ['lunch', 'dinner'],
    description: 'Sườn nướng mật ong, bì trộn thính, chả trứng hấp.',
    image: '/food/com-tam-04.jpg',
  },
  {
    id: 'banh-xeo-05',
    name: 'Bánh xèo miền Tây',
    price: 65_000,
    category: 'main',
    cuisine: 'vietnamese',
    meals: ['lunch', 'dinner'],
    description: 'Vỏ bánh vàng giòn, nhân tôm thịt giá, ăn kèm rau sống.',
    image: '/food/banh-xeo-05.jpg',
  },

  // ── cafe — tag `cafe`, `juice`, `bubble_tea` ──
  {
    id: 'tra-sua-06',
    name: 'Trà sữa trân châu đường đen',
    price: 45_000,
    category: 'drink',
    cuisine: 'cafe',
    meals: ['lunch', 'dinner'],
    description: 'Trà sữa đậm vị, trân châu đường đen nấu trong ngày.',
    image: '/food/tra-sua-06.jpg',
  },
  {
    id: 'ca-phe-07',
    name: 'Cà phê sữa đá',
    price: 29_000,
    category: 'drink',
    cuisine: 'cafe',
    meals: ['breakfast', 'lunch'],
    description: 'Cà phê robusta rang đậm, sữa đặc, đá viên.',
    image: '/food/ca-phe-07.jpg',
  },
  {
    id: 'nuoc-ep-27',
    name: 'Nước ép cam tươi',
    price: 39_000,
    category: 'drink',
    cuisine: 'cafe',
    meals: ['breakfast', 'lunch', 'dinner'],
    description: 'Cam vắt nguyên chất, không thêm đường.',
    image: '/food/nuoc-ep-27.jpg',
  },

  // ── dessert — tag `dessert`, `crepe`, `ice_cream` ──
  {
    id: 'che-08',
    name: 'Chè khúc bạch',
    price: 32_000,
    category: 'dessert',
    cuisine: 'dessert',
    meals: ['lunch', 'dinner'],
    description: 'Khúc bạch phô mai mềm, nhãn lồng và hạnh nhân rang.',
    image: '/food/che-08.jpg',
  },
  {
    id: 'kem-28',
    name: 'Kem dừa Thái',
    price: 45_000,
    category: 'dessert',
    cuisine: 'dessert',
    meals: ['lunch', 'dinner'],
    description: 'Kem dừa trong sọ dừa tươi, lạc rang và thạch dừa.',
    image: '/food/kem-28.jpg',
  },
  {
    id: 'banh-flan-29',
    name: 'Bánh flan cà phê',
    price: 28_000,
    category: 'dessert',
    cuisine: 'dessert',
    meals: ['breakfast', 'lunch', 'dinner'],
    description: 'Flan trứng mịn, rưới cà phê đắng và caramel.',
    image: '/food/banh-flan-29.jpg',
  },

  // ── japanese — tag `japanese`, `sushi`, `ramen` ──
  {
    id: 'sushi-09',
    name: 'Sushi cá hồi 8 miếng',
    price: 145_000,
    category: 'main',
    cuisine: 'japanese',
    meals: ['lunch', 'dinner'],
    description: 'Cá hồi Na Uy phi lê, cơm giấm nắm tay, kèm wasabi.',
    image: '/food/sushi-09.jpg',
  },
  {
    id: 'ramen-10',
    name: 'Ramen tonkotsu',
    price: 120_000,
    category: 'main',
    cuisine: 'japanese',
    meals: ['lunch', 'dinner'],
    description: 'Nước hầm xương heo 10 tiếng, chashu, trứng lòng đào.',
    image: '/food/ramen-10.jpg',
  },
  {
    id: 'gyoza-11',
    name: 'Gyoza chiên 6 chiếc',
    price: 65_000,
    category: 'main',
    cuisine: 'japanese',
    meals: ['lunch', 'dinner'],
    description: 'Há cảo Nhật vỏ mỏng, nhân thịt bắp cải, áp chảo giòn đáy.',
    image: '/food/gyoza-11.jpg',
  },

  // ── korean — tag `korean`, `hàn`, `hàn_quốc`, `sochu` ──
  {
    id: 'kimbap-12',
    name: 'Kimbap bò',
    price: 70_000,
    category: 'main',
    cuisine: 'korean',
    meals: ['breakfast', 'lunch'],
    description: 'Cơm cuộn rong biển, bò xào, củ cải muối và trứng.',
    image: '/food/kimbap-12.jpg',
  },
  {
    id: 'bibimbap-13',
    name: 'Cơm trộn Bibimbap',
    price: 95_000,
    category: 'main',
    cuisine: 'korean',
    meals: ['lunch', 'dinner'],
    description: 'Cơm nóng, rau theo mùa, trứng ốp và tương ớt gochujang.',
    image: '/food/bibimbap-13.jpg',
  },
  {
    id: 'ga-ran-14',
    name: 'Gà rán sốt cay Hàn Quốc',
    price: 135_000,
    category: 'main',
    cuisine: 'korean',
    meals: ['lunch', 'dinner'],
    description: 'Gà chiên hai lần, sốt gochujang mật ong, rắc vừng.',
    image: '/food/ga-ran-14.png',
  },

  // ── grill — tag `barbecue`, `nướng`, `thịt_nướng`, `yakiniku`, `steak_house` ──
  {
    id: 'suon-nuong-15',
    name: 'Sườn nướng BBQ',
    price: 155_000,
    category: 'main',
    cuisine: 'grill',
    meals: ['dinner'],
    description: 'Sườn heo ướp mật ong nướng than, ăn kèm bắp và khoai.',
    image: '/food/suon-nuong-15.jpg',
  },
  {
    id: 'ba-chi-nuong-16',
    name: 'Ba chỉ bò nướng',
    price: 165_000,
    category: 'main',
    cuisine: 'grill',
    meals: ['dinner'],
    description: 'Ba chỉ bò Mỹ thái lát, nướng tại bàn, chấm muối ớt xanh.',
    image: '/food/ba-chi-nuong-16.jpg',
  },
  {
    id: 'bo-nuong-17',
    name: 'Bò nướng tiêu đen',
    price: 175_000,
    category: 'main',
    cuisine: 'grill',
    meals: ['lunch', 'dinner'],
    description: 'Thăn bò áp chảo sốt tiêu đen, khoai tây nghiền.',
    image: '/food/bo-nuong-17.jpg',
  },

  // ── pizza — tag `pizza`, `italian` ──
  {
    id: 'pizza-margherita-18',
    name: 'Pizza Margherita',
    price: 149_000,
    category: 'main',
    cuisine: 'pizza',
    meals: ['lunch', 'dinner'],
    description: 'Sốt cà chua San Marzano, mozzarella và húng quế tươi.',
    image: '/food/pizza-margherita-18.jpg',
  },
  {
    id: 'pizza-hai-san-19',
    name: 'Pizza hải sản',
    price: 189_000,
    category: 'main',
    cuisine: 'pizza',
    meals: ['lunch', 'dinner'],
    description: 'Tôm, mực, thanh cua trên nền phô mai kéo sợi.',
    image: '/food/pizza-hai-san-19.jpg',
  },
  {
    id: 'mi-y-20',
    name: 'Mì Ý sốt bò bằm',
    price: 125_000,
    category: 'main',
    cuisine: 'pizza',
    meals: ['lunch', 'dinner'],
    description: 'Spaghetti al dente, sốt bolognese hầm hai tiếng.',
    image: '/food/mi-y-20.jpg',
  },

  // ── american — tag `burger`, `hot_dog`, `sandwich`, `american`, `diner` ──
  {
    id: 'burger-21',
    name: 'Burger bò phô mai',
    price: 115_000,
    category: 'main',
    cuisine: 'american',
    meals: ['lunch', 'dinner'],
    description: 'Bò xay 150g nướng vỉ, cheddar tan chảy, dưa chuột muối.',
    image: '/food/burger-21.jpg',
  },
  {
    id: 'khoai-tay-22',
    name: 'Khoai tây chiên phô mai',
    price: 59_000,
    category: 'main',
    cuisine: 'american',
    meals: ['lunch', 'dinner'],
    description: 'Khoai cắt múi chiên giòn, rưới sốt phô mai nóng.',
    image: '/food/khoai-tay-22.jpg',
  },
  {
    id: 'hot-dog-23',
    name: 'Hot dog xúc xích Đức',
    price: 85_000,
    category: 'main',
    cuisine: 'american',
    meals: ['breakfast', 'lunch'],
    description: 'Xúc xích nướng, hành phi, mù tạt vàng và tương cà.',
    image: '/food/hot-dog-23.jpg',
  },

  // ── seafood — tag `seafood`, `hải_sản` ──
  {
    id: 'tom-nuong-24',
    name: 'Tôm sú nướng muối ớt',
    price: 195_000,
    category: 'main',
    cuisine: 'seafood',
    meals: ['dinner'],
    description: 'Tôm sú tươi nướng than, chấm muối ớt xanh Nha Trang.',
    image: '/food/tom-nuong-24.jpg',
  },
  {
    id: 'muc-chien-25',
    name: 'Mực chiên giòn',
    price: 145_000,
    category: 'main',
    cuisine: 'seafood',
    meals: ['lunch', 'dinner'],
    description: 'Mực ống tẩm bột chiên giòn, ăn kèm sốt mayo chanh.',
    image: '/food/muc-chien-25.jpg',
  },
  {
    id: 'lau-hai-san-26',
    name: 'Lẩu hải sản chua cay',
    price: 320_000,
    category: 'main',
    cuisine: 'seafood',
    meals: ['dinner'],
    description: 'Nước lẩu Thái chua cay, tôm mực ngao và rau ăn kèm.',
    image: '/food/lau-hai-san-26.jpg',
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

// ─────────────────────────────────────────────────────────────
// 5. Tai xe gia — luong Ride, man `finding_driver`, `driver_arriving`
// ─────────────────────────────────────────────────────────────

export interface MockDriver {
  id: string;
  name: string;
  phone: string;
  plate: string;
  /** Emoji avatar de hien thi, khong di vao event. */
  avatar: string;
}

/**
 * Danh sach tai xe mock. Dung de random khi demo chuyen tu finding_driver
 * sang driver_arriving. Cac truong di thang vao event `driver_assigned` va
 * `cancel_ride` (properties.driver_*).
 */
export const MOCK_DRIVERS: MockDriver[] = [
  {
    id: 'drv-01',
    name: 'Nguyễn Văn An',
    phone: '0901 234 567',
    plate: '30A-12345',
    avatar: '👨‍✈️',
  },
  {
    id: 'drv-02',
    name: 'Trần Văn Bình',
    phone: '0912 345 678',
    plate: '30B-23456',
    avatar: '👨‍✈️',
  },
  {
    id: 'drv-03',
    name: 'Lê Minh Châu',
    phone: '0923 456 789',
    plate: '30C-34567',
    avatar: '👩‍✈️',
  },
  {
    id: 'drv-04',
    name: 'Phạm Văn Dũng',
    phone: '0934 567 890',
    plate: '30D-45678',
    avatar: '👨‍✈️',
  },
  {
    id: 'drv-05',
    name: 'Hoàng Thị Lan',
    phone: '0945 678 901',
    plate: '30E-56789',
    avatar: '👩‍✈️',
  },
  {
    id: 'drv-06',
    name: 'Vũ Minh Nam',
    phone: '0956 789 012',
    plate: '30F-67890',
    avatar: '👨‍✈️',
  },
];

/**
 * Chon ngau nhien mot tai xe tu pool.
 */
export function getRandomDriver(): MockDriver {
  const idx = Math.floor(Math.random() * MOCK_DRIVERS.length);
  return MOCK_DRIVERS[idx]!;
}
