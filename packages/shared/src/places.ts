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
 * mac dinh). `search` = nguoi dung tu go tim, du lieu tu Nominatim.
 *
 * Gia tri nay di THANG vao properties cua `select_address` / `confirm_pickup`
 * / `confirm_ride` — xem event-taxonomy.md.
 */
export type PlaceSource = 'preset' | 'search';

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
  /** Chi co o nhanh `search` va o diem don mac dinh. Hien chua dung de ve ban do. */
  lat?: number;
  lon?: number;
}

/** Dia chi goi y -> Place, de hai nguon dung chung mot hinh dang trong UI. */
export function presetToPlace(address: Address): Place {
  return {
    id: address.id,
    label: address.label,
    address: address.address,
    source: 'preset',
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
};

/** true = nguoi dung da doi khoi diem don do GPS de xuat. */
export function isPickupChanged(pickup: Place): boolean {
  return pickup.id !== DEFAULT_PICKUP.id;
}
