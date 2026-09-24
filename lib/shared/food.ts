/**
 * Logic tim mon o man `food_menu` — ba ham thuan, khong state, khong I/O.
 *
 * Tach khoi mock-data.ts co chu y: mock-data.ts la DU LIEU, file nay la QUY TAC.
 * Ca ba ham deu phai tat dinh: cung dau vao ra cung dau ra, o moi phien va moi
 * may. Id nha hang di thang vao `properties` cua `select_restaurant`, nen mot
 * ham bam khong on dinh se lam du lieu tuan nay khong ghep duoc voi tuan sau
 * (CLAUDE.md quy tac 5).
 */
import { FOOD_ITEMS, type Cuisine, type FoodItem, type Meal } from './mock-data';
import type { Restaurant } from './places';

// ─────────────────────────────────────────────────────────────
// 1. Bo dau tieng Viet — de "pho" khop "Phở"
// ─────────────────────────────────────────────────────────────

/**
 * Chuan hoa chuoi de so sanh khong dau, khong phan biet hoa thuong.
 *
 * NFD tach nguyen am ra khoi dau thanh, nen `̀-ͯ` quet sach dau.
 * NHUNG `đ` la mot ky tu rieng trong Unicode, KHONG bi NFD tach — thieu hai
 * dong replace duoi thi go "duong den" se khong ra "đường đen", va loi do chi
 * lo ra voi dung nhung tu co chu d gach ngang.
 */
export function normalizeVi(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

// ─────────────────────────────────────────────────────────────
// 2. Gio -> bua an
// ─────────────────────────────────────────────────────────────

/**
 * Gio trong ngay (0-23) -> bua an, theo nhip sinh hoat o Viet Nam:
 * 4h-10h sang, 10h-16h trua, con lai (16h-4h) toi.
 *
 * NGUOI GOI phai doc gio trong `useEffect`, KHONG doc luc render: Next van
 * prerender client component o server, ma gio server (UTC) lech gio may
 * (UTC+7) — day dung la bay hydration mismatch ghi o dau lib/session.ts.
 */
export function mealOfHour(hour: number): Meal {
  if (hour >= 4 && hour < 10) return 'breakfast';
  if (hour >= 10 && hour < 16) return 'lunch';
  return 'dinner';
}

export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Bữa sáng',
  lunch: 'Bữa trưa',
  dinner: 'Bữa tối',
};

export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner'];

// ─────────────────────────────────────────────────────────────
// 3. Thuc don cua mot nha hang THAT, suy tu tag `cuisine` THAT
// ─────────────────────────────────────────────────────────────

/**
 * Quy doi gia tri tho cua tag `cuisine` tren OpenStreetMap -> kieu bep cua ta.
 *
 * Bang nay duoc dung tu MAU THAT: 120 quan an o Ha Noi, 60 quan co tag
 * `cuisine`. Moi khoa duoi day la mot gia tri that sy xuat hien trong mau do,
 * chu khong phai doan.
 *
 * Ba dieu bat ngo tu du lieu that, va deu phai xu ly:
 *   1. Mot quan co NHIEU gia tri ngan cach bang `;`
 *      (vi du "asian;oriental;vietnamese", "thit_nuong;grill;yakiniku;barbecue").
 *   2. Co tag TIENG VIET co dau: `phở`, `nướng`, `hàn_quốc`, `hải_sản`.
 *      Vi vay phai `normalizeVi` truoc khi tra bang — khoa o day de khong dau.
 *   3. `regional` (6 lan, nhieu thu hai) trong ngu canh Viet Nam nghia la mon
 *      dia phuong, nen quy ve `vietnamese`.
 */
const CUISINE_ALIASES: Record<string, Cuisine> = {
  // vietnamese — 28/60 trong mau, ap dao
  vietnamese: 'vietnamese',
  regional: 'vietnamese',
  noodle: 'vietnamese',
  pho: 'vietnamese',
  bun: 'vietnamese',
  com: 'vietnamese',
  goi_mon: 'vietnamese',
  banh_mi: 'vietnamese',

  japanese: 'japanese',
  sushi: 'japanese',
  ramen: 'japanese',

  korean: 'korean',
  han: 'korean',
  han_quoc: 'korean',
  sochu: 'korean',

  barbecue: 'grill',
  bbq: 'grill',
  grill: 'grill',
  nuong: 'grill',
  thit_nuong: 'grill',
  yakiniku: 'grill',
  steak_house: 'grill',
  steak: 'grill',

  pizza: 'pizza',
  italian: 'pizza',
  pasta: 'pizza',

  burger: 'american',
  american: 'american',
  hot_dog: 'american',
  sandwich: 'american',
  diner: 'american',
  deli: 'american',
  bagel: 'american',

  seafood: 'seafood',
  hai_san: 'seafood',
  fish: 'seafood',

  cafe: 'cafe',
  coffee: 'cafe',
  coffee_shop: 'cafe',
  bubble_tea: 'cafe',
  juice: 'cafe',
  tea: 'cafe',

  dessert: 'dessert',
  crepe: 'dessert',
  ice_cream: 'dessert',
  cake: 'dessert',
};

