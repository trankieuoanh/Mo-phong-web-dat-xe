/**
 * Tra cuu dia chi that qua Photon (komoot). Xem api-endpoints.md muc 3b.
 *
 * VI SAO THAY NOMINATIM: tren may chay du an nay, `nominatim.openstreetmap.org`
 * khong ket noi duoc, nen o tim dia chi im lang khong ra ket qua nao. Photon
 * chay tren du lieu OSM y het, khac moi ten mien va ha tang.
 *
 * DUOC THEM MOT THU QUAN TRONG: Photon co REVERSE GEOCODE (toa do -> dia chi).
 * Nominatim cung co, nhung ta chua bao gio dung, va do chinh la ly do man xac
 * nhan don chi hien duoc "Quanh vi tri cua ban" thay vi mot dia chi that.
 *
 * Ba thu file nay giu:
 *   1. User-Agent dinh danh — le phep voi mot dich vu cong dong mien phi, va
 *      TRINH DUYET KHONG CHO JavaScript dat header nay.
 *   2. Hang doi giua cac lan goi upstream.
 *   3. Cache dung chung — go "Cau Giay" roi xoa lui se hoi lai dung query cu.
 */
import 'server-only';
import type { Place } from '@/lib/shared';
import type { PlaceQuery, ReverseQuery } from '../validators/place.validator';
import { createUpstreamGate } from './upstream';

const PHOTON_SEARCH_URL = 'https://photon.komoot.io/api';
const PHOTON_REVERSE_URL = 'https://photon.komoot.io/reverse';

const CONTACT = process.env.NOMINATIM_CONTACT ?? 'https://github.com/gsm-simulation';
const USER_AGENT = `gsm-simulation/0.1 (${CONTACT})`;

const UPSTREAM_TIMEOUT_MS = 8000;

/** Khung nhin uu tien Ha Noi — Photon xep uu tien quanh diem nay, khong cat cung. */
const HANOI_CENTER = { lat: 21.0278, lon: 105.8342 };

/**
 * Khung bao Viet Nam: minLon, minLat, maxLon, maxLat.
 *
 * BAT BUOC, khong phai tinh nang phu. Photon chi UU TIEN theo `lat`/`lon` chu
 * khong cat, nen "Ho Guom" tra ve mot tiem an o Munchen va mot quan o Rostock
 * ngay tren ket qua thu hai — Nominatim truoc day chan viec nay bang
 * `countrycodes=vn`, va Photon khong co tham so do.
 */
const VIETNAM_BBOX = '102.1,8.2,109.6,23.4';

const gate = createUpstreamGate({
  minGapMs: 600,
  ttlMs: 10 * 60 * 1000,
  maxEntries: 200,
});

/**
 * Photon tra ve GeoJSON. Chi khai bao phan thuc su doc.
 * Toa do trong GeoJSON LUON la [lon, lat] — nguoc voi thoi quen doc.
 */
interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_type?: string;
    osm_id?: number;
    name?: string;
    housenumber?: string;
    street?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
  };
}

/**
 * `osm_type` + `osm_id` -> id on dinh, CUNG KHUON voi ban Nominatim cu
 * (`osm-N240109189`). Giu nguyen khuon la bat buoc: gia tri nay di thang vao
 * `address_id` cua event, doi khuon la du lieu cu va moi khong ghep duoc
 * (CLAUDE.md quy tac 5).
 */
function stableId(props: NonNullable<PhotonFeature['properties']>): string | null {
  if (!props.osm_type || props.osm_id === undefined) return null;
  return `osm-${props.osm_type.charAt(0).toUpperCase()}${props.osm_id}`;
}

/** Cac cap hanh chinh, ghep tu nho den lon, bo phan vang. */
function addressOf(props: NonNullable<PhotonFeature['properties']>): string {
  return [
    [props.housenumber, props.street].filter(Boolean).join(' '),
    props.district,
    props.city ?? props.county,
    props.state,
  ]
    .filter((part) => part && part.trim() !== '')
    .join(', ');
}

