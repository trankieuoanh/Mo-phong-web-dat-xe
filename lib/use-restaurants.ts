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
 * Khac use-place-search.ts hai diem:
 *   1. Co SAP LAI theo khoang cach: Nominatim xep theo "importance", nen quan
 *      gan nhat khong he nam dau danh sach no tra ve.
 *   2. Debounce CHI ap cho nhanh tim theo ten. Doi toa do thi goi ngay — toa do
 *      khong do nguoi dung go ra, doi them 400ms chi lam man hinh cham hon.
 */

import { useCallback, useEffect, useState } from 'react';
import { haversineKm, type Place, type Restaurant } from '@gsm/shared';

export type RestaurantStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface RestaurantState {
  /** Da sap theo khoang cach tang dan tu `origin`. */
  restaurants: Restaurant[];
  status: RestaurantStatus;
  /** Thong bao doc duoc cho nguoi dung khi status === 'error'. */
  error: string;
  /** Goi lai upstream sau khi that bai — nut "Thu lai" o man menu. */
  retry: () => void;
}

/** Duoi nguong nay thi khong goi API — cung nguong voi validator o apps/api. */
const MIN_QUERY_LENGTH = 2;

/** Doi nguoi dung ngung go. 400ms du de mot tu tieng Viet go xong. */
const DEBOUNCE_MS = 400;

/**
 * So quan lay ve. PHAI gui len — bo trong thi API dung mac dinh 6, va dai
 * "Gan ban" het ngay sau mot cu vuot.
 */
const LIMIT = 20;

/** Ban kinh tim, met. 2km la quang duong giao do an hop ly o noi thanh. */
const RADIUS_M = 2000;

/**
 * @param origin  Toa do goc de sap theo khoang cach.
 * @param query   Tim theo TEN quan. Rong = liet ke quan gan day.
 */
export function useRestaurants(origin: Place | undefined, query = ''): RestaurantState {
  const [state, setState] = useState<Omit<RestaurantState, 'retry'>>({
    restaurants: [],
    status: 'idle',
    error: '',
  });

  // Doi gia tri nay la mot cach bao effect chay lai ma khong phai doi tham so —
  // nut "Thu lai" khong co gi moi de truyen vao ca.
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // Chi phu thuoc toa do, khong phu thuoc ca object — doi nhan ma giu nguyen
  // toa do thi khong can goi lai (cung cach lam o use-route.ts).
  const lat = origin?.lat;
  const lon = origin?.lon;

  // Query qua ngan duoc coi nhu KHONG tim, chu khong phai tim chuoi ngan: go
  // mot chu cai thi van phai thay danh sach quan gan day.
  const trimmed = query.trim();
  const search = trimmed.length >= MIN_QUERY_LENGTH ? trimmed : '';

  useEffect(() => {
    if (lat === undefined || lon === undefined) {
      setState({ restaurants: [], status: 'idle', error: '' });
      return;
    }

    // Chot toa do thanh MOT object sau khi da kiem tra. TypeScript khong giu
    // ket qua thu hep kieu khi di qua bien gioi mot ham long ben trong, nen
    // khong co dong nay thi `run()` ben duoi buoc phai dung `lat!` — dung dau
    // cham than la vut di chinh cai kiem tra vua viet o tren.
    const from = { lat, lon };

    // Huy request cu khi nguoi dung go tiep — neu khong, ket qua cua mot query
    // da cu co the ve SAU va de len ket qua moi.
    const controller = new AbortController();

    function run() {
      setState((prev) => ({ ...prev, status: 'loading', error: '' }));

      const base = `/api/restaurants?lat=${from.lat}&lon=${from.lon}&limit=${LIMIT}&radius=${RADIUS_M}`;
      const url = search ? `${base}&q=${encodeURIComponent(search)}` : base;

      fetch(url, { signal: controller.signal })
        .then(async (response) => {
          const body = await response.json();
          if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`);
          return body as Restaurant[];
        })
        .then((found) => {
          // Sap theo khoang cach duong chim bay. Tinh tai cho chu KHONG cat vao
          // mot truong `distanceKm`: mot khoang cach da luu la khoang cach toi
          // diem goc CU, va no se sai im lang khi diem goc doi (bai hoc da ghi o
          // mock-data.ts muc dia chi goi y).
          const sorted = [...found].sort(
            (a, b) => haversineKm(from, a) - haversineKm(from, b),
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
    }

    // Chi debounce nhanh go phim. Doi toa do (hoac bam "Thu lai") thi goi ngay.
    if (!search) {
      run();
      return () => controller.abort();
    }

    const timer = setTimeout(run, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [lat, lon, search, attempt]);

  return { ...state, retry };
}
