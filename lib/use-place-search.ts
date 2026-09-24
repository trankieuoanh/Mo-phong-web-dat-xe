'use client';

/**
 * Tim dia chi that qua `GET /api/places`. Dung chung cho ca man chon diem den
 * (`address_selection`) lan o doi diem don (`pickup_confirm`).
 *
 * KHONG BAN EVENT NAO. Go phim khong phai mot buoc funnel — lua chon cuoi cung
 * da nam trong `select_address` / `confirm_pickup` (ride-flow-design.md muc 8).
 *
 * `/api/places` la route handler cua CHINH app nay (app/api/places/route.ts),
 * khong phai mot server khac. Vi vay no phai nam o server chu khong goi thang
 * Photon tu trinh duyet: dieu khoan OSM doi header `User-Agent` dinh danh ung
 * dung, ma trinh duyet khong cho JavaScript dat header do.
 */

import { useEffect, useState } from 'react';
import type { Place } from '@/lib/shared';

/**
 * Duoi nguong nay thi khong goi API — Photon tra rac ma van ton mot luot.
 *
 * EXPORT chu khong de rieng tu: PlacePicker phai biet dung con so NAY de quyet
 * dinh luc nao ve danh sach ket qua. Truoc day no chep tay so 3 trong khi day
 * la 2, nen go dung 2 ky tu se goi Photon mot luot ma ket qua KHONG BAO GIO
 * duoc ve ra. `validatePlaceQuery` o lib/server cung dat 2 — ba tang cung mot so.
 */
export const MIN_QUERY_LENGTH = 2;

/** Doi nguoi dung ngung go. 400ms du de mot tu tieng Viet go xong. */
const DEBOUNCE_MS = 400;

/**
 * Han cho mot lan goi `/api/places`. KHONG phai toi uu hoa — day la duong thoat
 * duy nhat khoi mot trang thai ket.
 *
 * `fetch` khong tu bo cuoc. Neu route handler nhan request nhung khong tra loi
 * (vi du tien trinh bi Ctrl+Z treo lai — xem setup.md), promise khong bao gio
 * settle, `status` ket o 'loading' VINH VIEN, va PlacePicker quay skeleton mai
 * mai. Ca nhanh suy bien em da viet san (canh bao + van liet ke 5 goi y) nam o
 * `status === 'error'` nen khong bao gio chay toi.
 *
 * 6s chu khong phai 8s: service tu bo cuoc voi Photon o 8s
 * (UPSTREAM_TIMEOUT_MS), nen cho lau hon the la ngoi doi dung cai loi ma BE da
 * phat hien xong. Photon do that tra loi duoi 1s; 6s con thua cho cho hang doi
 * `minGapMs: 600` phia BE.
 */
const REQUEST_TIMEOUT_MS = 6000;

export type PlaceSearchStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface PlaceSearchState {
  results: Place[];
  status: PlaceSearchStatus;
  /** Thong bao doc duoc cho nguoi dung khi status === 'error'. */
  error: string;
}

export function usePlaceSearch(query: string): PlaceSearchState {
  const [state, setState] = useState<PlaceSearchState>({
    results: [],
    status: 'idle',
    error: '',
  });

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < MIN_QUERY_LENGTH) {
      setState({ results: [], status: 'idle', error: '' });
      return;
    }

    // Huy request cu khi nguoi dung go tiep — neu khong, ket qua cua mot query
    // da cu co the ve SAU va de len ket qua moi.
    const controller = new AbortController();

    /**
     * Dong ho han cho. Chi ton tai trong khoang mot request dang bay, nen khai
     * bao o day de ca `.finally` lan ham don dep cua effect deu tat duoc no.
     */
    let deadline: ReturnType<typeof setTimeout> | undefined;

    const timer = setTimeout(() => {
      setState((prev) => ({ ...prev, status: 'loading', error: '' }));

      // `abort(reason)` chu khong phai `AbortSignal.any([...])`: giu dung MOT
      // controller, va nho cai reason ma nhanh catch ben duoi phan biet duoc
      // "nguoi dung go tiep" (AbortError, im lang) voi "may chu khong tra loi"
      // (TimeoutError, phai bao ra man hinh).
      deadline = setTimeout(
        () => controller.abort(new DOMException('Máy chủ không phản hồi', 'TimeoutError')),
        REQUEST_TIMEOUT_MS,
      );

      fetch(`/api/places?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then(async (response) => {
          const body = await response.json();
          if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`);
          return body as Place[];
        })
        .then((results) => setState({ results, status: 'ready', error: '' }))
        .catch((error: unknown) => {
          // Huy chu dong khong phai loi — de nguyen trang thai dang co.
          if (error instanceof DOMException && error.name === 'AbortError') return;
          setState({
            results: [],
            status: 'error',
            error: error instanceof Error ? error.message : 'Không tìm được địa chỉ lúc này',
          });
        })
        .finally(() => clearTimeout(deadline));
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      clearTimeout(deadline);
      controller.abort();
    };
  }, [query]);

  return state;
}
