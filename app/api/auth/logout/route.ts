/**
 * POST /api/auth/logout — xoa cookie dang nhap.
 */
import { NextResponse } from 'next/server';
import { AUTH_COOKIE } from '@/lib/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(AUTH_COOKIE);
  return response;
}
