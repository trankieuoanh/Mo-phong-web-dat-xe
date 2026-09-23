/**
 * POST /api/events — ghi 1 event
 * GET  /api/events — doc event theo session_id / flow / from / to
 *
 * Hop dong day du o api-endpoints.md.
 */
import { Router } from 'express';
import { createEvent, listEvents } from '../services/event.service.js';
import { validateEventPayload, validateEventQuery } from '../validators/event.validator.js';

export const eventsRouter: Router = Router();

/**
 * Khoa chia se cho `/events`. BA DIEU CAN BIET TRUOC KHI SUA CHO NAY.
 *
 * 1. KHONG DAT BIEN NAY THI KHONG KIEM TRA GI CA — do la chu y, khong phai so
 *    sot. Chay local khong ai phai cau hinh them, va `analysis/fetch_events.py`
 *    van doc duoc nhu cu. Khoa chi bat len o noi that su can: ban deploy cong
 *    khai, noi `api-endpoints.md` muc cuoi da canh bao rang POST /api/events la
 *    endpoint mo va ai cung ghi document rac vao collection `events` duoc.
 *
 * 2. Trinh duyet KHONG BAO GIO biet gia tri nay. Header duoc them o tang server
 *    cua apps/web (`apps/web/middleware.ts`), tuc la sau khi request da roi khoi
 *    may nguoi dung. Nhet khoa vao `lib/track.ts` thi no nam trong bundle JS tai
 *    ve va hoan toan vo dung.
 *
 * 3. Chan CA GET lan POST. GET cung can vi `/history` doc lai event qua chinh
 *    duong proxy do, nen middleware da bom header cho moi `/api/*` — khong co
 *    ly do de ho GET ra ngoai.
 */
const EVENTS_WRITE_KEY = process.env.EVENTS_WRITE_KEY;

eventsRouter.use('/events', (req, res, next) => {
  if (!EVENTS_WRITE_KEY) {
    next();
    return;
  }

  if (req.get('x-gsm-key') !== EVENTS_WRITE_KEY) {
    res.status(401).json({ error: 'Thiếu hoặc sai khoá ghi event' });
    return;
  }

  next();
});

eventsRouter.post('/events', async (req, res) => {
  const result = validateEventPayload(req.body);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }

  try {
    const created = await createEvent(result.value);
    res.status(201).json(created);
  } catch (error) {
    // Log day du phia server, tra thong bao gon cho client.
    console.error('[POST /api/events] ghi Firestore that bai:', error);
    res.status(500).json({ error: 'Could not write event' });
  }
});

eventsRouter.get('/events', async (req, res) => {
  const params = new URLSearchParams(req.url.split('?')[1] ?? '');
  const result = validateEventQuery(params);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }

  try {
    const events = await listEvents(result.value);
    res.json(events);
  } catch (error) {
    // Query ket hop where + orderBy tren 2 field khac nhau se bi Firestore tu choi
    // KEM MOT LINK TAO INDEX san trong thong bao loi. Bam link do, doi ~1 phut, chay lai.
    // Vi vay message loi that duoc tra ve nguyen van — no chua duong dan can di.
    console.error('[GET /api/events] doc Firestore that bai:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Could not read events',
    });
  }
});
