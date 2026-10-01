'use client';

/**
 * Helper ghi event. Hop dong day du: screen-map.md muc 4.
 *
 * `flow` va `step_index` mac dinh TRA TU BANG SCREENS trong lib/shared,
 * khong go tay o tung page — vi step_index sai la loi khong co trieu chung:
 * app van chay dep, chi co funnel sai, va chi phat hien ra o Tuan 5.
 */

import { useEffect, useRef } from 'react';
import {
  ADD_TO_CART_STEP_INDEX,
  SCREENS,
  SELECT_FLOW_STEP_INDEX,
  type EventName,
  type EventPayload,
  type Flow,
  type ScreenName,
} from '@/lib/shared';
import { getSessionId, getUserId } from './session';

/**
 * Man truoc do trong lich su dieu huong.
 *
 * Bien module-level, cap nhat moi lan `screen_view` ban — KHONG suy ra tu route,
 * vi Back cua trinh duyet se lam moi suy luan tu route sai (screen-map.md muc 4).
 * O lai mot man va ban nhieu event thi gia tri nay khong doi.
 */
let previousScreen: ScreenName | null = null;

/**
 * Man DANG dung. Tach rieng khoi `previousScreen` vi mot ly do cu the:
 * neu chi co mot bien va gan no = man hien tai ngay sau khi screen_view ban,
 * thi moi event HANH DONG bat sau do tren cung man se doc phai chinh man do
 * thay vi man truoc. Loi nay khong co trieu chung tren UI — chi lo ra khi
 * doc du lieu that (da tung xay ra, xem event-taxonomy.md muc 1).
 */
let currentScreen: ScreenName | null = null;

const SELECTED_FLOWS_KEY_PREFIX = 'gsm_selected_flows:';
const selectedFlowsInMemory = new Map<string, Set<Flow>>();

function selectedFlowsKey(sessionId: string): string {
  return `${SELECTED_FLOWS_KEY_PREFIX}${sessionId}`;
}

function selectedFlowsFor(sessionId: string): Set<Flow> {
  const selected = new Set<Flow>(selectedFlowsInMemory.get(sessionId));

  if (typeof window !== 'undefined') {
    try {
      const stored: unknown = JSON.parse(
        window.sessionStorage.getItem(selectedFlowsKey(sessionId)) ?? '[]',
      );

      if (Array.isArray(stored)) {
        for (const flow of stored) {
          if (flow === 'ride' || flow === 'food') selected.add(flow);
        }
      }
    } catch {}
  }

  selectedFlowsInMemory.set(sessionId, selected);
  return selected;
}

function markSelectedFlow(sessionId: string, flow: Flow): void {
  const selected = selectedFlowsFor(sessionId);
  selected.add(flow);

  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(
        selectedFlowsKey(sessionId),
        JSON.stringify(Array.from(selected)),
      );
    } catch {}
  }
}

function hasSelectedFlow(sessionId: string, flow: Flow): boolean {
  return selectedFlowsFor(sessionId).has(flow);
}

/** Goi khi reset session — man ke tiep phai co previous_screen = null. */
export function resetPreviousScreen(): void {
  previousScreen = null;
  currentScreen = null;
}

export interface TrackEventInput {
  eventName: EventName;
  screenName: ScreenName;
  /** Mac dinh: SCREENS[screenName].flow. Chi truyen tay qua `trackSelectFlow`. */
  flow?: Flow;
  /** Mac dinh: SCREENS[screenName].stepIndex. Chi truyen tay qua hai helper duoi. */
  stepIndex?: number;
  properties?: Record<string, unknown>;
}

/**
 * Tra ve void, KHONG phai Promise — khong ai await duoc, nen khong the vo tinh
 * chan dieu huong. Day la loi de mac nhat trong loai app nay: await truoc
 * router.push lam UI khung ~200ms moi lan bam.
 */
