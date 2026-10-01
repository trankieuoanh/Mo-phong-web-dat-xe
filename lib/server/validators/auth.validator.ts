/**
 * Validate body cua /api/auth/send-code va /api/auth/verify.
 */
import 'server-only';
import { normalizeVnPhone } from '@/lib/shared';

export type AuthValidation<T> = { ok: true; value: T } | { ok: false; error: string };

function readPhone(body: unknown): AuthValidation<string> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'Body phải là JSON object' };
  }
  const raw = (body as Record<string, unknown>).phone;
  const phone = typeof raw === 'string' ? normalizeVnPhone(raw) : null;
  return phone ? { ok: true, value: phone } : { ok: false, error: 'Số điện thoại không hợp lệ' };
}

export function validateSendCode(body: unknown): AuthValidation<{ phone: string }> {
  const phone = readPhone(body);
  return phone.ok ? { ok: true, value: { phone: phone.value } } : phone;
}

export function validateVerify(body: unknown): AuthValidation<{ phone: string; code: string }> {
  const phone = readPhone(body);
  if (!phone.ok) return phone;
  const code = (body as Record<string, unknown>).code;
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    return { ok: false, error: 'Mã xác thực phải gồm 6 chữ số' };
  }
  return { ok: true, value: { phone: phone.value, code } };
}
