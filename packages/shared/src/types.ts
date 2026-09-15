/**
 * Hop dong du lieu cua toan du an.
 * Nguon su that: event-taxonomy.md — sua file do TRUOC khi sua file nay.
 */

/** Luong nguoi dung. `none` danh cho man `home` — luc do chua chon luong nao. */
export type Flow = 'ride' | 'food';
export type FlowValue = Flow | 'none';

/** event-taxonomy.md muc 5 — 19 gia tri. */
export type EventName =
  // chung
  | 'screen_view'
  | 'back'
  | 'back_to_home'
  | 'select_flow'
  // ride
  | 'select_address'
  | 'confirm_pickup'
  | 'change_address'
  | 'select_vehicle'
  | 'select_promo'
  | 'skip_promo'
  | 'confirm_ride'
  // food
  | 'select_item'
  | 'change_quantity'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'proceed_to_offer'
  | 'select_offer'
  | 'skip_offer'
  | 'place_order';

/** event-taxonomy.md muc 2 — 13 man hinh. */
export type ScreenName =
  | 'home'
  | 'address_selection'
  | 'pickup_confirm'
  | 'vehicle_selection'
  | 'promo_selection'
  | 'ride_confirm'
  | 'ride_success'
  | 'food_menu'
  | 'food_item_detail'
  | 'food_cart'
  | 'food_offer_selection'
  | 'food_confirm'
  | 'food_success';

/**
 * Body cua POST /api/events — 8 field client gui len.
 * `platform` va `created_at` do server tu gan, xem api-endpoints.md muc 1.
 */
export interface EventPayload {
  session_id: string;
  user_id: string;
  flow: FlowValue;
  event_name: EventName;
  screen_name: ScreenName;
  previous_screen: ScreenName | null;
  step_index: number;
  properties: Record<string, unknown>;
}

/** Document trong collection `events` — xem db-design.md. */
export interface EventDoc extends EventPayload {
  platform: 'web';
  /** Firestore server timestamp; doc ra thi la chuoi ISO. */
  created_at: string;
}

/** Ket qua tra ve cua POST /api/events. */
export interface CreateEventResponse {
  event_id: string;
  /** Xap xi, tinh tai route. Gia tri chuan dung cho phan tich la `created_at` trong Firestore. */
  created_at: string;
}

export interface ApiErrorResponse {
  error: string;
}

/** Runtime list — dung de validate o apps/api. Giu dong bo voi union EventName. */
export const EVENT_NAMES = [
  'screen_view',
  'back',
  'back_to_home',
  'select_flow',
  'select_address',
  'confirm_pickup',
  'change_address',
  'select_vehicle',
  'select_promo',
  'skip_promo',
  'confirm_ride',
  'select_item',
  'change_quantity',
  'add_to_cart',
  'remove_from_cart',
  'proceed_to_offer',
  'select_offer',
  'skip_offer',
  'place_order',
] as const satisfies readonly EventName[];

export const FLOW_VALUES = ['ride', 'food', 'none'] as const satisfies readonly FlowValue[];

/**
 * Chan viec them gia tri vao union EventName ma quen them vao EVENT_NAMES.
 * `satisfies` chi kiem tra chieu nguoc lai, nen thieu dong nay validator o apps/api
 * se lang le tu choi mot event name hoan toan hop le.
 */
type MissingEventNames = Exclude<EventName, (typeof EVENT_NAMES)[number]>;
const _eventNamesAreExhaustive: MissingEventNames extends never ? true : MissingEventNames = true;
void _eventNamesAreExhaustive;

export function isEventName(value: unknown): value is EventName {
  return typeof value === 'string' && (EVENT_NAMES as readonly string[]).includes(value);
}

export function isFlowValue(value: unknown): value is FlowValue {
  return typeof value === 'string' && (FLOW_VALUES as readonly string[]).includes(value);
}
