/**
 * Chuan hoa so dien thoai Viet Nam ve dang E.164 (`+84xxxxxxxxx`).
 *
 * Dung chung client + server: client de bao loi ngay khi go, server de chot
 * gia tri that. So da chuan hoa chinh la `user_id` cua moi event, nen `0912…`
 * va `+84912…` PHAI ra cung mot chuoi — neu khong mot nguoi thanh hai user.
 */

export const AUTH_COOKIE = 'gsm_auth';
/** Thu thach OTP dang cho xac thuc (httpOnly, path /api/auth) — xem otp.service.ts. */
export const OTP_COOKIE = 'gsm_otp';

/**
 * `user_id` cua khach CHUA dang nhap: `anon-<uuid>` do client sinh (lib/session.ts).
 * Server chi nhan dang nay khi KHONG co cookie — moi gia tri khac bi 401.
 */
export const ANON_USER_PREFIX = 'anon-';
const ANON_USER_ID = /^anon-[A-Za-z0-9-]{8,64}$/;

export function isAnonUserId(id: unknown): id is string {
  return typeof id === 'string' && ANON_USER_ID.test(id);
}

/** Event chi nguoi DA dang nhap moi ghi duoc — hai event ket thuc funnel. */
export const AUTH_REQUIRED_EVENTS = ['confirm_ride', 'place_order'] as const;

/** 9 chu so sau dau so quoc gia, chu so dau la 3/5/7/8/9 (di dong VN). */
const VN_MOBILE = /^[35789]\d{8}$/;

export function normalizeVnPhone(input: string): string | null {
  const digits = input.replace(/[\s.\-()]/g, '');
  let local: string;
  if (digits.startsWith('+84')) local = digits.slice(3);
  else if (digits.startsWith('84') && digits.length === 11) local = digits.slice(2);
  else if (digits.startsWith('0')) local = digits.slice(1);
  else return null;
  return VN_MOBILE.test(local) ? `+84${local}` : null;
}

/** `+84912345678` → `0912 345 678` — chi de hien thi. */
export function formatVnPhone(e164: string): string {
  const local = `0${e164.slice(3)}`;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}