export function trackEvent(input: TrackEventInput): void {
  const spec = SCREENS[input.screenName];

  const body: EventPayload = {
    session_id: getSessionId(),
    user_id: getUserId(),
    flow: input.flow ?? spec.flow,
    event_name: input.eventName,
    screen_name: input.screenName,
    previous_screen: previousScreen,
    step_index: input.stepIndex ?? spec.stepIndex,
    properties: input.properties ?? {},
  };

  fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    // Event cuoi (`confirm_ride`, `place_order`) van gui duoc khi dieu huong
    // xay ra ngay sau do.
    keepalive: true,
    // Khong retry, khong hang doi offline — ngoai pham vi 6 tuan.
    // API loi hoac mang rot TUYET DOI khong duoc lam vo luong UI:
    // mat mot event chap nhan duoc, ket nguoi dung thi khong.
  }).catch(() => {});

  try {
    const stored: unknown = JSON.parse(localStorage.getItem('gsm_event_log') ?? '[]');
    const events: unknown[] = Array.isArray(stored) ? stored : [];
    events.push({ ...body, client_created_at: new Date().toISOString() });
    localStorage.setItem('gsm_event_log', JSON.stringify(events));
  } catch {}
}

/** `add_to_cart` luon mang step_index = 3 du ban o man nao. */
export function trackAddToCart(
  screenName: Extract<ScreenName, 'food_menu' | 'food_item_detail'>,
  properties: Record<string, unknown>,
): void {
  trackEvent({
    eventName: 'add_to_cart',
    screenName,
    stepIndex: ADD_TO_CART_STEP_INDEX,
    properties,
  });
}

/**
 * Man dau cua moi luong — ba cho duy nhat `select_flow` duoc phep ban.
 *
 * Kieu hep de compiler chan luon viec goi tu man thu tu: nhay luong tu giua
 * luong tao session lai khong phan tich duoc (SideRail.tsx).
 */
export type FlowEntryScreen = Extract<ScreenName, 'home' | 'address_selection' | 'food_menu'>;

/**
 * `select_flow` luon mang step_index = 0 va flow = luong VUA CHON, du ban o man
 * nao — xem SELECT_FLOW_STEP_INDEX trong lib/shared.
 *
 * Phai ban DONG BO ngay truoc `router.push`, khong duoc doi sang ban trong
 * useEffect cua man dich: lam vay `previous_screen` lech mot nac va loi do
 * khong co trieu chung tren UI.
 */
export function trackSelectFlow(screenName: FlowEntryScreen, flow: Flow): void {
  markSelectedFlow(getSessionId(), flow);
  trackEvent({
    eventName: 'select_flow',
    screenName,
    flow,
    stepIndex: SELECT_FLOW_STEP_INDEX,
    properties: { flow_chosen: flow },
  });
}

function trackScreenView(screenName: ScreenName): void {
  previousScreen = currentScreen;
  currentScreen = screenName;
  trackEvent({ eventName: 'screen_view', screenName });
}

/**
 * Ban `screen_view` mot lan khi man mount, roi cap nhat `previousScreen`.
 *
 * useRef chan lan chay thu hai cua React Strict Mode trong `next dev`.
 * Thieu no thi MOI screen_view bi nhan doi va funnel sai gap doi — day la
 * bay phai xu ly ngay tu man dau tien (screen-map.md muc 4).
 */
export function useScreenView(screenName: ScreenName): void {
  const hasFired = useRef(false);

  useEffect(() => {
    if (hasFired.current) return;
    hasFired.current = true;

    // Cap nhat TRUOC khi ban: man vua roi khoi tro thanh `previousScreen`,
    // man nay tro thanh `currentScreen`. Nho vay `screen_view` VA moi event
    // hanh dong bat sau do tren cung man deu mang cung mot `previous_screen`
    // — dung quy tac o event-taxonomy.md muc 1.
    trackScreenView(screenName);
  }, [screenName]);
}

export function useFlowEntryView(
  screenName: Exclude<FlowEntryScreen, 'home'>,
): void {
  const hasFired = useRef(false);

  useEffect(() => {
    if (hasFired.current) return;
    hasFired.current = true;

    const flow = SCREENS[screenName].flow;
    if (flow === 'none') {
      throw new Error('Flow entry screen phai thuoc mot funnel');
    }

    const sessionId = getSessionId();
    if (!hasSelectedFlow(sessionId, flow)) {
      markSelectedFlow(sessionId, flow);
      trackEvent({
        eventName: 'select_flow',
        screenName,
        flow,
        stepIndex: SCREENS.home.stepIndex,
        properties: {
          flow_chosen: flow,
          entry_source: 'direct_url',
        },
      });
    }

    trackScreenView(screenName);
  }, [screenName]);
}
