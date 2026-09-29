/**
 * GET /api/auth/me — so dien thoai cua cookie hien tai, hoac 401.
 * Khong cham Firestore: chi kiem chu ky cookie.
 */
import type { NextRequest } from 'next/server';
import { readAuth } from '@/lib/server/services/auth-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const phone = readAuth(request);
  if (!phone) return Response.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  return Response.json({ phone });
}
