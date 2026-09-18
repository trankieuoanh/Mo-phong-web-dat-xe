'use client';

/**
 * State cua app. Nguon: screen-map.md muc 3.
 * Dung React Context, KHONG them thu vien state (CLAUDE.md quy tac 7).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { DEFAULT_PICKUP, type CartLine, type Place, type RouteResult } from '@gsm/shared';
import { getSessionId, getUserId, resetSession } from './session';
import { resetPreviousScreen } from './track';

/**
 * `promoId` / `offerId` phan biet BA trang thai:
 *   undefined     = chua toi buoc do
 *   null          = da bo qua
 *   "promo-10k"   = da chon
 */
export type PaymentMethod = 'cash' | 'qr';

export interface RideDraft {
  /**
   * DIEM DEN chon o man 1. Luu ca object chu khong chi `id`:
   * dia chi tim duoc co id dang `osm-*`, KHONG tra nguoc ra ten bang
   * `getAddress()` duoc (mock-data.md muc 1), nen nhan phai di theo state.
   */
  destination?: Place;
  /** DIEM DON, mac dinh DEFAULT_PICKUP. Doi duoc o man 2. */
  pickup?: Place;
  /**
   * Tuyen duong giua pickup va destination — lay MOT LAN o man 2, dung lai o
   * man 3 va man 5.
   *
   * Vi sao khong fetch lai o tung man: gia hien o man chon xe va gia ghi vao
   * `confirm_ride` BAT BUOC la cung mot con so. Hai lan fetch co the ra hai
   * quang duong hoi khac nhau, va khi do bao cao phan tich khong khop anh chup
   * man hinh — dung cai ma pricing.ts da duoc tach ra de tranh.
   */
  route?: RouteResult;
  vehicleId?: string;
  promoId?: string | null;
  /** Ghi chu cho tai xe (man pickup_confirm). Chuoi rong = khong nhap. */
  driverNote?: string;
  /** Man ride_confirm. Mac dinh 'cash'. Chi 2 lua chon de khong chia nho mau. */
  paymentMethod?: PaymentMethod;
}

/**
 * Phan cua luong food PHAI song qua dieu huong. Xem food-flow-design.md muc 5.
 *
 * Co y KHONG chua bo loc cua man menu (o tim, chip bua, chip loai mon):
 * screen-map.md muc 3 chot rang chung bi quen khi roi man, va thu can giu lai
 * thi da nam trong event (`discovery_source`). Chi hai thu len day:
 *
 *   - `origin`: dia chi giao. Man confirm phai noi duoc giao toi dau.
 *   - `restaurantId` / `restaurantName`: quan dang xem. Truoc day day la state
 *     cuc bo cua app/food/page.tsx nen MAT ngay khi mo mot mon — do la ly do man
 *     chi tiet mon va man confirm khong hien noi ten quan.
 */
export interface FoodDraft {
  origin?: Place;
  restaurantId?: string;
  restaurantName?: string;
}

interface StoredState {
  ride: RideDraft;
  cart: CartLine[];
  offerId?: string | null;
  food: FoodDraft;
}

interface AppContextValue extends StoredState {
  sessionId: string;
  userId: string;
  /** true sau khi da doc xong storage — guard phai doi co nay truoc khi redirect. */
  hydrated: boolean;

  setRide: (patch: Partial<RideDraft>) => void;
  clearRide: () => void;

  addToCart: (itemId: string, quantity: number) => void;
  setCartQuantity: (itemId: string, quantity: number) => void;
  removeFromCart: (itemId: string) => void;
  setOfferId: (offerId: string | null) => void;
  setFood: (patch: Partial<FoodDraft>) => void;
  clearCart: () => void;

  /** Bam "Ve trang chu" o man success: session moi + xoa sach draft. */
  resetAll: () => void;
}

/**
 * `_v2` vi hinh dang RideDraft da doi (`addressId: string` -> `destination: Place`).
 * `readJson` co try/catch nhung KHONG kiem tra hinh dang, nen mot draft cu con
 * trong tab cua nguoi dung se tra ve {addressId: '...'} va lam man confirm no
 * o `ride.destination.label`. Doi khoa la cach re nhat de bo draft cu di.
 * Phai khop DRAFT_KEYS trong lib/session.ts.
 */
const RIDE_KEY = 'gsm_ride_draft_v2';
const CART_KEY = 'gsm_cart';
const OFFER_KEY = 'gsm_offer';
/** Phai khop DRAFT_KEYS trong lib/session.ts, neu khong reset se bo sot. */
const FOOD_KEY = 'gsm_food_draft';

