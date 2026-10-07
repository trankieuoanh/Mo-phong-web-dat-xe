/**
 * Hop dong cua API tim tuyen duong — `GET /api/route`. Xem api-endpoints.md muc 3c.
 *
 * `straightRoute()` song o day chu khong o FE co chu y: no la MOT PHAN CUA HOP
 * DONG GIA. Khi OSRM khong tra loi, `calcFare()` an `distanceKm` tu chinh ham
 * nay, va con so do duoc ghi thang vao event `confirm_ride`. Dat no o FE nghia
 * la mot cong thuc sinh du lieu phan tich nam ngoai package dung chung.
 */

export interface LatLon {
  lat: number;
  lon: number;
}

/**
 * `osrm` = tuyen duong bo that. `straight` = OSRM khong tra loi nen da suy bien
 * ve duong noi thang, quang duong tinh theo duong chim bay.
 *
 * Gia tri nay di THANG vao `properties.route_source` cua `confirm_ride`.
 * Bat buoc phai co: thieu no thi mot chuyen 8 km duong that va mot chuyen 8 km
 * duong chim bay trong giong het nhau trong du lieu — ma duong chim bay luon
 * ngan hon dang ke. Xem event-taxonomy.md muc `ride_confirm`.
 */
export type RouteSource = 'osrm' | 'straight';

export interface RouteResult {
  /** Km, lam tron 1 chu so thap phan. */
  distanceKm: number;
  /** Phut, so nguyen. */
  durationMin: number;
  /** Hinh dang tuyen de ve: [lat, lon][]. Nhanh `straight` chi co 2 diem. */
  geometry: [number, number][];
  source: RouteSource;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Khoang cach duong chim bay giua hai toa do, don vi km. */
export function haversineKm(a: LatLon, b: LatLon): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Van toc trung binh gia dinh cho duong pho Ha Noi, dung de uoc luong thoi gian
 * o nhanh `straight`. Khong co y nghia gi ngoai viec cho ra mot con so hop ly —
 * do la ly do `route_source` phai duoc ghi lai.
 */
const AVERAGE_SPEED_KMH = 25;

/** Lam tron km toi 1 chu so thap phan — khop dinh dang o event-taxonomy.md. */
export function roundKm(km: number): number {
  return Math.round(km * 10) / 10;
}

/**
 * `true` khi `route` la mot tuyen DUONG THAT (OSRM, >= 2 diem). Cac man sau buoc chon diem don dung
 * no lam dieu kien vao man: draft thieu tuyen hoac con tuyen `straight` cu thi phai tinh lai o
 * `/ride/pickup`, khong duoc ve/tinh gia bang duong chim bay.
 */
export function isRoadRoute(route: RouteResult | null | undefined): route is RouteResult {
  return route?.source === 'osrm' && Array.isArray(route.geometry) && route.geometry.length >= 2;
}

// ─────────────────────────────────────────────────────────────
// Hinh hoc tuyen: do dai tich luy, noi suy, huong di
//
// Ham THUAN, khong phu thuoc React/DOM, de mo phong xe (lib/use-vehicle-simulation.ts) va
// kiem thu bang `node --experimental-strip-types`.
// ─────────────────────────────────────────────────────────────

/** Vi tri tren tuyen + huong di (do, 0 = bac, theo chieu kim dong ho). */
export interface RoutePoint extends LatLon {
  heading: number;
}

/** Goc phuong vi tu `a` toi `b`, do, 0..360, 0 = huong bac. */
export function bearingDeg(a: LatLon, b: LatLon): number {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const dLon = toRadians(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (((Math.atan2(y, x) * 180) / Math.PI) % 360 + 360) % 360;
}

/**
 * Diem nam o `fraction` (0..1) CHIEU DAI tuyen, tinh dung do dai tung doan chu KHONG theo chi so
 * diem: tuyen OSRM co diem day o cho re va thua o duong thang, noi suy theo chi so se lam xe chay
 * nhanh/cham that thuong.
 *
 * `geometry` la `[lat, lon][]` (quy uoc cua RouteResult). Tuyen rong -> nem; 1 diem -> dung yen;
 * tuyen do dai 0 -> diem dau.
 */
export function pointAlong(geometry: [number, number][], fraction: number): RoutePoint {
  if (geometry.length === 0) throw new Error('pointAlong: tuyen rong');
  const toLatLon = ([lat, lon]: [number, number]): LatLon => ({ lat, lon });

  if (geometry.length === 1) return { ...toLatLon(geometry[0]!), heading: 0 };

  const f = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));

  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < geometry.length; i += 1) {
    const d = haversineKm(toLatLon(geometry[i - 1]!), toLatLon(geometry[i]!));
    lengths.push(d);
    total += d;
  }

  // Bo qua cac doan do dai 0 khi tinh huong: bearing cua hai diem trung nhau vo nghia.
  const headingOfSegment = (index: number): number => {
    for (let k = index; k >= 0; k -= 1) {
      if (lengths[k]! > 0) return bearingDeg(toLatLon(geometry[k]!), toLatLon(geometry[k + 1]!));
    }
    for (let k = index + 1; k < lengths.length; k += 1) {
      if (lengths[k]! > 0) return bearingDeg(toLatLon(geometry[k]!), toLatLon(geometry[k + 1]!));
    }
    return 0;
  };

  if (total === 0) return { ...toLatLon(geometry[0]!), heading: 0 };

  const target = f * total;
  let walked = 0;
  for (let i = 0; i < lengths.length; i += 1) {
    const segment = lengths[i]!;
    if (walked + segment >= target || i === lengths.length - 1) {
      const t = segment === 0 ? 0 : Math.max(0, Math.min(1, (target - walked) / segment));
      const [lat1, lon1] = geometry[i]!;
      const [lat2, lon2] = geometry[i + 1]!;
      return {
        lat: lat1 + (lat2 - lat1) * t,
        lon: lon1 + (lon2 - lon1) * t,
        heading: headingOfSegment(i),
      };
    }
    walked += segment;
  }
  return { ...toLatLon(geometry[geometry.length - 1]!), heading: headingOfSegment(lengths.length - 1) };
}

/**
 * Duong lui khi `GET /api/route` that bai: noi thang hai diem.
 *
 * KHONG con duoc luong dat xe dung: tu 10/2026 giao dien CHAN dat khi chua co tuyen that (xem
 * lib/use-route.ts). Giu ham de doc/so sanh du lieu cu (`route_source: 'straight'`) va cho cac
 * script; moi cho GOI no phai tu hoi "co dang ve no nhu mot tuyen duong that khong?".
 *
 * KHONG bao gio ném loi — day la nhanh cuoi cung, no phai luon tra ve mot
 * RouteResult dung duoc de luong dat xe khong bi chan vi mot dich vu ben ngoai.
 */
export function straightRoute(from: LatLon, to: LatLon): RouteResult {
  const distanceKm = roundKm(haversineKm(from, to));
  return {
    distanceKm,
    durationMin: Math.max(1, Math.round((distanceKm / AVERAGE_SPEED_KMH) * 60)),
    geometry: [
      [from.lat, from.lon],
      [to.lat, to.lon],
    ],
    source: 'straight',
  };
}
