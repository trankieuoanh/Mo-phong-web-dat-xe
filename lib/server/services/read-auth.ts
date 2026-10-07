/**
 * Ai duoc DOC du lieu phan tich (GET /api/events, GET /api/analytics/*).
 *
 * `ANALYTICS_TOKEN` TUY CHON:
 *   - de trong  -> mo nhu truoc (khong doi hanh vi nao, Power BI goi khong can header).
 *   - co gia tri -> yeu cau `Authorization: Bearer <token>`.
 * Ngoai le khi co token: nguoi dung DA DANG NHAP duoc doc lich su CUA CHINH HO
 * (`GET /api/events?user_id=<SDT cua cookie>`), nen man /history khong bi gay.
 *
 * `events` chua so dien thoai that — dat token khi deploy cong khai.
 */
import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { readAuth } from './auth-token';

function bearerMatches(header: string | null, token: string): boolean {
  const match = /^Bearer (.+)$/.exec(header ?? '');
  if (!match) return false;
  const given = Buffer.from(match[1]!);
  const expected = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function isReadAllowed(request: NextRequest, ownUserId?: string): boolean {
  const token = process.env.ANALYTICS_TOKEN;
  if (!token) return true;
  if (bearerMatches(request.headers.get('authorization'), token)) return true;
  if (ownUserId) {
    try {
      if (readAuth(request) === ownUserId) return true;
    } catch {
      // Thieu AUTH_SECRET: coi nhu khong co cookie.
    }
  }
  return false;
}
