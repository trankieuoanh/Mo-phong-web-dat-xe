'use client';

/**
 * Loc bang nha cung cap tile theo ket qua do cua `GET /api/tiles`.
 *
 * KHONG BAN EVENT NAO — day la tra cuu ha tang, khong phai mot buoc funnel.
 *
 * Duong dan `/api/tiles` TUONG DOI, di qua proxy rewrites cua Next
 * (apps/web/next.config.ts). Goi thang localhost:4000 se thanh cross-origin.
 */

import { useEffect, useState } from 'react';
import { TILE_PROVIDERS, type TileProvider } from '@gsm/shared';

/**
 * Cache o cap MODULE, khong phai cap component.
 *
 * Hai ly do. Mot: ban do xuat hien o 5 man, doi man khong nen do lai. Hai: React
 * Strict Mode chay effect hai lan trong `next dev` — khong co cho nay thi moi
 * lan mount la hai request (cung cai bay da lam hong so lieu funnel, xem
 * screen-map.md muc 4).
 */
let probePromise: Promise<string[]> | null = null;

function fetchUsableNames(): Promise<string[]> {
  probePromise ??= fetch('/api/tiles')
    .then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`);
      return body.providers as string[];
    })
    .catch((error) => {
      // Do that bai KHAC HAN "khong nha nao dung duoc". Nem tiep de hook ben
      // duoi lui ve nguyen ca bang, thay vi tra mang rong lam ban do trang.
      probePromise = null; // cho phep thu lai o lan mount sau
      throw error;
    });

  return probePromise;
}

/**
 * Tra ve cac nha cung cap con dung duoc, GIU NGUYEN thu tu uu tien goc.
 *
 * Trong luc dang do thi tra ve nguyen `TILE_PROVIDERS` chu khong phai mang rong:
 * ban do phai hien ngay, khong doi mot vong goi mang. Nha cung cap dau bang co
 * the la nha dang hong — nhung do dung la truong hop ma `onError` cua
 * `MapCanvas` van lo duoc.
 */
export function useTileProviders(): TileProvider[] {
  const [providers, setProviders] = useState<TileProvider[]>(TILE_PROVIDERS);

  useEffect(() => {
    let cancelled = false;

    fetchUsableNames()
      .then((names) => {
        if (cancelled) return;
        const usable = TILE_PROVIDERS.filter((provider) => names.includes(provider.name));
        // Mang rong nghia la KHONG nha nao dung duoc. Van giu ca bang: thu mot
        // nha cung cap co the hong con hon mot khung xam trong, va `tilesDead`
        // cua MapCanvas se noi that voi nguoi dung neu that su khong tai duoc.
        if (usable.length > 0) setProviders(usable);
      })
      .catch(() => {
        // Giu nguyen ca bang da dat o `useState`.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return providers;
}
