/**
 * Tra cuu dia chi that qua Nominatim (OpenStreetMap). Xem api-endpoints.md muc 3b.
 *
 * KHONG dung thu vien geocoding — `fetch` co san trong Node 18+, va CLAUDE.md
 * quy tac 8 chot danh sach thu vien.
 *
 * Ba thu file nay giu ma khong cho nao khac giu duoc:
 *   1. User-Agent dinh danh — dieu khoan OSM bat buoc, va TRINH DUYET KHONG CHO
 *      JavaScript dat header nay. Day la ly do endpoint nay ton tai.
 *   2. Hang doi >= 1100ms giua hai lan goi upstream — OSM gioi han tuyet doi
 *      1 request/giay. Debounce phia client la goi y, khong phai bao dam.
 *   3. Cache dung chung — go "Cau Giay" roi xoa lui se hoi lai dung nhung query
 *      vua hoi. Thieu cache la cham tran 1 req/giay ngay trong luc demo.
 *
 * Muc 2 va 3 nam o `upstream.ts`, dung chung voi route.service.ts.
 */
import type { Place } from '@gsm/shared';
import type { PlaceQuery, RestaurantQuery } from '../validators/place.validator.js';
import { createUpstreamGate } from './upstream.js';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/**
 * Dieu khoan OSM bat buoc dinh danh ung dung kem mot dia chi lien he.
 * Co gia tri mac dinh de clone ve la chay duoc ngay — xem setup.md.
 */
const CONTACT = process.env.NOMINATIM_CONTACT ?? 'https://github.com/gsm-simulation';
const USER_AGENT = `gsm-simulation/0.1 (${CONTACT})`;

/** Khung nhin uu tien Ha Noi. KHONG `bounded=1` — van tim duoc ca nuoc, chi la xep sau. */
const HANOI_VIEWBOX = '105.70,21.15,105.95,20.92';

/** Qua moc nay thi coi nhu Nominatim khong tra loi. */
const UPSTREAM_TIMEOUT_MS = 8000;

const gate = createUpstreamGate({
  /** OSM: toi da 1 request/giay. Cong bien an toan. */
  minGapMs: 1100,
  ttlMs: 10 * 60 * 1000,
  maxEntries: 200,
});

/**
 * Ban kinh khung tim quan an quanh mot toa do, do bang DO chu khong phai km.
 * ~2km o vi do Ha Noi: 1 do vi do ~ 111km, 1 do kinh do ~ 104km.
 */
const NEARBY_LAT_SPAN = 0.018;
const NEARBY_LON_SPAN = 0.02;

/**
 * Khoa cache. MOI tham so anh huong ket qua deu phai co mat o day.
 *
 * Tien to `place::` / `rest::` tach hai khong gian khoa: hai loai truy van dung
 * chung mot `gate`, nen thieu tien to thi mot ngay nao do hai khoa trung nhau
 * va mot ben nhan im lang ket qua cua ben kia trong suot 10 phut TTL.
 */
function cacheKey(query: PlaceQuery): string {
  return `place::${query.q.trim().toLowerCase()}::${query.limit}`;
}

function restaurantCacheKey(query: RestaurantQuery): string {
  // Lam tron 3 chu so (~100m) de rung chuot toa do khong pha cache, nhung doi
  // sang mot khu khac thi van goi lai upstream.
  return `rest::${query.lat.toFixed(3)}::${query.lon.toFixed(3)}::${query.limit}`;
}

/** Hinh dang mot phan tu Nominatim tra ve — chi khai bao phan thuc su doc. */
interface NominatimItem {
  osm_type?: string;
  osm_id?: number;
  place_id?: number;
  name?: string;
  display_name?: string;
  lat?: string;
  lon?: string;
}

/**
 * `osm_type` + `osm_id` -> id on dinh. KHONG dung `place_id`: no doi moi lan
 * Nominatim build lai co so du lieu, tuc du lieu tuan nay khong ghep duoc voi
 * tuan sau (CLAUDE.md quy tac 5).
 *
 * Tra null khi thieu hai truong do — tha bo mot ket qua con hon ghi mot id
 * khong on dinh vao Firestore.
 */
function stableId(item: NominatimItem): string | null {
  if (!item.osm_type || item.osm_id === undefined) return null;
  // node -> N, way -> W, relation -> R
  return `osm-${item.osm_type.charAt(0).toUpperCase()}${item.osm_id}`;
}

