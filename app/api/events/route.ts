/**
 * POST /api/events — ghi 1 event
 * GET  /api/events — doc event theo session_id / user_id / flow / from / to
 *
 * Hop dong day du o api-endpoints.md.
 *
 * KHONG CO AUTHENTICATION — day la quyet dinh co chu y, khong phai thieu sot,
 * va da duoc ghi tu dau o api-endpoints.md. Gop ve mot app Next.js nghia la
 * trinh duyet goi THANG vao day, nen khong con cho nao giau mot khoa chia se:
 * bat cu thu gi `lib/track.ts` gui duoc thi nguoi dung cung doc duoc trong
 * bundle. Nguyen tac vi vay giu nguyen: SINH XONG DU LIEU PHAN TICH ROI HAY
 * DEPLOY CONG KHAI.
 */
import type { NextRequest } from 'next/server';
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
    const events = await listEvents(result.value);
    return Response.json(events);
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
