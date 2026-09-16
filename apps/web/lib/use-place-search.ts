'use client';

/**
 * Tim dia chi that qua `GET /api/places`. Dung chung cho ca man chon diem den
 * (`address_selection`) lan o doi diem don (`pickup_confirm`).
 *
 * KHONG BAN EVENT NAO. Go phim khong phai mot buoc funnel — lua chon cuoi cung
 * da nam trong `select_address` / `confirm_pickup` (ride-flow-design.md muc 8).
 *
 * Duong dan la `/api/places` TUONG DOI, di qua proxy rewrites cua Next
 * (apps/web/next.config.ts). Goi thang localhost:4000 se thanh cross-origin.
 */

import { useEffect, useState } from 'react';
import type { Place } from '@gsm/shared';

/** Duoi nguong nay thi khong goi API — Nominatim tra rac ma van ton mot luot. */
const MIN_QUERY_LENGTH = 3;

/** Doi nguoi dung ngung go. 400ms du de mot tu tieng Viet go xong. */
const DEBOUNCE_MS = 400;

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

    const timer = setTimeout(() => {
      setState((prev) => ({ ...prev, status: 'loading', error: '' }));

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
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return state;
}
