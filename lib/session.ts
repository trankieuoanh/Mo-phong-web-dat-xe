/**
 * session_id / user_id — client-only. Nguon: screen-map.md muc 2.
 *
 * crypto.randomUUID() chi chay duoc phia client, va sessionStorage/localStorage
 * khong ton tai luc render phia server. Vi vay MOI ham o day chi duoc goi trong
 * useEffect hoac trong event handler, KHONG goi luc render — neu khong se loi
 * hydration mismatch cua Next.js.
 */

import { ANON_USER_PREFIX } from '@/lib/shared/phone';

const SESSION_KEY = 'gsm_session_id';
const USER_KEY = 'gsm_user_id';
const ANON_KEY = 'gsm_anon_id';

/**
 * Cac khoa draft bi xoa khi reset session.
 *
 * `gsm_ride_draft` (khong hau to) la khoa CU, hinh dang khac han — giu lai o day
 * de lan reset dau tien don not no khoi sessionStorage cua nguoi dung.
 */
export const DRAFT_KEYS = [
  'gsm_ride_draft_v2',
  'gsm_ride_draft',
  'gsm_cart',
  'gsm_offer',
  'gsm_food_draft',
] as const;

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * 1 session = 1 lan thu hoan thanh luong. Song trong mot tab.
 */
export function getSessionId(): string {
  if (!isBrowser()) return '';
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

/**
 * So dien thoai da dang nhap (E.164, vd `+84912345678`) — chinh la `user_id`.
 *
 * Chi la BAN SAO de giao dien hien thi / loc /history: nguon that la cookie
 * httpOnly `gsm_auth`, va POST /api/events ghi de `user_id` bang cookie do.
 * Chua dang nhap thi tra chuoi rong — KHONG con sinh `mock-user-*` nua.
 */
export function getUserId(): string {
  if (!isBrowser()) return '';
  return localStorage.getItem(USER_KEY) ?? '';
}

/**
 * `user_id` tam cho khach CHUA dang nhap — `anon-<uuid>`, ben qua F5/tab (localStorage).
 * Server chi nhan no khi khong co cookie; sau khi dang nhap server ghi de bang SDT,
 * con `session_id` giu nguyen nen funnel van lien mach.
 */
export function getAnonId(): string {
  if (!isBrowser()) return '';
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = `${ANON_USER_PREFIX}${crypto.randomUUID()}`;
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    // Storage bi chan: van phai co id hop le de event khong bi 401.
    return `${ANON_USER_PREFIX}${crypto.randomUUID()}`;
  }
}

export function setUserId(phone: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(USER_KEY, phone);
}

/** Goi khi dang xuat hoac khi cookie khong con hop le. */
export function clearUser(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(USER_KEY);
}

/**
 * Sinh session_id MOI va xoa toan bo draft. Goi khi bam `back_to_home` o man success.
 *
 * Vi sao bat buoc: neu khong reset, mot nguoi click 5 lan se nam chung mot session,
 * va MOI ti le conversion deu sai. `user_id` giu nguyen — do la cung mot nguoi.
 */
export function resetSession(): string {
  if (!isBrowser()) return '';
  const id = crypto.randomUUID();
  sessionStorage.setItem(SESSION_KEY, id);
  for (const key of DRAFT_KEYS) sessionStorage.removeItem(key);
  return id;
}
