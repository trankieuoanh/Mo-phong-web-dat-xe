/**
 * Quan an that quanh mot toa do, qua Overpass API. Xem api-endpoints.md muc 3b-bis.
 *
 * VI SAO KHONG CON DUNG NOMINATIM CHO VIEC NAY — hai ly do, ly do thu hai dung
 * ngay ca khi mang thong:
 *
 *  1. Tren may chay du an nay, TOAN BO `*.openstreetmap.org` khong ket noi duoc,
 *     ke ca Nominatim. Dai "Gan ban" vi the luon rong.
 *  2. NOMINATIM LA MOT GEOCODER, KHONG PHAI CHI MUC POI. `amenity=restaurant`
 *     la truy van co cau truc xep theo "importance", nen no tra ve rat thua —
 *     6-hoac-0 quan ngay giua Cau Giay. Overpass truy van thang co so du lieu
 *     OSM theo ban kinh: cung toa do do, `around:1500` tra ve 80 quan.
 *
 * Overpass tra ve `tags` day du, nen quan gio co ca dia chi that
 * (`addr:housenumber` + `addr:street`) chu khong chi mot cai ten.
 *
 * KHONG dung thu vien — `fetch` co san trong Node 18+ (CLAUDE.md quy tac 8).
 */
import 'server-only';
import { normalizeVi, type Restaurant } from '@/lib/shared';
import type { RestaurantQuery } from '../validators/place.validator';
import { createUpstreamGate } from './upstream';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

const CONTACT = process.env.NOMINATIM_CONTACT ?? 'https://github.com/gsm-simulation';
const USER_AGENT = `gsm-simulation/0.1 (${CONTACT})`;

/** Overpass tinh toan phia may chu nen cham hon Nominatim; cho lau hon. */
const UPSTREAM_TIMEOUT_MS = 30_000;

/**
 * Gate RIENG, khong dung chung voi Nominatim/OSRM.
 *
 * Overpass khong ap luat 1 request/giay cua OSM, ma khuyen "dung chay song song
 * nhieu truy van nang". Dung chung gate 1100ms se keo ca tra dia chi lan tuyen
 * duong cham theo mot cach khong co ly do gi.
 */
const gate = createUpstreamGate({
  minGapMs: 300,
  ttlMs: 10 * 60 * 1000,
  maxEntries: 200,
});

/**
 * Mot phan tu Overpass tra ve. Chi khai bao phan thuc su doc.
 *
 * `lat`/`lon` chi co o `node`. `way` va `relation` tra ve tam qua `center` —
 * do la ly do truy van duoi dung `out center` chu khong phai `out body`.
 */