function toPlace(item: NominatimItem): Place | null {
  const id = stableId(item);
  if (!id) return null;

  const lat = Number(item.lat);
  const lon = Number(item.lon);
  // `Place.lat/lon` la BAT BUOC — mot ket qua khong co toa do thi khong ve duoc
  // ban do va khong tinh duoc tuyen, nen bo han con hon de lot xuong FE.
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const display = item.display_name ?? '';
  // `name` la ten rieng ("Ho Hoan Kiem"); khi thieu thi lay ve dau cua display_name.
  const label = item.name?.trim() || display.split(',')[0]?.trim() || 'Không rõ';

  // Bo ve dau khoi dia chi day du de khong lap lai chinh `label` ngay ben duoi no.
  const rest = display.split(',').slice(1).join(',').trim();

  return {
    id,
    label,
    address: rest || display || label,
    source: 'search',
    lat,
    lon,
  };
}

async function callNominatim(query: PlaceQuery): Promise<Place[]> {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('q', query.q);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', String(query.limit));
  url.searchParams.set('countrycodes', 'vn');
  url.searchParams.set('accept-language', 'vi');
  url.searchParams.set('viewbox', HANOI_VIEWBOX);

  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`upstream ${response.status}`);
  }

  const body = (await response.json()) as NominatimItem[];
  if (!Array.isArray(body)) return [];

  return body.map(toPlace).filter((place): place is Place => place !== null);
}

export function searchPlaces(query: PlaceQuery): Promise<Place[]> {
  return gate.run(cacheKey(query), () => callNominatim(query));
}

/**
 * Nha hang quanh mot toa do — dai "Gan ban" o man `food_menu`.
 *
 * BA khac biet so voi callNominatim(), moi cai deu co ly do:
 *
 *  1. `amenity=restaurant` la STRUCTURED QUERY, va Nominatim bat chon MOT
 *     trong hai: structured hoac `q` tu do. Dat ca hai thi `amenity` bi bo qua
 *     im lang va ta nhan ve dia chi thuong thay vi quan an. Vi vay day la mot
 *     ham dung URL rieng chu khong phai them tham so vao ham cu.
 *  2. `bounded=1` — nguoc voi tim dia chi (co y KHONG bounded de van tim duoc
 *     ca nuoc). O day "gan ban" ma tra ve quan o Da Nang thi vo nghia, nen
 *     khung nhin phai loc cung.
 *  3. `viewbox` tinh quanh toa do truyen vao, khong phai hang so Ha Noi.
 *
 * Nominatim xep ket qua theo "importance", KHONG theo khoang cach — viec sap
 * theo km lam o FE bang haversineKm (lib/use-restaurants.ts).
 */
async function callNominatimRestaurants(query: RestaurantQuery): Promise<Place[]> {
  const left = query.lon - NEARBY_LON_SPAN;
  const right = query.lon + NEARBY_LON_SPAN;
  const top = query.lat + NEARBY_LAT_SPAN;
  const bottom = query.lat - NEARBY_LAT_SPAN;

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('amenity', 'restaurant');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', String(query.limit));
  url.searchParams.set('countrycodes', 'vn');
  url.searchParams.set('accept-language', 'vi');
  url.searchParams.set('viewbox', `${left},${top},${right},${bottom}`);
  url.searchParams.set('bounded', '1');

  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`upstream ${response.status}`);
  }

  const body = (await response.json()) as NominatimItem[];
  if (!Array.isArray(body)) return [];

  // `toPlace` dung lai nguyen xi: mot quan an cung chi la mot dia diem co ten
  // va toa do. Khong them type `Restaurant`, khong them gia tri cho
  // `PlaceSource` — doi no se cham properties cua ca luong ride.
  return body.map(toPlace).filter((place): place is Place => place !== null);
}

export function searchRestaurants(query: RestaurantQuery): Promise<Place[]> {
  // CUNG `gate` voi searchPlaces — OSM gioi han 1 request/giay cho CA ung dung,
  // nen mot gate thu hai se lam ta goi 2 req/giay va co nguy co bi chan IP.
  return gate.run(restaurantCacheKey(query), () => callNominatimRestaurants(query));
}
