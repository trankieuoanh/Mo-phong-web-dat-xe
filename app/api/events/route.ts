/**
 * POST /api/events — ghi 1 event
 * GET  /api/events — doc event theo session_id / user_id / flow / from / to
 *
 * Hop dong day du o api-endpoints.md.
 *
 * POST: co cookie `gsm_auth` hop le -> `user_id` = so dien thoai E.164, GHI DE gia
 * tri client gui len (client khong gia mao duoc user). KHONG co cookie -> khach
 * chua dang nhap: chi nhan `user_id` dang `anon-<id>`, gia tri khac bi 401.
 * `confirm_ride` / `place_order` BAT BUOC co cookie — day moi la cho yeu cau dang nhap.
 * GET van mo (analysis / Power BI goi thang) — xem api-endpoints.md.
 */
import type { NextRequest } from 'next/server';
import { readAuth } from '@/lib/server/services/auth-token';
import { createEvent, listEvents } from '@/lib/server/services/event.service';
import { AUTH_REQUIRED_EVENTS, isAnonUserId } from '@/lib/shared';
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

  if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
    const raw = body as Record<string, unknown>;
    if (phone) {
      // Ghi de TRUOC khi validate: client co the chua kip co ban sao SDT trong
      // localStorage (vd. vua xoa storage) — cookie moi la nguon that.
      body = { ...raw, user_id: phone };
    } else {
      // Khach: chi id an danh hop le moi duoc ghi. Khong tin user_id tuy y.
      if (!isAnonUserId(raw.user_id)) {
        return Response.json({ error: 'Chưa đăng nhập' }, { status: 401 });
      }
      // Chan o SERVER de khong ne duoc bang curl: dat xe/dat don can SDT.
      if ((AUTH_REQUIRED_EVENTS as readonly unknown[]).includes(raw.event_name)) {
        return Response.json({ error: 'Cần đăng nhập để đặt' }, { status: 401 });
      }
    }
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
