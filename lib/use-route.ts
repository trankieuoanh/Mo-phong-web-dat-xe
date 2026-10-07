'use client';

/**
 * Lay tuyen duong THAT (OSRM) qua `GET /api/route`, dung chung cho dat xe va giao do an.
 *
 * KHONG BAN EVENT NAO — day la tra cuu ha tang, khong phai mot buoc funnel.
 *
 * QUY TAC CUA FILE NAY: `route` chi bao gio la tuyen OSRM that, hoac `null`. KHONG co duong lui
 * "noi thang hai diem" nua. Ban truoc dat duong thang NGAY truoc khi fetch (de man hinh luon co
 * mot con so) va giu nguyen khi OSRM loi, nen nguoi dung nhin thay mot duong thang trong khi
 * tuong do la lo trinh — va con so do con bi luu vao draft, di vao gia va vao event
 * (`route_source: 'straight'`). Gio chua co tuyen that thi `status` la 'loading' / 'error' va noi
 * nao can tuyen thi phai cho/hien loi (xem app/ride/pickup/page.tsx).
 *
 * `/api/route` la route handler cua chinh app nay (app/api/route/route.ts).
 */

import { useCallback, useEffect, useState } from 'react';
import type { LatLon, RouteResult } from '@/lib/shared';

export type RouteStatus = 'idle' | 'loading' | 'success' | 'error';

export interface RouteState {
  /** Tuyen OSRM that, hoac `null` (chua co hai diem / dang tai / loi). */
  route: RouteResult | null;
  status: RouteStatus;
  /** Goi lai sau khi that bai. Khong lam gi neu khong o trang thai 'error'. */
  retry: () => void;
}

/** Doi nguoi dung ngung bam bao nhieu ms truoc khi hoi OSRM (doi diem lien tuc tren ban do). */
const DEBOUNCE_MS = 250;
/** Ban do xuat hien o nhieu man; cache o cap MODULE de doi man khong phai hoi lai. */
const CACHE_MAX = 50;
const cache = new Map<string, RouteResult>();

/** 5 chu so thap phan ≈ 1 m: hai lan bam cung mot dia chi phai trung khoa. */
function keyOf(point: LatLon | undefined): string {
  return point ? `${point.lat.toFixed(5)},${point.lon.toFixed(5)}` : '';
}

function remember(key: string, route: RouteResult): void {
  cache.delete(key);
  cache.set(key, route);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
}

async function fetchRoute(from: string, to: string, signal: AbortSignal): Promise<RouteResult> {
  const response = await fetch(`/api/route?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
    signal,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`);
  const route = body as RouteResult;
  // Phong ve: server da tu choi tuyen < 2 diem, nhung FE khong duoc tin vao do de ve duong thang gia.
  if (!Array.isArray(route?.geometry) || route.geometry.length < 2) throw new Error('tuyen rong');
  return route;
}

export function useRoute(origin: LatLon | undefined, destination: LatLon | undefined): RouteState {
  const fromKey = keyOf(origin);
  const toKey = keyOf(destination);
  const pairKey = fromKey && toKey ? `${fromKey}->${toKey}` : '';

  // Khoi tao tu cache: quay lai mot man da co tuyen thi KHONG nhay qua trang thai 'loading'.
  const [state, setState] = useState<{ pairKey: string; route: RouteResult | null; status: RouteStatus }>(() => {
    const hit = pairKey ? cache.get(pairKey) : undefined;
    return hit ? { pairKey, route: hit, status: 'success' } : { pairKey, route: null, status: pairKey ? 'loading' : 'idle' };
  });
  /** Tang len de buoc effect chay lai (nut "Thu lai"). */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!pairKey) {
      setState({ pairKey: '', route: null, status: 'idle' });
      return;
    }

    const hit = cache.get(pairKey);
    if (hit) {
      setState({ pairKey, route: hit, status: 'success' });
      return;
    }

    // Doi diem -> tuyen cu bien mat NGAY (khong de tuyen cua cap diem truoc nam tren ban do).
    setState({ pairKey, route: null, status: 'loading' });

    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchRoute(fromKey, toKey, controller.signal)
        .then((route) => {
          remember(pairKey, route);
          setState({ pairKey, route, status: 'success' });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return; // request cu bi huy vi da doi diem — khong phai loi
          // Chi tiet ky thuat cho nguoi phat trien; nguoi dung chi thay thong bao chung.
          console.warn('[useRoute] khong lay duoc tuyen duong:', error instanceof Error ? error.message : error);
          setState({ pairKey, route: null, status: 'error' });
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [pairKey, fromKey, toKey, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // `state` co the cu mot nhip (render dau sau khi doi diem, truoc khi effect chay): chi tin neu khop.
  if (state.pairKey !== pairKey) {
    return { route: null, status: pairKey ? 'loading' : 'idle', retry };
  }
  return { route: state.status === 'success' ? state.route : null, status: state.status, retry };
}
