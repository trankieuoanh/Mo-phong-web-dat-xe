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
import type { CartLine } from '@gsm/shared';
import { getSessionId, getUserId, resetSession } from './session';
import { resetPreviousScreen } from './track';

/**
 * `promoId` / `offerId` phan biet BA trang thai:
 *   undefined     = chua toi buoc do
 *   null          = da bo qua
 *   "promo-10k"   = da chon
 */
export interface RideDraft {
  addressId?: string;
  vehicleId?: string;
  promoId?: string | null;
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

const RIDE_KEY = 'gsm_ride_draft';
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

export function AppProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState('');
  const [userId, setUserId] = useState('');
  const [hydrated, setHydrated] = useState(false);

  const [ride, setRideState] = useState<RideDraft>({});
  const [cart, setCart] = useState<CartLine[]>([]);
  const [offerId, setOfferIdState] = useState<string | null | undefined>(undefined);

  // Doc storage trong useEffect, KHONG luc render — tranh hydration mismatch.
  useEffect(() => {
    setSessionId(getSessionId());
    setUserId(getUserId());
    setRideState(readJson<RideDraft>(RIDE_KEY, {}));
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

  const clearRide = useCallback(() => setRideState({}), []);

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
    setRideState({});
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
