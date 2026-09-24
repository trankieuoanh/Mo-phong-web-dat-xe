/**
 * Hop dong cua API tra cuu dia chi — `GET /api/places`.
 *
 * De rieng khoi types.ts co chu y: types.ts la hop dong EVENT (nguon su that
 * la event-taxonomy.md), con file nay la hop dong cua mot endpoint tra cuu.
 * Gop chung se lam nguoi doc tuong `Place` cung phai co trong taxonomy.
 */
import { ADDRESSES, FIXED_PICKUP, type Address } from './mock-data';

/**
 * `preset` = mot trong 5 dia chi goi y o mock-data.md muc 1 (hoac diem don
 * mac dinh). `search` = nguoi dung tu go tim, du lieu tu Photon.
 * `map` = nguoi dung tu bam mot diem tren ban do.
 *
 * Gia tri nay di THANG vao properties cua `select_address` / `confirm_pickup`
 * / `change_address` / `confirm_ride` — xem event-taxonomy.md.
 *
 * VI SAO `map` TACH RIENG chu khong gop vao `search`: analysis-spec.md dinh
 * nghia `search_usage_rate` la "nguoi dung co THUC SU can o tim khong, hay 5
 * goi y da du". Gop luot bam tren ban do vao do thi chi so nay tra loi sai mot
 * cau hoi UX that. Ba cach chon dia chi la ba hanh vi khac nhau, nen dem rieng.
 */
export type PlaceSource = 'preset' | 'search' | 'map';

/**
 * `id` cua mot diem bam tren ban do: `map-<lat>-<lon>` lam tron 5 chu so (~1 m).
 *
 * Suy tu chinh toa do chu KHONG random: hai lan bam cung mot cho phai ra cung
 * mot id, khong thi khong bao gio gom nhom duoc (CLAUDE.md quy tac 5).
 */
export function mapPlaceId(lat: number, lon: number): string {
  return `map-${lat.toFixed(5)}-${lon.toFixed(5)}`;
}

/**
 * Mot dia diem, du den tu ADDRESSES hay tu Nominatim.
 *
 * `id` cua nhanh `search` la `osm-<osm_type><osm_id>` (vi du `osm-N240109189`),
 * KHONG phai `place_id` cua Nominatim — `place_id` doi moi lan ho build lai co
 * so du lieu, dung no thi du lieu tuan nay khong ghep duoc voi tuan sau
 * (CLAUDE.md quy tac 5).
 */
export interface Place {
  id: string;
  /** Ten ngan, hien thi dam. */
  label: string;
  /** Dia chi day du, hien thi mo ben duoi. */
  address: string;
  source: PlaceSource;
  /**
   * BAT BUOC — moi nguon dia chi deu co toa do: 5 goi y va diem don mac dinh
   * hardcode trong mock-data.ts, con ket qua tim duoc lay tu Nominatim.
   *
   * De optional nghia la moi cho ve ban do phai viet mot nhanh "khong co toa
   * do" khong bao gio chay, va TypeScript khong con bat duoc loi quen gan.
   */
  lat: number;
  lon: number;
}

/**
 * Mot quan an THAT tren OpenStreetMap — `Place` cong cac tag OSM doc duoc.
 *
 * Moi truong duoi day deu la DU LIEU THAT tu `extratags` cua Nominatim, khong
 * phai mock. Nhung OSM la du lieu cong dong nen phu song thua: trong mau 120
 * quan o Ha Noi, chi 50% co `cuisine`, va it hon nua co `openingHours`.
 * Vi vay cac truong nay deu optional/rong duoc, va UI phai doc duoc khi thieu —
 * loc bo quan thieu tag se lam danh sach "gan ban" rong mot cach kho hieu.
 */
export interface Restaurant extends Place {
  /**
   * Tag `cuisine` da tach theo `;`. RONG khi quan khong khai bao.
   * Gia tri con nguyen van OSM (`vietnamese`, `thịt_nướng`, `hàn_quốc`...) —
   * viec quy doi ve kieu bep cua ta nam o `cuisinesOf()` trong food.ts.
   */
  cuisine: string[];
  /** Tag `opening_hours` nguyen van, vi du "Mo-Su 09:00-20:00" hoac "24/7". */
  openingHours?: string;
  phone?: string;
}

/** Dia chi goi y -> Place, de hai nguon dung chung mot hinh dang trong UI. */
export function presetToPlace(address: Address): Place {
  return {
    id: address.id,
    label: address.label,
    address: address.address,
    source: 'preset',
    lat: address.lat,
    lon: address.lon,
  };
}

/** 5 dia chi goi y duoi dang Place — hien khi o tim con trong. */
export const PRESET_PLACES: Place[] = ADDRESSES.map(presetToPlace);

/**
 * Diem don mac dinh. KHONG phai hang so bat bien nua — man `pickup_confirm`
 * co o tim, day chi la gia tri khoi tao. Xem mock-data.md muc 1.
 */
export const DEFAULT_PICKUP: Place = {
  id: FIXED_PICKUP.id,
  label: FIXED_PICKUP.label,
  address: FIXED_PICKUP.address,
  source: 'preset',
  lat: FIXED_PICKUP.lat,
  lon: FIXED_PICKUP.lon,
};

/** true = nguoi dung da doi khoi diem don do GPS de xuat. */
export function isPickupChanged(pickup: Place): boolean {
  return pickup.id !== DEFAULT_PICKUP.id;
}
