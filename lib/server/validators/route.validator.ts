/**
 * Validate query cua GET /api/route — hop dong o api-endpoints.md muc 3c.
 */
import type { LatLon } from '@gsm/shared';

export interface RouteQuery {
  from: LatLon;
  to: LatLon;
}

export type RouteQueryResult =
  | { ok: true; value: RouteQuery }
  | { ok: false; error: string };

/** `"21.0369,105.7856"` -> LatLon, hoac null neu sai dinh dang / ngoai khoang. */
function parseLatLon(raw: string): LatLon | null {
  const parts = raw.split(',');
  if (parts.length !== 2) return null;

  const rawLat = parts[0]?.trim() ?? '';
  const rawLon = parts[1]?.trim() ?? '';

  // Number('') === 0, nen phai chan chuoi rong truoc khi kiem khoang.
  if (rawLat === '' || rawLon === '') return null;

  const lat = Number(rawLat);
  const lon = Number(rawLon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lon < -180 || lon > 180) return null;

  return { lat, lon };
}

export function validateRouteQuery(params: URLSearchParams): RouteQueryResult {
  const parsed: Partial<RouteQuery> = {};

  for (const key of ['from', 'to'] as const) {
    const raw = params.get(key);
    if (raw === null || raw.trim() === '') {
      return { ok: false, error: `Missing required field: ${key}` };
    }
    const point = parseLatLon(raw.trim());
    if (!point) {
      return {
        ok: false,
        error: `Invalid value for ${key}: expected "lat,lon" with lat in [-90,90] and lon in [-180,180]`,
      };
    }
    parsed[key] = point;
  }

  return { ok: true, value: parsed as RouteQuery };
}