interface OverpassElement {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

/**
 * `type` + `id` -> id on dinh, CUNG KHUON voi ban Nominatim cu (`osm-N123`).
 *
 * Giu nguyen khuon la bat buoc: `restaurant_id` di thang vao properties cua
 * `select_restaurant`, va doi khuon se lam du lieu sinh truoc va sau doi
 * upstream khong ghep duoc voi nhau (CLAUDE.md quy tac 5).
 */
function stableId(element: OverpassElement): string | null {
  if (!element.type || element.id === undefined) return null;
  return `osm-${element.type.charAt(0).toUpperCase()}${element.id}`;
}

/**
 * Dia chi tu cac tag `addr:*`.
 *
 * Do phu that rat thua — phan lon quan chi co `addr:street`, nhieu quan khong
 * co gi. Ghep tu nhung manh co mat va tra chuoi rong khi khong co manh nao;
 * KHONG loai bo quan thieu dia chi, vi mot danh sach "gan ban" rong mot cach
 * kho hieu con te hon mot dong thieu ghi chu.
 */
function addressOf(tags: Record<string, string>): string {
  const parts = [
    [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' '),
    tags['addr:subdistrict'],
    tags['addr:district'],
    tags['addr:city'],
  ];
  return parts.filter((part) => part && part.trim() !== '').join(', ');
}

function toRestaurant(element: OverpassElement): Restaurant | null {
  const id = stableId(element);
  if (!id) return null;

  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  // Toa do la BAT BUOC: khong co thi khong ve duoc ban do va khong tinh duoc
  // khoang cach, nen bo han con hon de lot xuong FE.
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const tags = element.tags ?? {};
  // Quan khong co ten thi khong hien thi duoc — day la truong hop duy nhat
  // duoc phep loai bo.
  const label = tags.name?.trim();
  if (!label) return null;

  // OSM noi nhieu gia tri bang `;` — "asian;oriental;vietnamese".
  const cuisine = (tags.cuisine ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part !== '');

  return {
    id,
    label,
    address: addressOf(tags) || 'Chưa có địa chỉ chi tiết',
    source: 'search',
    lat: lat as number,
    lon: lon as number,
    cuisine,
    openingHours: tags.opening_hours?.trim() || undefined,
    phone: (tags.phone ?? tags['contact:phone'])?.trim() || undefined,
  };
}

/**
 * Khoa cache CHI gom nhung gi anh huong toi loi goi upstream: toa do va ban kinh.
 *
 * KHONG co `q` va khong co `limit` trong khoa — hai thu do duoc ap o JS sau khi
 * da co du lieu. Nho vay go them mot chu khong sinh mot loi goi Overpass moi:
 * ca man tim kiem chay tren dung MOT lan tai.
 *
 * Lam tron 3 chu so (~100m) de rung chuot toa do khong pha cache.
 */
function cacheKey(query: RestaurantQuery): string {
  return ['rest', query.lat.toFixed(3), query.lon.toFixed(3), query.radius].join('::');
}

/**
 * Dung cau truy van Overpass QL — KHONG bao gio loc theo ten.
 *
 * Lay ca `fast_food` va `cafe` chu khong chi `restaurant`: nguoi dung Viet Nam
 * goi quan banh mi, quan ca phe deu la "quan an", va loc cung theo `restaurant`
 * cat mat phan lon quan that trong mau.
 *
 * `nwr` = node + way + relation. Quan lon la `way` (ca toa nha) chu khong phai
 * mot diem, nen chi lay `node` se bo sot dung nhung quan de nhan ra nhat.
 * `out center` cho moi phan tu mot toa do tam, ke ca way/relation.
 */
function buildQuery(query: RestaurantQuery): string {
  return (
    `[out:json][timeout:25];` +
    `(nwr["amenity"~"restaurant|fast_food|cafe"](around:${query.radius},${query.lat},${query.lon}););` +
    `out center ${FETCH_LIMIT};`
  );
}

/**
 * Bao nhieu quan lay ve tu Overpass moi lan, truoc khi loc theo ten.
 *
 * LUON lay ca nam nay du nguoi dung dang tim gi, va do la co y — xem ghi chu o
 * `searchRestaurants`.
 */
const FETCH_LIMIT = 80;

async function callOverpass(query: RestaurantQuery): Promise<Restaurant[]> {
  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    // POST chu khong phai GET: truy van Overpass QL dai va co nhieu ky tu dac
    // biet, va mot so proxy cat query string dai.
    body: new URLSearchParams({ data: buildQuery(query) }),
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`upstream ${response.status}`);
  }

  const body = (await response.json()) as { elements?: OverpassElement[] };
  if (!Array.isArray(body.elements)) return [];

  return body.elements
    .map(toRestaurant)
    .filter((restaurant): restaurant is Restaurant => restaurant !== null);
}

/**
 * Quan an quanh mot toa do, loc theo ten neu co `q`.
 *
 * VIEC LOC THEO TEN LAM O DAY, KHONG PHAI TREN OVERPASS. Ba ly do:
 *
 *  1. Overpass TU CHOI cac truy van co lop ky tu tieng Viet trong regex — may
 *     chu tra ve 406 Not Acceptable. Khong phai loi cu phap ma la bo loc cua
 *     ha tang truoc no, nen khong sua bang cach viet regex kheo hon.
 *  2. `normalizeVi` (da co san trong lib/shared, dung cho tim mon) cho ta so
 *     khop khong dau mien phi: go "pho" ra "Phở", "bun cha" ra "Bún Chả". Day la
 *     cach go pho bien nhat, va bo loc phia Overpass thi khong lam duoc.
 *  3. Cache dung chung: moi phim go them KHONG sinh mot loi goi Overpass moi, vi
 *     khoa cache khong chua `q`. Ca man tim chay tren mot lan tai duy nhat.
 */
export async function searchRestaurants(query: RestaurantQuery): Promise<Restaurant[]> {
  const nearby = await gate.run(cacheKey(query), () => callOverpass(query));

  const needle = normalizeVi(query.q ?? '');
  const matched = needle
    ? nearby.filter((restaurant) => normalizeVi(restaurant.label).includes(needle))
    : nearby;

  return matched.slice(0, query.limit);
}