function toPlace(feature: PhotonFeature): Place | null {
  const props = feature.properties;
  if (!props) return null;

  const id = stableId(props);
  if (!id) return null;

  const coords = feature.geometry?.coordinates;
  if (!coords) return null;
  const [lon, lat] = coords;
  // `Place.lat/lon` la BAT BUOC — mot ket qua khong co toa do thi khong ve duoc
  // ban do va khong tinh duoc tuyen.
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  // `name` la ten rieng ("Ho Hoan Kiem"); nhieu ket qua thuan dia chi khong co
  // `name`, khi do lay so nha + ten duong lam nhan.
  const street = [props.housenumber, props.street].filter(Boolean).join(' ');
  const label = props.name?.trim() || street || props.district || 'Không rõ';

  const address = addressOf(props);

  return {
    id,
    label,
    // Tranh lap lai chinh `label` ngay ben duoi no.
    address: address && address !== label ? address : (props.city ?? 'Việt Nam'),
    source: 'search',
    lat,
    lon,
  };
}

async function callPhotonSearch(query: PlaceQuery): Promise<Place[]> {
  const url = new URL(PHOTON_SEARCH_URL);
  url.searchParams.set('q', query.q);
  url.searchParams.set('limit', String(query.limit));
  url.searchParams.set('lang', 'default');
  // `bbox` cat cung ve Viet Nam; `lat`/`lon` xep uu tien quanh Ha Noi BEN TRONG
  // khung do. Hai tham so nay lam hai viec khac nhau va deu can.
  url.searchParams.set('bbox', VIETNAM_BBOX);
  url.searchParams.set('lat', String(HANOI_CENTER.lat));
  url.searchParams.set('lon', String(HANOI_CENTER.lon));

  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });

  if (!response.ok) throw new Error(`upstream ${response.status}`);

  const body = (await response.json()) as { features?: PhotonFeature[] };
  if (!Array.isArray(body.features)) return [];

  return body.features.map(toPlace).filter((place): place is Place => place !== null);
}

export function searchPlaces(query: PlaceQuery): Promise<Place[]> {
  return gate.run(`place::${query.q.trim().toLowerCase()}::${query.limit}`, () =>
    callPhotonSearch(query),
  );
}

/**
 * Toa do -> dia chi that. Day la thu bien "Vi tri hien tai" tu mot cai nhan vo
 * nghia thanh mot dia chi nguoi dung doc duoc truoc khi bam Dat don.
 *
 * Tra `null` khi Photon khong biet cho do la dau — goi y la KHONG chan luong:
 * FE giu nhan mac dinh va di tiep.
 */
async function callPhotonReverse(query: ReverseQuery): Promise<Place | null> {
  const url = new URL(PHOTON_REVERSE_URL);
  url.searchParams.set('lat', String(query.lat));
  url.searchParams.set('lon', String(query.lon));
  url.searchParams.set('lang', 'default');

  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });

  if (!response.ok) throw new Error(`upstream ${response.status}`);

  const body = (await response.json()) as { features?: PhotonFeature[] };
  const first = body.features?.[0];
  if (!first) return null;

  const place = toPlace(first);
  if (!place) return null;

  // Diem nay den tu GPS chu khong phai tu mot luot go tim, nen giu `id` rieng
  // de phan biet trong du lieu: `address_source` van la 'preset' (xem
  // use-current-place.ts), va mot id `osm-*` o day se lam no trong nhu nguoi
  // dung da tu chon mot dia chi.
  return { ...place, id: 'geo-current', source: 'preset' };
}

export function reversePlace(query: ReverseQuery): Promise<Place | null> {
  // Lam tron 4 chu so (~10m): rung chuot GPS khong pha cache, nhung di sang
  // mot dia chi khac thi van hoi lai.
  return gate.run(`reverse::${query.lat.toFixed(4)}::${query.lon.toFixed(4)}`, () =>
    callPhotonReverse(query),
  );
}
