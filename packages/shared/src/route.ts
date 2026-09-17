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
 * Duong lui khi `GET /api/route` that bai: noi thang hai diem.
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