export const CUISINE_LABELS: Record<Cuisine, string> = {
  vietnamese: 'Món Việt',
  japanese: 'Món Nhật',
  korean: 'Món Hàn',
  grill: 'Đồ nướng',
  pizza: 'Pizza & mì Ý',
  american: 'Đồ Âu Mỹ',
  seafood: 'Hải sản',
  cafe: 'Cà phê & đồ uống',
  dessert: 'Tráng miệng',
};

/**
 * Doc tag `cuisine` tho -> danh sach kieu bep cua ta, bo trung, bo cai khong
 * nhan ra. Tra mang RONG khi quan khong khai bao gi — nua so quan that roi vao
 * truong hop nay, nen day la duong di binh thuong chu khong phai ngoai le.
 */
export function cuisinesOf(rawTags: string[]): Cuisine[] {
  const found: Cuisine[] = [];
  for (const raw of rawTags) {
    // `normalizeVi` xu ly tag tieng Viet co dau; `_` giu nguyen vi khoa o bang
    // tren cung dung `_` (OSM noi tu bang dau gach duoi).
    const key = normalizeVi(raw).replace(/\s+/g, '_');
    const hit = CUISINE_ALIASES[key];
    if (hit && !found.includes(hit)) found.push(hit);
  }
  return found;
}

/**
 * FNV-1a 32-bit. Tu viet vi CLAUDE.md quy tac 8 chot danh sach thu vien, va mot
 * ham bam 6 dong thi khong dang mot dependency.
 *
 * `Math.imul` chu khong phai `*`: nhan so 32-bit bang toan tu `*` cua JS se
 * tran qua 53-bit cua double va mat bit thap, tuc ham bam ra ket qua khac nhau
 * giua cac gia tri le ra phai khac nhau.
 */
function hashId(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Thuc don cua mot quan THAT.
 *
 * Mon duoc chon theo tag `cuisine` THAT cua quan — mot quan `japanese` ra sushi
 * va ramen, mot quan `barbecue` ra do nuong. Truoc day moi quan deu boc tu cung
 * mot ro 8 mon Viet, nen mot quan Nhat van hien ra banh mi.
 *
 * MOT NUA so quan that khong khai bao `cuisine` (do trong mau 120 quan Ha Noi).
 * Khi do lui ve mon Viet — kieu bep ap dao trong mau — thay vi tra ve rong:
 * mot quan khong co mon nao la mot ngo cut trong luong, con mot quan co thuc
 * don Viet thi van di tiep duoc.
 *
 * Trong moi nhom, VI TRI bat dau van bam tu `id` de hai quan cung kieu bep
 * khong ra y het nhau, va de cung mot quan luon ra cung thuc don o moi phien.
 */
export function menuOf(restaurant: Pick<Restaurant, 'id' | 'cuisine'>, size = 3): FoodItem[] {
  const kinds = cuisinesOf(restaurant.cuisine);
  const pool = kinds.length
    ? FOOD_ITEMS.filter((item) => kinds.includes(item.cuisine))
    : FOOD_ITEMS.filter((item) => item.cuisine === 'vietnamese');

  if (pool.length === 0) return [];

  const offset = hashId(restaurant.id) % pool.length;
  // `slice` chu khong truy cap theo chi so: tsconfig bat
  // `noUncheckedIndexedAccess`, nen pool[i] la `FoodItem | undefined`.
  const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];
  return rotated.slice(0, size);
}

// ─────────────────────────────────────────────────────────────
// 4. Nguon kham pha — di vao properties.discovery_source
// ─────────────────────────────────────────────────────────────

/**
 * Bo loc dang bat luc nguoi dung bam mot mon. Khoa noi giua "bam bo loc nao"
 * va "co them vao gio khong" — xem event-taxonomy.md muc 4.
 */
export type DiscoverySource = 'all' | 'category' | 'search' | 'restaurant' | 'meal';
