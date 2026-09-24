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
  /** Tim theo TEN quan. Vang = liet ke moi quan trong ban kinh. */
  q?: string;
  /** Ban kinh tim, don vi MET. */
  radius: number;
}

/** Query cua GET /api/reverse — toa do -> dia chi that. */
export interface ReverseQuery {
  lat: number;
  lon: number;
}

export type ReverseQueryResult =
  | { ok: true; value: ReverseQuery }
  | { ok: false; error: string };

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

/**
 * Tran rieng cho /api/restaurants, KHONG dung chung voi /api/places.
 *
 * O tim dia chi, 8 goi y da qua du cho mot danh sach xo xuong. Con dai "Gan ban"
 * la mot luoi cuon ngang: 8 the het ngay sau mot cu vuot, va Nominatim xep theo
 * "importance" chu khong theo khoang cach, nen lay it la co nguy co khong con
 * quan nao that su gan trong tay truoc khi FE kip sap lai theo km.
 */
const MAX_RESTAURANT_LIMIT = 30;

/**
 * Ban kinh tim quan, don vi met.
 *
 * 1500m la quang duong giao do an hop ly o noi thanh, va do duoc tren mau that:
 * quanh diem mac dinh o Cau Giay, ban kinh nay cho ~80 quan — du day de dai
 * "Gan ban" khong bao gio trong. Tran 5km de khong bat Overpass quet ca thanh pho.
 */
const DEFAULT_RADIUS_M = 1500;
const MIN_RADIUS_M = 200;
const MAX_RADIUS_M = 5000;

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
 * Doc lat/lon bat buoc. Tach ra vi ca /api/restaurants lan /api/reverse deu can
 * dung phep kiem tra nay, va hai ban sao se lech nhau vao luc khong ai de y.
 */
function readCoords(
  params: URLSearchParams,
): { ok: true; lat: number; lon: number } | { ok: false; error: string } {
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

  return { ok: true, lat: coords.lat!, lon: coords.lon! };
}

/** Validate query cua GET /api/reverse — chi can toa do. */
export function validateReverseQuery(params: URLSearchParams): ReverseQueryResult {
  const coords = readCoords(params);
  if (!coords.ok) return { ok: false, error: coords.error };
  return { ok: true, value: { lat: coords.lat, lon: coords.lon } };
}

/**
 * Validate query cua GET /api/restaurants.
 *
 * `lat`/`lon` BAT BUOC: khong co toa do thi "gan ban" khong co nghia gi, va
 * mot viewbox mac dinh se lang le tra ve quan o mot noi khac han.
 */
export function validateRestaurantQuery(params: URLSearchParams): RestaurantQueryResult {
  const coords = readCoords(params);
  if (!coords.ok) return { ok: false, error: coords.error };

  let limit = DEFAULT_LIMIT;
  const rawLimit = params.get('limit');
  if (rawLimit !== null) {
    const parsed = Number(rawLimit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_RESTAURANT_LIMIT) {
      return {
        ok: false,
        error: `Invalid value for limit: expected an integer 1..${MAX_RESTAURANT_LIMIT}`,
      };
    }
    limit = parsed;
  }

  // `q` KHONG bat buoc — vang thi la "liet ke quan gan day". Chuoi rong duoc coi
  // nhu vang chu khong phai loi: o tim vua bi xoa trang van phai tra ve danh sach
  // gan day, khong duoc bao 400 giua luc nguoi dung dang go.
  const rawQuery = params.get('q');
  const trimmedQuery = rawQuery?.trim() ?? '';
  if (trimmedQuery !== '') {
    if (trimmedQuery.length < MIN_LENGTH) {
      return {
        ok: false,
        error: `Invalid value for q: expected at least ${MIN_LENGTH} characters`,
      };
    }
    if (trimmedQuery.length > MAX_LENGTH) {
      return { ok: false, error: `Invalid value for q: expected at most ${MAX_LENGTH} characters` };
    }
  }

  let radius = DEFAULT_RADIUS_M;
  const rawRadius = params.get('radius');
  if (rawRadius !== null) {
    const parsed = Number(rawRadius);
    if (!Number.isInteger(parsed) || parsed < MIN_RADIUS_M || parsed > MAX_RADIUS_M) {
      return {
        ok: false,
        error: `Invalid value for radius: expected an integer ${MIN_RADIUS_M}..${MAX_RADIUS_M}`,
      };
    }
    radius = parsed;
  }

  return {
    ok: true,
    value: {
      lat: coords.lat,
      lon: coords.lon,
      limit,
      radius,
      ...(trimmedQuery === '' ? {} : { q: trimmedQuery }),
    },
  };
}
