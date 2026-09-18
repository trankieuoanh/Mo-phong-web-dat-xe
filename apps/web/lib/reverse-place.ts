'use client';

/**
 * Toa do -> mot `Place` co ten, qua `GET /api/reverse`.
 *
 * KHONG BAN EVENT NAO — day la tra cuu ha tang, khong phai mot buoc funnel.
 *
 * Duong dan `/api/reverse` TUONG DOI, di qua proxy rewrites cua Next
 * (apps/web/next.config.ts). Goi thang localhost:4000 se thanh cross-origin.
 *
 * La mot HAM chu khong phai hook: no chay khi nguoi dung bam vao ban do, khong
 * phai khi component mount — `use-current-place.ts` la hook vi no hoi GPS ngay
 * luc vao man.
 */

import { mapPlaceId, type Place } from '@gsm/shared';

/** Nhan dung khi khong tra cuu duoc ten. */
function fallbackLabel(lat: number, lon: number): string {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

export async function reversePlace(lat: number, lon: number): Promise<Place> {
  const picked: Place = {
    id: mapPlaceId(lat, lon),
    label: 'Vị trí đã chọn',
    address: fallbackLabel(lat, lon),
    source: 'map',
    lat,
    lon,
  };

  try {
    const response = await fetch(`/api/reverse?lat=${lat}&lon=${lon}`);
    if (!response.ok) return picked;

    const resolved = (await response.json()) as Place;

    return {
      ...picked,
      // CHI muon cai TEN cua no. Photon khop ve diem gan nhat no biet (thuong
      // la tim mot doan duong), lech vai chuc met so voi cho nguoi dung vua bam
      // — giu nguyen toa do BAM thi ghim moi nam dung cho. Cung ly do da ghi o
      // use-current-place.ts.
      label: resolved.label || picked.label,
      address: resolved.address || picked.address,
    };
  } catch {
    // Mat mang thi van cho chon — toa do da du de dat xe, chi thieu cai ten.
    // Cung tinh than voi duong lui cua use-route.ts.
    return picked;
  }
}
