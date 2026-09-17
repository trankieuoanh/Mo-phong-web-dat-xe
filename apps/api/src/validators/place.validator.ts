/**
 * Validate query cua GET /api/places — hop dong o api-endpoints.md muc 3b.
 */

export interface PlaceQuery {
  q: string;
  limit: number;
}

/** Query cua GET /api/restaurants — tim quan quanh mot toa do. */
export interface RestaurantQuery {
  lat: number;
  lon: number;
  limit: number;
}

export type PlaceQueryResult =
  | { ok: true; value: PlaceQuery }
  | { ok: false; error: string };

export type RestaurantQueryResult =
  | { ok: true; value: RestaurantQuery }
  | { ok: false; error: string };

/** Duoi 2 ky tu thi Nominatim tra rac; tren 120 thi chac chan la dan sai. */
const MIN_LENGTH = 2;
const MAX_LENGTH = 120;

const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 8;

export function validatePlaceQuery(params: URLSearchParams): PlaceQueryResult {
  const raw = params.get('q');
  if (raw === null || raw.trim() === '') {
    return { ok: false, error: 'Missing required field: q' };
  }

  const q = raw.trim();
  if (q.length < MIN_LENGTH) {
    return { ok: false, error: `Invalid value for q: expected at least ${MIN_LENGTH} characters` };
  }
  if (q.length > MAX_LENGTH) {
    return { ok: false, error: `Invalid value for q: expected at most ${MAX_LENGTH} characters` };
  }

  let limit = DEFAULT_LIMIT;
  const rawLimit = params.get('limit');
  if (rawLimit !== null) {
    const parsed = Number(rawLimit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
      return { ok: false, error: `Invalid value for limit: expected an integer 1..${MAX_LIMIT}` };
    }
    limit = parsed;
  }

  return { ok: true, value: { q, limit } };
}

/**
 * Validate query cua GET /api/restaurants.
 *
 * `lat`/`lon` BAT BUOC: khong co toa do thi "gan ban" khong co nghia gi, va
 * mot viewbox mac dinh se lang le tra ve quan o mot noi khac han.
 */
export function validateRestaurantQuery(params: URLSearchParams): RestaurantQueryResult {
  const coords: { lat?: number; lon?: number } = {};

  for (const field of ['lat', 'lon'] as const) {
    const raw = params.get(field);
    if (raw === null || raw.trim() === '') {
      return { ok: false, error: `Missing required field: ${field}` };
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return { ok: false, error: `Invalid value for ${field}: expected a number` };
    }
    const bound = field === 'lat' ? 90 : 180;
    if (parsed < -bound || parsed > bound) {
      return { ok: false, error: `Invalid value for ${field}: expected -${bound}..${bound}` };
    }
    coords[field] = parsed;
  }

  let limit = DEFAULT_LIMIT;
  const rawLimit = params.get('limit');
  if (rawLimit !== null) {
    const parsed = Number(rawLimit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
      return { ok: false, error: `Invalid value for limit: expected an integer 1..${MAX_LIMIT}` };
    }
    limit = parsed;
  }

  return { ok: true, value: { lat: coords.lat!, lon: coords.lon!, limit } };
}
