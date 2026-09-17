/**
 * Logic tim mon o man `food_menu` — ba ham thuan, khong state, khong I/O.
 *
 * Tach khoi mock-data.ts co chu y: mock-data.ts la DU LIEU, file nay la QUY TAC.
 * Ca ba ham deu phai tat dinh: cung dau vao ra cung dau ra, o moi phien va moi
 * may. Id nha hang di thang vao `properties` cua `select_restaurant`, nen mot
 * ham bam khong on dinh se lam du lieu tuan nay khong ghep duoc voi tuan sau
 * (CLAUDE.md quy tac 5).
 */
import { FOOD_ITEMS, type FoodItem, type Meal } from './mock-data';

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
// 3. Thuc don cua mot nha hang that
// ─────────────────────────────────────────────────────────────

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
 * Thuc don cua mot nha hang THAT (id `osm-*` tu GET /api/restaurants).
 *
 * Nha hang la that, mon an la mock — day la app mo phong, khong co menu that de
 * lay. Phep gan phai TAT DINH: cung mot quan luon ra cung mot thuc don, ke ca
 * sau khi F5 hay o mot may khac. Neu no ngau nhien, `select_restaurant` va
 * `add_to_cart` trong cung mot phien se ke hai cau chuyen khac nhau.
 *
 * Luon co it nhat MOT mon `main`: mot "nha hang" chi ban tra sua va che thi
 * trong nhu loi du lieu chu khong nhu mot quan an.
 */
export function menuOf(restaurantId: string, size = 3): FoodItem[] {
  const offset = hashId(restaurantId) % FOOD_ITEMS.length;
  // Xoay danh sach theo gia tri bam — moi quan bat dau tu mot cho khac nhau.
  // Dung `slice` chu khong truy cap theo chi so: tsconfig bat
  // `noUncheckedIndexedAccess`, nen FOOD_ITEMS[i] la `FoodItem | undefined`.
  const rotated = [...FOOD_ITEMS.slice(offset), ...FOOD_ITEMS.slice(0, offset)];

  const firstMain = rotated.find((item) => item.category === 'main');
  // FOOD_ITEMS luon co mon `main`, nhung khong ep kieu `!` de neu mot ngay nao
  // do menu chi con do uong thi ham van chay thay vi no.
  if (!firstMain) return rotated.slice(0, size);

  const others = rotated.filter((item) => item.id !== firstMain.id).slice(0, size - 1);
  return [firstMain, ...others];
}

// ─────────────────────────────────────────────────────────────
// 4. Nguon kham pha — di vao properties.discovery_source
// ─────────────────────────────────────────────────────────────

/**
 * Bo loc dang bat luc nguoi dung bam mot mon. Khoa noi giua "bam bo loc nao"
 * va "co them vao gio khong" — xem event-taxonomy.md muc 4.
 */
export type DiscoverySource = 'all' | 'category' | 'search' | 'restaurant' | 'meal';
