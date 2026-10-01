/**
 * Ma xac thuc 6 so — KHONG dung database.
 *
 * Vi sao: gui/xac thuc ma ma phu thuoc database thi het han muc free tier
 * cua D1 la KHONG AI dang nhap duoc, ma dang nhap lai bat buoc.
 *
 * Thu thach OTP nam trong cookie httpOnly `gsm_otp` da ky HMAC:
 *   { p: phone, h: hash(ma), e: het han, n: nonce }
 * Ma THO khong nam trong cookie, chi co hash co tron AUTH_SECRET — doc duoc
 * cookie cung khong suy ra ma. Cookie di theo request nen serverless nhieu
 * instance van xac thuc duoc.
 *
 * Cooldown gui lai va dem so lan sai nam trong BO NHO tien trinh (best effort):
 * du cho mot app demo chay `next dev`; tren serverless nhieu instance thi gioi
 * han nay long hon — ghi ro o api-endpoints.md muc 5.
 */
import 'server-only';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { OTP_COOKIE } from '@/lib/shared';
import { getAuthSecret, seal, unseal } from './auth-token';
import { getSmsSender } from './sms.service';

const CODE_TTL_MS = 5 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

interface OtpState {
  /** phone -> thoi diem gui gan nhat. */
  lastSent: Map<string, number>;
  /** nonce -> so lan nhap sai. -1 = da dung xong (chan dung lai cookie cu). */
  attempts: Map<string, { count: number; expiresAt: number }>;
}

// globalThis: hot-reload cua `next dev` nap lai module, Map thuong se bi reset.
const globalForOtp = globalThis as typeof globalThis & { __gsmOtp?: OtpState };
const state: OtpState = (globalForOtp.__gsmOtp ??= {
  lastSent: new Map(),
  attempts: new Map(),
});

function prune(now: number): void {
  for (const [phone, at] of state.lastSent) {
    if (now - at > RESEND_COOLDOWN_MS) state.lastSent.delete(phone);
  }
  for (const [nonce, entry] of state.attempts) {
    if (entry.expiresAt < now) state.attempts.delete(nonce);
  }
}

function hashCode(phone: string, nonce: string, code: string): string {
  return createHash('sha256').update(`${getAuthSecret()}|${phone}|${nonce}|${code}`).digest('hex');
}

interface Challenge {
  p: string;
  h: string;
  e: number;
  n: string;
}

function readChallenge(token: string | undefined): Challenge | null {
  const data = unseal(token);
  if (!data) return null;
  try {
    const parsed = JSON.parse(data) as Partial<Challenge>;
    if (typeof parsed.p !== 'string' || typeof parsed.h !== 'string') return null;
    if (typeof parsed.e !== 'number' || typeof parsed.n !== 'string') return null;
    return parsed as Challenge;
  } catch {
    return null;
  }
}

export type SendCodeResult =
  | { ok: true; challenge: string; devCode?: string }
  | { ok: false; retryAfterMs: number };

export async function sendCode(phone: string): Promise<SendCodeResult> {
  const now = Date.now();
  prune(now);

  const lastSent = state.lastSent.get(phone);
  if (lastSent !== undefined && now - lastSent < RESEND_COOLDOWN_MS) {
    return { ok: false, retryAfterMs: RESEND_COOLDOWN_MS - (now - lastSent) };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const nonce = randomBytes(12).toString('base64url');
  const expiresAt = now + CODE_TTL_MS;

  const sender = getSmsSender();
  await sender.send(phone, `Ma xac thuc Green SM cua ban la ${code}. Het han sau 5 phut.`);
  // Chi tinh cooldown khi gui THANH CONG — gui loi thi cho thu lai ngay.
  state.lastSent.set(phone, now);
  state.attempts.set(nonce, { count: 0, expiresAt });

  const challenge = seal(JSON.stringify({ p: phone, h: hashCode(phone, nonce, code), e: expiresAt, n: nonce }));

  // Chi tra ma ve giao dien khi KHONG co tin nao duoc gui that, va khong phai
  // ban production — de test bang so that ma khong can nhin console.
  // Ngoai le OPT-IN: SMS_MOCK_EXPOSE_CODE=true (dat tren Vercel cho ban demo). Thieu
  // no thi production + mock = khong tin nhan nao den va ma cung khong hien => khong ai
  // dang nhap duoc. Bat no nghia la AI CUNG dang nhap duoc bang so bat ky — chap nhan
  // duoc cho app mo phong khong co du lieu that; can chat hon thi viet sender SMS that.
  const exposeCode =
    sender.isMock &&
    (process.env.NODE_ENV !== 'production' || process.env.SMS_MOCK_EXPOSE_CODE === 'true');
  return { ok: true, challenge, devCode: exposeCode ? code : undefined };
}

export type VerifyCodeResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'expired' | 'too_many_attempts' | 'wrong_code' };

export function verifyCode(
  phone: string,
  code: string,
  challengeToken: string | undefined,
): VerifyCodeResult {
  const now = Date.now();
  prune(now);

  const challenge = readChallenge(challengeToken);
  if (!challenge || challenge.p !== phone) return { ok: false, reason: 'not_found' };
  if (challenge.e < now) return { ok: false, reason: 'expired' };

  // Instance khac (serverless) khong biet nonce nay -> tao muc moi, van dem tu 0.
  const entry = state.attempts.get(challenge.n) ?? { count: 0, expiresAt: challenge.e };
  state.attempts.set(challenge.n, entry);
  if (entry.count < 0 || entry.count >= MAX_ATTEMPTS) {
    return { ok: false, reason: 'too_many_attempts' };
  }

  const expected = Buffer.from(challenge.h);
  const actual = Buffer.from(hashCode(phone, challenge.n, code));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    entry.count += 1;
    return { ok: false, reason: 'wrong_code' };
  }

  entry.count = -1; // da dung — gui lai dung cookie nay se bi tu choi
  return { ok: true };
}

export function otpCookie(challenge: string) {
  return {
    name: OTP_COOKIE,
    value: challenge,
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/api/auth',
    maxAge: CODE_TTL_MS / 1000,
  };
}
