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
import { SHIPPING_FEE, type DiscountRule, type FoodItem } from './mock-data';

/**
 * So tien giam thuc te (VND). Dung chung cho ca Promo (Ride) va Offer (Food).
 * Tra 0 khi chua du dieu kien — UI van hien thi lua chon do nhung disable,
 * va KHONG ghi event cho lua chon bi disable (mock-data.md muc 3).
 */
export function calcDiscount(rule: DiscountRule, subtotal: number): number {
  if (subtotal < rule.minOrder) return 0;
  if (rule.type === 'fixed') return Math.min(rule.value, subtotal);
  const raw = Math.floor((subtotal * rule.value) / 100);
  return rule.maxDiscount ? Math.min(raw, rule.maxDiscount) : raw;
}

/** `rule` = null nghia la nguoi dung da bo qua buoc khuyen mai. */
export function isRuleAvailable(rule: DiscountRule, subtotal: number): boolean {
  return subtotal >= rule.minOrder;
}

// ─────────────────────────────────────────────────────────────
// Ride — mock-data.md muc 6
// ─────────────────────────────────────────────────────────────

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

  const discountAmount = offer ? calcDiscount(offer, cartTotal) : 0;

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
