/**
 * Cookie dang nhap `gsm_auth` = `<payload>.<chu ky>`, payload la
 * base64url(`<phone>|<het han ms>`), chu ky HMAC-SHA256 bang AUTH_SECRET.
 *
 * Khong luu session o Firestore: xac thuc la mot phep bam, khong ton luot doc.
 * Doi lai khong thu hoi tung token duoc — doi AUTH_SECRET la dang xuat tat ca.
 */
import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { AUTH_COOKIE } from '@/lib/shared';

export const AUTH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('Thieu AUTH_SECRET (>= 32 ky tu) trong .env.local — xem setup.md.');
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac('sha256', getAuthSecret()).update(payload).digest('base64url');
}

/** `<base64url(data)>.<HMAC>` — dung chung cho cookie dang nhap va cookie OTP. */
export function seal(data: string): string {
  const payload = Buffer.from(data).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

/** Tra lai `data` neu chu ky dung, nguoc lai `null`. KHONG kiem han — nguoi goi tu kiem. */
export function unseal(token: string | undefined): string | null {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return Buffer.from(payload, 'base64url').toString();
}

export function signToken(phone: string): string {
  return seal(`${phone}|${Date.now() + AUTH_MAX_AGE_SECONDS * 1000}`);
}

/** Tra so dien thoai neu token hop le va con han, nguoc lai `null`. */
export function verifyToken(token: string | undefined): string | null {
  const data = unseal(token);
  if (!data) return null;
  const [phone, expiresAt] = data.split('|');
  if (!phone || !(Number(expiresAt) > Date.now())) return null;
  return phone;
}

export function readAuth(request: NextRequest): string | null {
  return verifyToken(request.cookies.get(AUTH_COOKIE)?.value);
}

export function authCookie(token: string) {
  return {
    name: AUTH_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: AUTH_MAX_AGE_SECONDS,
  };
}
