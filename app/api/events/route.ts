/**
 * POST /api/events — ghi 1 event
 * GET  /api/events — doc event theo session_id / user_id / flow / from / to
 *
 * Hop dong day du o api-endpoints.md.
 *
 * POST BAT BUOC DANG NHAP: `user_id` lay tu cookie `gsm_auth` (so dien thoai
 * E.164), GHI DE gia tri client gui len — client khong gia mao duoc user.
 * GET van mo (analysis / Power BI goi thang) — xem api-endpoints.md.
 */
import type { NextRequest } from 'next/server';
import { readAuth } from '@/lib/server/services/auth-token';
import { createEvent, listEvents } from '@/lib/server/services/event.service';
import {
  validateEventPayload,
  validateEventQuery,
} from '@/lib/server/validators/event.validator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Tran kich thuoc body, thay cho `express.json({ limit: '64kb' })` cua ban cu.
 *
 * Mot event hop le nang vai tram byte; 64kb la rong rai gap tram lan. Gioi han
 * nay khong de toi uu ma de mot body khong lo khong kip di xa hon vao validator.
 */
const MAX_BODY_BYTES = 64 * 1024;

export async function POST(request: NextRequest) {
  const phone = readAuth(request);
  if (!phone) {
    return Response.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return Response.json({ error: 'Body quá lớn' }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    // Express tra 400 cho JSON hong; giu nguyen hanh vi do.
    return Response.json({ error: 'Body không phải JSON hợp lệ' }, { status: 400 });
  }

  // Ghi de TRUOC khi validate: client co the chua kip co ban sao SDT trong
  // localStorage (vd. vua xoa storage) — cookie moi la nguon that.
  if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
    body = { ...body, user_id: phone };
  }

  const result = validateEventPayload(body);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  try {
    const created = await createEvent(result.value);
    return Response.json(created, { status: 201 });
  } catch (error) {
    // Log day du phia server, tra thong bao gon cho client.
    console.error('[POST /api/events] ghi Firestore that bai:', error);
    return Response.json({ error: 'Could not write event' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const result = validateEventQuery(request.nextUrl.searchParams);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  try {
    const { events, cacheStatus } = await listEvents(result.value);
    // Body giu nguyen; header chi de kiem tra cache co trung khong (curl -D-).
    return Response.json(events, { headers: { 'X-Cache': cacheStatus } });
  } catch (error) {
    // Query ket hop where + orderBy tren 2 field khac nhau se bi Firestore tu choi
    // KEM MOT LINK TAO INDEX san trong thong bao loi. Bam link do, doi ~1 phut, chay lai.
    // Vi vay message loi that duoc tra ve nguyen van — no chua duong dan can di.
    console.error('[GET /api/events] doc Firestore that bai:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Could not read events' },
      { status: 500 },
    );
  }
}
