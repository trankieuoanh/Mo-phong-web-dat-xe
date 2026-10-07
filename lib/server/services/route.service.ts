/**
 * Tim tuyen duong that qua OSRM. Xem api-endpoints.md muc 3c.
 *
 * KHONG dung thu vien dinh tuyen — `fetch` co san trong Node 18+, va CLAUDE.md
 * quy tac 8 chot danh sach thu vien.
 *
 * `router.project-osrm.org` la MAY CHU DEMO CONG CONG, khong cam ket uptime.
 * Vi vay route tra 502 khi no im lang, va FE co duong lui `straightRoute()`.
 * Service nay KHONG tu suy bien: neu no lang le tra ve duong thang thi
 * `route_source` se ghi 'osrm' cho mot con so duong chim bay, va du lieu noi doi.
 */
import 'server-only';
import type { RouteResult } from '@/lib/shared';
import { roundKm } from '@/lib/shared';
import type { RouteQuery } from '../validators/route.validator';
import { createUpstreamGate } from './upstream';

/**
 * May chu dinh tuyen. Mac dinh la MAY CHU DEMO CONG CONG cua OSRM: khong SLA, co gioi han tan suat,
 * khong co du lieu giao thong. Khi len production nen tu host OSRM va dat `OSRM_BASE_URL`
 * (vd. `http://osrm.noi-bo:5000/route/v1/driving`). Bien nay cung dung de GIA LAP LOI khi kiem thu
 * (tro toi cong dong) — xem scripts/e2e/route.js.
 */
const OSRM_URL = (process.env.OSRM_BASE_URL || 'https://router.project-osrm.org/route/v1/driving').replace(/\/$/, '');

/** Qua moc nay thi coi nhu OSRM khong tra loi. */
const UPSTREAM_TIMEOUT_MS = 8000;

const gate = createUpstreamGate({
  // OSRM khong cong bo tran cung nhu OSM, nhung day la ha tang cong dong
  // mien phi — giu nhip thua con hon bi chan.
  minGapMs: 600,
  ttlMs: 30 * 60 * 1000,
  maxEntries: 200,
});

/** Hinh dang phan OSRM tra ve ma ta thuc su doc. */
interface OsrmResponse {
  code?: string;
  routes?: {
    distance?: number; // met
    duration?: number; // giay
    geometry?: { coordinates?: [number, number][] }; // [lon, lat][]
  }[];
}

function cacheKey(query: RouteQuery): string {
  // Lam tron 5 chu so thap phan (~1 m) truoc khi lam khoa: hai lan bam cung mot
  // dia chi phai trung khoa, khong thi cache khong bao gio dung.
  const fmt = (v: number) => v.toFixed(5);
  return `${fmt(query.from.lat)},${fmt(query.from.lon)}->${fmt(query.to.lat)},${fmt(query.to.lon)}`;
}

async function callOsrm(query: RouteQuery): Promise<RouteResult> {
  // OSRM nhan toa do theo thu tu lon,lat — NGUOC voi lat,lon o moi cho khac
  // trong du an. Dao nham thi tuyen roi xuong bien Somalia ma khong bao loi.
  const coords = `${query.from.lon},${query.from.lat};${query.to.lon},${query.to.lat}`;
  const url = new URL(`${OSRM_URL}/${coords}`);
  url.searchParams.set('overview', 'full');
  url.searchParams.set('geometries', 'geojson');

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });

  if (!response.ok) throw new Error(`upstream ${response.status}`);

  const body = (await response.json()) as OsrmResponse;
  const route = body.routes?.[0];

  if (body.code !== 'Ok' || !route) {
    throw new Error(`upstream trả về ${body.code ?? 'không có tuyến'}`);
  }

  const coordinates = route.geometry?.coordinates ?? [];
  // Mot tuyen it hon 2 diem khong phai "tuyen duong": FE se ve no thanh mot cham/duong thang gia.
  // Tu choi o day de FE thay mot LOI that (502) thay vi mot tuyen rong vo nghia.
  if (coordinates.length < 2) throw new Error('upstream trả về tuyến rỗng');

  return {
    distanceKm: roundKm((route.distance ?? 0) / 1000),
    durationMin: Math.max(1, Math.round((route.duration ?? 0) / 60)),
    // Doi ve [lat, lon] cho khop quy uoc cua ca du an.
    geometry: coordinates.map(([lon, lat]) => [lat, lon] as [number, number]),
    source: 'osrm',
  };
}

/**
 * Loi TAM THOI cua OSRM cong cong: mang timeout (fetch failed / TimeoutError) hoac HTTP 5xx/429. Do that: tu
 * may dev, lan goi dau toi router.project-osrm.org hay ETIMEDOUT (IPv4 cham, IPv6 khong toi duoc), lan sau
 * thi nhanh. "Khong co tuyen" (NoRoute/NoSegment) KHONG phai loi tam thoi — thu lai cung vo ich.
 */
function isTransient(error: unknown): boolean {
  if (error instanceof Error) {
    if (error.name === 'TimeoutError' || error instanceof TypeError) return true;
    return /^upstream (5\d\d|429)$/.test(error.message);
  }
  return false;
}

/** Mot lan thu lai sau 400 ms cho loi tam thoi. FE co them nut "Thu lai" cho truong hop that bai han. */
async function callOsrmWithRetry(query: RouteQuery): Promise<RouteResult> {
  try {
    return await callOsrm(query);
  } catch (error) {
    if (!isTransient(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 400));
    return callOsrm(query);
  }
}

export function findRoute(query: RouteQuery): Promise<RouteResult> {
  return gate.run(cacheKey(query), () => callOsrmWithRetry(query));
}
