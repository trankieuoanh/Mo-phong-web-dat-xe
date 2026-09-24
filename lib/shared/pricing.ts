/**
 * Logic tinh tien. Nguon: mock-data.md muc 3 (calcDiscount) va muc 6 (tong tien).
 *
 * Tach khoi mock-data.ts co chu y: man `confirm` hien thi so tien, va event
 * `confirm_ride` / `place_order` ghi so tien. Hai cho do BAT BUOC ra cung mot
 * con so — neu moi cho tu tinh thi bao cao phan tich se khong khop voi anh chup
 * man hinh, va khong con cach nao biet ben nao dung.
 *
 * Moi gia tri deu la SO NGUYEN VND. Math.floor khi tinh phan tram de khong sinh so le.
 */
import {
  SHIPPING_FEE,
  type DiscountRule,
  type FoodItem,
  type Vehicle,
  type VehicleType,
} from './mock-data';

/**
 * So tien giam thuc te (VND). Dung chung cho ca Promo (Ride) va Offer (Food).
 * Tra 0 khi chua du dieu kien — UI van hien thi lua chon do nhung disable,
 * va KHONG ghi event cho lua chon bi disable (mock-data.md muc 3).
 *
 * `shippingFee` chi can khi luat co `appliesTo: 'shipping'`; luong Ride bo qua
 * duoc, nen moi loi goi cu van bien dich nguyen trang.
 *
 * HAM NAY CO Y KHONG BIET GI ve `vehicleTypes` / `minDistanceKm` / `activeHours`.
 * Do la mot rang buoc, khong phai mot thieu sot:
 *
 *   Ham nay chay o BA cho cho cung mot chuyen — man chon uu dai, man xac nhan,
 *   va luc ghi `confirm_ride` / `place_order` — va ca ba BAT BUOC ra cung mot
 *   con so (xem dau file). Neu no xet ca gio vang, thi nguoi chon ma luc 12:59
 *   roi bam xac nhan luc 13:01 se thay gia nhay, va `discount_amount` trong
 *   event lech han so hien tren man hinh.
 *
 *   Bon dieu kien do gac QUYEN DUNG, va chi duoc xet mot lan — o `ruleBlock()`,
 *   ngay truoc khi nguoi dung chon. Chon roi thi uu dai thuoc ve ho.
 */
export function calcDiscount(rule: DiscountRule, subtotal: number, shippingFee = 0): number {
  // `minOrder` LUON xet tren subtotal, ke ca voi luat giam phi giao: "don toi
  // thieu" noi ve don hang chu khong noi ve phi giao.
  if (subtotal < rule.minOrder) return 0;

  const base = rule.appliesTo === 'shipping' ? shippingFee : subtotal;

  if (rule.type === 'fixed') return Math.min(rule.value, base);
  const raw = Math.floor((base * rule.value) / 100);
  return rule.maxDiscount ? Math.min(raw, rule.maxDiscount) : raw;
}

/**
 * Nhung gi man chon uu dai biet ve boi canh, de xet cac dieu kien linh hoat.
 *
 * Moi truong deu optional vi hai luong biet nhung thu khac nhau: luong Food
 * khong co hang xe lan quang duong.
 */
export interface RuleContext {
  vehicleType?: VehicleType;
  distanceKm?: number;
  /**
   * Gio dia phuong 0-23.
   *
   * `undefined` = CHUA BIET, va khi do luat co `activeHours` bi coi la chua du
   * dieu kien. Day khong phai truong hop hiem ma la LUOT RENDER DAU TIEN:
   * nguoi goi bat buoc phai doc gio trong `useEffect` chu khong phai luc render
   * (Next prerender client component o server, gio server UTC lech gio may
   * UTC+7 — dung cai bay hydration ghi o dau lib/session.ts va o mealOfHour()).
   *
   * Nho quy uoc nay, server va luot hydrate dau tien cho ra CUNG MOT HTML:
   * ca hai deu ve ma gio vang o trang thai khoa.
   */
  hour?: number;
}

/**
 * Ly do mot luat bi khoa — DU LIEU, khong phai cau chu.
 *
 * `lib/shared` khong duoc biet toi `formatVnd` (no song o lib/format.ts), va
 * de moi man tu dung cau giai thich thi hai luong se lech nhau. Viec doi sang
 * tieng Viet nam o `formatRuleBlock()` trong lib/format.ts.
 */
export type RuleBlock =
  | { kind: 'vehicle'; vehicleTypes: VehicleType[] }
  | { kind: 'distance'; minDistanceKm: number }
  | { kind: 'hours'; from: number; to: number }
  | { kind: 'min_order'; minOrder: number };

/**
 * Gio `hour` co nam trong cua so nua mo [from, to) khong.
 *
 * `from > to` = cua so vat qua nua dem: (21, 2) chua 21h, 23h, 0h, 1h — nhung
 * khong chua 2h. Viet rieng vi phep so sanh thang `from <= h && h < to` tra ve
 * false cho MOI gio khi cua so vat qua nua dem, tuc ma an khuya khong bao gio
 * dung duoc.
 */
export function isHourInWindow(hour: number, from: number, to: number): boolean {
  return from <= to ? hour >= from && hour < to : hour >= from || hour < to;
}

