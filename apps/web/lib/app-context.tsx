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
import { DEFAULT_PICKUP, type CartLine, type Place } from '@gsm/shared';
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
  vehicleId?: string;
  promoId?: string | null;
  /** Ghi chu cho tai xe (man pickup_confirm). Chuoi rong = khong nhap. */
  driverNote?: string;
  /** Man ride_confirm. Mac dinh 'cash'. Chi 2 lua chon de khong chia nho mau. */
  paymentMethod?: PaymentMethod;
}

interface StoredState {
  ride: RideDraft;
  cart: CartLine[];
  offerId?: string | null;
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

  // Doc storage trong useEffect, KHONG luc render — tranh hydration mismatch.
  useEffect(() => {
    setSessionId(getSessionId());
    setUserId(getUserId());
    setRideState(newRideDraft(readJson<RideDraft>(RIDE_KEY, {})));
    setCart(readJson<CartLine[]>(CART_KEY, []));
    setOfferIdState(readJson<string | null | undefined>(OFFER_KEY, undefined));
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

  const clearCart = useCallback(() => {
    setCart([]);
    setOfferIdState(undefined);
  }, []);

  const resetAll = useCallback(() => {
    setSessionId(resetSession());
    resetPreviousScreen();
    setRideState(newRideDraft());
    setCart([]);
    setOfferIdState(undefined);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      sessionId,
      userId,
      hydrated,
      ride,
      cart,
      offerId,
      setRide,
      clearRide,
      addToCart,
      setCartQuantity,
      removeFromCart,
      setOfferId,
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
      setRide,
      clearRide,
      addToCart,
      setCartQuantity,
      removeFromCart,
      setOfferId,
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
