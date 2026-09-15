/**
 * Bang man hinh — ma hoa bang o event-taxonomy.md muc 2, MOT LAN DUY NHAT.
 *
 * Vi sao khong go `step_index` truc tiep o tung page: go tay o 13 file la nguon
 * sai so lieu so mot, va sai kieu do KHONG CO TRIEU CHUNG — app van chay dep,
 * chi co funnel sai, va chi phat hien ra o Tuan 5 khi da sinh xong du lieu.
 */
import type { FlowValue, ScreenName } from './types';

export interface ScreenSpec {
  /** Route trong apps/web. */
  route: string;
  /** Vi tri buoc trong funnel — SO CO DINH cho tung man, khong phai bo dem. */
  stepIndex: number;
  flow: FlowValue;
}

export const SCREENS: Record<ScreenName, ScreenSpec> = {
  // chung
  home: { route: '/', stepIndex: 0, flow: 'none' },

  // ride
  address_selection: { route: '/ride/address', stepIndex: 1, flow: 'ride' },
  pickup_confirm: { route: '/ride/pickup', stepIndex: 2, flow: 'ride' },
  vehicle_selection: { route: '/ride/vehicle', stepIndex: 3, flow: 'ride' },
  promo_selection: { route: '/ride/promo', stepIndex: 4, flow: 'ride' },
  ride_confirm: { route: '/ride/confirm', stepIndex: 5, flow: 'ride' },
  ride_success: { route: '/ride/success', stepIndex: 6, flow: 'ride' },

  // food
  food_menu: { route: '/food', stepIndex: 1, flow: 'food' },
  food_item_detail: { route: '/food/item/[itemId]', stepIndex: 2, flow: 'food' },
  food_cart: { route: '/food/cart', stepIndex: 4, flow: 'food' },
  food_offer_selection: { route: '/food/offer', stepIndex: 5, flow: 'food' },
  food_confirm: { route: '/food/confirm', stepIndex: 6, flow: 'food' },
  food_success: { route: '/food/success', stepIndex: 7, flow: 'food' },
};

/**
 * step_index cua hanh dong `add_to_cart` — luon la 3, du ban o `food_menu`
 * hay `food_item_detail`. Day la buoc funnel duy nhat khong phai mot man hinh,
 * nen khong nam trong SCREENS. Xem event-taxonomy.md muc 4.
 */
export const ADD_TO_CART_STEP_INDEX = 3;

export const SCREEN_NAMES = Object.keys(SCREENS) as ScreenName[];

export function isScreenName(value: unknown): value is ScreenName {
  return typeof value === 'string' && value in SCREENS;
}
