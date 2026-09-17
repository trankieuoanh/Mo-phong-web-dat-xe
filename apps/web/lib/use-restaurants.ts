'use client';

/**
 * Nha hang that quanh mot toa do, qua `GET /api/restaurants`.
 *
 * KHONG BAN EVENT NAO — day la tra cuu ha tang. Event chi bat khi nguoi dung
 * BAM mot quan (`select_restaurant` o app/food/page.tsx).
 *
 * Duong dan TUONG DOI, di qua proxy rewrites cua Next — goi thang localhost:4000
 * se thanh cross-origin (cung ly do da ghi o use-place-search.ts).
 *
 * Khac use-place-search.ts dung hai diem:
 *   1. KHONG debounce — toa do khong do nguoi dung go, chi goi mot lan khi mount.
 *   2. Co SAP LAI theo khoang cach: Nominatim xep theo "importance", nen quan
 *      gan nhat khong he nam dau danh sach no tra ve.
 */

import { useEffect, useState } from 'react';
import { haversineKm, type Place } from '@gsm/shared';

export type RestaurantStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface RestaurantState {
  /** Da sap theo khoang cach tang dan tu `origin`. */
  restaurants: Place[];
  status: RestaurantStatus;
  /** Thong bao doc duoc cho nguoi dung khi status === 'error'. */
  error: string;
}

export function useRestaurants(origin: Place | undefined): RestaurantState {
  const [state, setState] = useState<RestaurantState>({
    restaurants: [],
    status: 'idle',
    error: '',
  });

  // Chi phu thuoc toa do, khong phu thuoc ca object — doi nhan ma giu nguyen
  // toa do thi khong can goi lai (cung cach lam o use-route.ts).
  const lat = origin?.lat;
  const lon = origin?.lon;

  useEffect(() => {
    if (lat === undefined || lon === undefined) {
      setState({ restaurants: [], status: 'idle', error: '' });
      return;
    }

    const controller = new AbortController();
    setState((prev) => ({ ...prev, status: 'loading', error: '' }));

    fetch(`/api/restaurants?lat=${lat}&lon=${lon}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`);
        return body as Place[];
      })
      .then((places) => {
        // Sap theo khoang cach duong chim bay. Tinh tai cho chu KHONG cat vao
        // mot truong `distanceKm`: mot khoang cach da luu la khoang cach toi
        // diem goc CU, va no se sai im lang khi diem goc doi (bai hoc da ghi o
        // mock-data.ts muc dia chi goi y).
        const sorted = [...places].sort(
          (a, b) => haversineKm({ lat, lon }, a) - haversineKm({ lat, lon }, b),
        );
        setState({ restaurants: sorted, status: 'ready', error: '' });
      })
      .catch((error: unknown) => {
        // Huy chu dong khong phai loi — de nguyen trang thai dang co.
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState({
          restaurants: [],
          status: 'error',
          error: error instanceof Error ? error.message : 'Không tìm được nhà hàng lúc này',
        });
      });

    return () => {
      controller.abort();
    };
  }, [lat, lon]);

  return state;
}
