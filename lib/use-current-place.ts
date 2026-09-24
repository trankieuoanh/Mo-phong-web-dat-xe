'use client';

/**
 * Vi tri that cua nguoi dung, cho dai "Gan ban" o man `food_menu`.
 *
 * KHONG BAN EVENT NAO — day la tra cuu ha tang. Event chi bat khi nguoi dung
 * CHOT mot dia chi khac (`change_address` o app/food/page.tsx).
 *
 * BA NHANH THAT BAI, MOT KET QUA: tu choi quyen, het thoi gian cho, trinh duyet
 * khong ho tro — ca ba deu lui ve DEFAULT_PICKUP voi status 'fallback'. Man hinh
 * doc `status` de noi ro dieu do; mot dia chi mac dinh hien ra nhu the la GPS
 * that con te hon khong co GPS.
 *
 * CO REVERSE-GEOCODE qua `GET /api/reverse`. Ban dau chi hien "Vi tri hien tai"
 * / "Quanh vi tri cua ban", va do la mot loi that: nguoi dung bam Dat don ma
 * khong he biet don se giao toi dau. Mot cai nhan khong phai la mot dia chi.
 *
 * Tra cuu dia chi la BUOC PHU, khong chan luong: toa do co truoc va dung duoc
 * ngay (dai "Gan ban" khong phai cho), nhan dia chi dep hon den sau khi Photon
 * tra loi. Photon that bai thi giu nhan mac dinh va di tiep.
 */

import { useEffect, useState } from 'react';
import { DEFAULT_PICKUP, type Place } from '@/lib/shared';

export type CurrentPlaceStatus = 'locating' | 'ready' | 'fallback';

export interface CurrentPlaceState {
  /** LUON co gia tri — khong bao gio undefined, xem ghi chu dau file. */
  place: Place;
  status: CurrentPlaceStatus;
}

/** Qua moc nay thi coi nhu may khong tra loi duoc toa do. */
const GEOLOCATION_TIMEOUT_MS = 8000;

/**
 * Toa do GPS -> Place. `source: 'preset'` chu khong phai 'search': gia tri nay
 * di thang vao properties cua `change_address`, va `PlaceSource` chi co hai gia
 * tri (them mot gia tri thu ba se cham ca luong ride — xem places.ts).
 * 'preset' o day nghia la "khong phai nguoi dung tu go tim".
 */
function toPlace(position: GeolocationPosition): Place {
  return {
    id: 'geo-current',
    label: 'Vị trí hiện tại',
    address: 'Quanh vị trí của bạn',
    source: 'preset',
    lat: position.coords.latitude,
    lon: position.coords.longitude,
  };
}

export function useCurrentPlace(): CurrentPlaceState {
  const [state, setState] = useState<CurrentPlaceState>({
    // Luot render dau LUON la DEFAULT_PICKUP, o ca server lan client: doc
    // navigator luc render la dung cai bay hydration mismatch ghi o lib/session.ts.
    place: DEFAULT_PICKUP,
    status: 'locating',
  });

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState({ place: DEFAULT_PICKUP, status: 'fallback' });
      return;
    }

    // `cancelled` chu khong phai AbortController: getCurrentPosition khong nhan
    // signal. Effect nay chay mot lan, nhung Strict Mode cua `next dev` unmount
    // roi mount lai — khong co co nay thi callback cua lan dau van setState vao
    // component da thao.
    let cancelled = false;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return;
        const rough = toPlace(position);
        // Hien toa do ngay, KHONG doi Photon: dai "Gan ban" chi can lat/lon, va
        // bat nguoi dung nhin man hinh trong them mot vong mang la vo ich.
        setState({ place: rough, status: 'ready' });

        // Roi nang nhan len dia chi that khi tra cuu xong.
        fetch(`/api/reverse?lat=${rough.lat}&lon=${rough.lon}`)
          .then((response) => (response.ok ? response.json() : null))
          .then((resolved: Place | null) => {
            if (cancelled || !resolved) return;
            // Giu nguyen toa do GPS: Photon tra ve toa do cua diem no khop duoc
            // (thuong la tim mot doan duong), lech vai chuc met so voi cho nguoi
            // dung dang dung. Ta chi muon cai TEN cua no.
            setState({
              place: { ...resolved, lat: rough.lat, lon: rough.lon },
              status: 'ready',
            });
          })
          .catch(() => {
            // Tra cuu nhan that bai thi van con toa do — khong chan gi ca.
          });
      },
      () => {
        // Nuot MOI loi mot cach co y: tu choi quyen, het gio, khong lay duoc vi
        // tri — voi man hinh thi ba truong hop nay giong het nhau.
        if (cancelled) return;
        setState({ place: DEFAULT_PICKUP, status: 'fallback' });
      },
      { timeout: GEOLOCATION_TIMEOUT_MS, maximumAge: 5 * 60 * 1000 },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
