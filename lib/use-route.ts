'use client';

/**
 * Lay tuyen duong that qua `GET /api/route`, voi DUONG LUI bat buoc.
 *
 * KHONG BAN EVENT NAO — day la tra cuu ha tang, khong phai mot buoc funnel.
 *
 * Duong dan `/api/route` TUONG DOI, di qua proxy rewrites cua Next
 * (apps/web/next.config.ts). Goi thang localhost:4000 se thanh cross-origin.
 */

import { useEffect, useState } from 'react';
import { straightRoute, type Place, type RouteResult } from '@gsm/shared';

/**
 * Tra ve tuyen duong, hoac `null` khi chua du hai diem.
 *
 * Trong luc dang tai van tra ve duong thang tam thoi thay vi `null`: man chon
 * xe can mot con so de tinh gia ngay, va mot o gia trong roi nhay so trong nhu
 * loi. `source` cho biet day co phai con so cuoi cung chua.
 */
export function useRoute(pickup: Place | undefined, destination: Place | undefined) {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Chi phu thuoc toa do, khong phu thuoc ca object: doi nhan ma giu nguyen
  // toa do thi khong can goi lai.
  const fromKey = pickup ? `${pickup.lat},${pickup.lon}` : '';
  const toKey = destination ? `${destination.lat},${destination.lon}` : '';

  useEffect(() => {
    if (!fromKey || !toKey) {
      setRoute(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    // Duong lui dat NGAY, truoc khi fetch: neu OSRM cham hoac chet, man hinh
    // van co quang duong de tinh gia. Se bi ghi de khi tuyen that ve.
    const fallback = straightRoute(
      { lat: Number(fromKey.split(',')[0]), lon: Number(fromKey.split(',')[1]) },
      { lat: Number(toKey.split(',')[0]), lon: Number(toKey.split(',')[1]) },
    );
    setRoute(fallback);

    fetch(`/api/route?from=${encodeURIComponent(fromKey)}&to=${encodeURIComponent(toKey)}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`);
        return body as RouteResult;
      })
      .then((result) => {
        if (!cancelled) setRoute(result);
      })
      .catch(() => {
        // Giu nguyen duong lui da dat o tren. `route_source: 'straight'` se di
        // vao event, nen du lieu noi that ve viec con so den tu dau.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fromKey, toKey]);

  return { route, loading };
}

/**
 * Tuyen duong de TINH GIA o cac man sau man 2.
 *
 * Draft co the CHUA CO `route` neu nguoi dung vao thang mot URL giua luong roi F5.
 * Khi do tinh duong thang ngay tai cho thay vi de man hinh khong co gia:
 * FlowGuard da bao dam co `destination`, nen KHONG BAO GIO co trang thai
 * "khong tinh duoc gia".
 */
export function routeOrFallback(
  pickup: Place,
  destination: Place,
  route: RouteResult | undefined,
): RouteResult {
  return route ?? straightRoute(pickup, destination);
}
