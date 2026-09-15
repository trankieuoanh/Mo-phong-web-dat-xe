'use client';

/**
 * Helper ghi event. Hop dong day du: screen-map.md muc 4.
 *
 * `flow` va `step_index` mac dinh TRA TU BANG SCREENS trong @gsm/shared,
 * khong go tay o tung page — vi step_index sai la loi khong co trieu chung:
 * app van chay dep, chi co funnel sai, va chi phat hien ra o Tuan 5.
 */

import { useEffect, useRef } from 'react';
import {
  ADD_TO_CART_STEP_INDEX,
  SCREENS,
  type EventName,
  type EventPayload,
  type Flow,
  type ScreenName,
} from '@gsm/shared';
import { getSessionId, getUserId } from './session';

/**
 * Man truoc do trong lich su dieu huong.
 *
 * Bien module-level, cap nhat moi lan `screen_view` ban — KHONG suy ra tu route,
 * vi Back cua trinh duyet se lam moi suy luan tu route sai (screen-map.md muc 4).
 * O lai mot man va ban nhieu event thi gia tri nay khong doi.
 */
let previousScreen: ScreenName | null = null;

/** Goi khi reset session — man ke tiep phai co previous_screen = null. */
export function resetPreviousScreen(): void {
  previousScreen = null;
}

export interface TrackEventInput {
  eventName: EventName;
  screenName: ScreenName;
  /** Mac dinh: SCREENS[screenName].flow. Chi truyen tay cho `select_flow` o man home. */
  flow?: Flow;
  /** Mac dinh: SCREENS[screenName].stepIndex. Chi truyen tay cho `add_to_cart` (= 3). */
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

    trackEvent({ eventName: 'screen_view', screenName });

    // Cap nhat SAU khi ban, de chinh event screen_view nay van mang man truoc do.
    previousScreen = screenName;
  }, [screenName]);
}