const AppContext = createContext<AppContextValue | null>(null);

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage day hoac bi chan — khong lam vo luong UI.
  }
}

/**
 * Draft ride luon co `pickup`. Goi o MOI cho dat lai draft (khoi tao, doc
 * storage, clearRide, resetAll) — de khong man nao phai viet
 * `ride.pickup ?? DEFAULT_PICKUP` va khong cho nao quen mat.
 */
function newRideDraft(base: RideDraft = {}): RideDraft {
  return { pickup: DEFAULT_PICKUP, ...base };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState('');
  const [userId, setUserId] = useState('');
  const [hydrated, setHydrated] = useState(false);

  const [ride, setRideState] = useState<RideDraft>(newRideDraft());
  const [cart, setCart] = useState<CartLine[]>([]);
  const [offerId, setOfferIdState] = useState<string | null | undefined>(undefined);
  const [food, setFoodState] = useState<FoodDraft>({});

  // Doc storage trong useEffect, KHONG luc render — tranh hydration mismatch.
  useEffect(() => {
    setSessionId(getSessionId());
    setUserId(getUserId());
    setRideState(newRideDraft(readJson<RideDraft>(RIDE_KEY, {})));
    setCart(readJson<CartLine[]>(CART_KEY, []));
    setOfferIdState(readJson<string | null | undefined>(OFFER_KEY, undefined));
    setFoodState(readJson<FoodDraft>(FOOD_KEY, {}));
    setHydrated(true);
  }, []);

  // Ghi kem sessionStorage de F5 giua luong khong mat lua chon.
  useEffect(() => {
    if (hydrated) writeJson(RIDE_KEY, ride);
  }, [ride, hydrated]);

  useEffect(() => {
    if (hydrated) writeJson(CART_KEY, cart);
  }, [cart, hydrated]);

  useEffect(() => {
    if (hydrated) writeJson(OFFER_KEY, offerId);
  }, [offerId, hydrated]);

  useEffect(() => {
    if (hydrated) writeJson(FOOD_KEY, food);
  }, [food, hydrated]);

  const setRide = useCallback((patch: Partial<RideDraft>) => {
    setRideState((prev) => ({ ...prev, ...patch }));
  }, []);

  const clearRide = useCallback(() => setRideState(newRideDraft()), []);

  const addToCart = useCallback((itemId: string, quantity: number) => {
    setCart((prev) => {
      const existing = prev.find((line) => line.itemId === itemId);
      if (existing) {
        return prev.map((line) =>
          line.itemId === itemId ? { ...line, quantity: line.quantity + quantity } : line,
        );
      }
      return [...prev, { itemId, quantity }];
    });
  }, []);

  const setCartQuantity = useCallback((itemId: string, quantity: number) => {
    setCart((prev) =>
      quantity <= 0
        ? prev.filter((line) => line.itemId !== itemId)
        : prev.map((line) => (line.itemId === itemId ? { ...line, quantity } : line)),
    );
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setCart((prev) => prev.filter((line) => line.itemId !== itemId));
  }, []);

  const setOfferId = useCallback((value: string | null) => setOfferIdState(value), []);

  const setFood = useCallback((patch: Partial<FoodDraft>) => {
    setFoodState((prev) => ({ ...prev, ...patch }));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setOfferIdState(undefined);
    // Quan da chon di theo gio hang: gio rong thi "mon tai X" khong con nghia gi.
    // `origin` cung xoa — phien sau se hoi lai GPS.
    setFoodState({});
  }, []);

  const resetAll = useCallback(() => {
    setSessionId(resetSession());
    resetPreviousScreen();
    setRideState(newRideDraft());
    setCart([]);
    setOfferIdState(undefined);
    setFoodState({});
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      sessionId,
      userId,
      hydrated,
      ride,
      cart,
      offerId,
      food,
      setRide,
      clearRide,
      addToCart,
      setCartQuantity,
      removeFromCart,
      setOfferId,
      setFood,
      clearCart,
      resetAll,
    }),
    [
      sessionId,
      userId,
      hydrated,
      ride,
      cart,
      offerId,
      food,
      setRide,
      clearRide,
      addToCart,
      setCartQuantity,
      removeFromCart,
      setOfferId,
      setFood,
      clearCart,
      resetAll,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp phai duoc goi ben trong <AppProvider>');
  return ctx;
}