/**
 * `null` = luat dung duoc. Nguoc lai tra ve dieu kien DAU TIEN chua thoa.
 *
 * Thu tu xet la cu the -> chung chung co chu y: voi nguoi dang chon o to ma
 * nhin ma GSMBIKE, "Chi ap dung cho xe may" noi dung van de, con "Can don toi
 * thieu" thi khong noi gi ca.
 */
export function ruleBlock(
  rule: DiscountRule,
  subtotal: number,
  ctx: RuleContext = {},
): RuleBlock | null {
  if (rule.vehicleTypes && (!ctx.vehicleType || !rule.vehicleTypes.includes(ctx.vehicleType))) {
    return { kind: 'vehicle', vehicleTypes: rule.vehicleTypes };
  }

  if (rule.minDistanceKm !== undefined && (ctx.distanceKm ?? 0) < rule.minDistanceKm) {
    return { kind: 'distance', minDistanceKm: rule.minDistanceKm };
  }

  if (rule.activeHours) {
    const { from, to } = rule.activeHours;
    // `hour === undefined` (chua biet) coi nhu ngoai gio — xem RuleContext.hour.
    if (ctx.hour === undefined || !isHourInWindow(ctx.hour, from, to)) {
      return { kind: 'hours', from, to };
    }
  }

  if (subtotal < rule.minOrder) return { kind: 'min_order', minOrder: rule.minOrder };

  return null;
}

/** `rule` = null nghia la nguoi dung da bo qua buoc khuyen mai. */
export function isRuleAvailable(
  rule: DiscountRule,
  subtotal: number,
  ctx: RuleContext = {},
): boolean {
  return ruleBlock(rule, subtotal, ctx) === null;
}

// ─────────────────────────────────────────────────────────────
// Ride — mock-data.md muc 6
// ─────────────────────────────────────────────────────────────

/** Gia mo cua da bao gom hai km dau. */
export const INCLUDED_KM = 2;

/**
 * Gia chuyen xe theo QUANG DUONG THAT.
 *
 * Truoc day gia la hang so `Vehicle.basePrice`; gio no la ham cua
 * (hang xe, quang duong). Hai cho BAT BUOC goi ham nay chu khong tu tinh:
 * man `vehicle_selection` (hien gia) va event `confirm_ride` (ghi gia) —
 * neu moi cho tu tinh thi bao cao phan tich se khong khop anh chup man hinh.
 *
 * Lam tron toi 1.000d: tien le toi hang don vi trong nhu loi chu khong nhu gia.
 *
 * He so trong VEHICLES duoc chon de mot chuyen 15 km ra dung con so `basePrice`
 * cu — xem ghi chu o mock-data.ts.
 */
export function calcFare(vehicle: Vehicle, distanceKm: number): number {
  const extra = Math.max(0, distanceKm - INCLUDED_KM);
  return Math.round((vehicle.openingFare + extra * vehicle.pricePerKm) / 1000) * 1000;
}

export interface RideTotals {
  basePrice: number;
  discountAmount: number;
  finalPrice: number;
}

export function calcRideTotals(basePrice: number, promo: DiscountRule | null): RideTotals {
  const discountAmount = promo ? calcDiscount(promo, basePrice) : 0;
  return { basePrice, discountAmount, finalPrice: basePrice - discountAmount };
}

// ─────────────────────────────────────────────────────────────
// Food — mock-data.md muc 6
// ─────────────────────────────────────────────────────────────

/** Gio hang luu itemId + quantity, KHONG luu price/name — xem screen-map.md muc 3. */
export interface CartLine {
  itemId: string;
  quantity: number;
}

export interface FoodTotals {
  /** Tong SO LUONG mon (khong phai so dong). */
  itemCount: number;
  /** Tong tien hang, CHUA gom phi giao va uu dai. */
  cartTotal: number;
  shippingFee: number;
  discountAmount: number;
  finalTotal: number;
}

/**
 * `resolveItem` tra ve FoodItem tu id — truyen `getFoodItem` tu mock-data vao.
 * Dong nao khong tra cuu duoc thi bo qua (gio hang cu, id da doi).
 */
export function calcFoodTotals(
  lines: CartLine[],
  offer: DiscountRule | null,
  resolveItem: (id: string) => FoodItem | undefined,
): FoodTotals {
  let itemCount = 0;
  let cartTotal = 0;

  for (const line of lines) {
    const item = resolveItem(line.itemId);
    if (!item) continue;
    itemCount += line.quantity;
    cartTotal += item.price * line.quantity;
  }

  // SHIPPING_FEE di kem xuong duoi: mot uu dai `appliesTo: 'shipping'` tinh
  // tien giam tren phi giao chu khong tren tien hang.
  const discountAmount = offer ? calcDiscount(offer, cartTotal, SHIPPING_FEE) : 0;

  return {
    itemCount,
    cartTotal,
    shippingFee: SHIPPING_FEE,
    discountAmount,
    finalTotal: cartTotal + SHIPPING_FEE - discountAmount,
  };
}

/** Tong so luong mon trong gio — dung cho `cart_size_after`. */
export function cartSize(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}
