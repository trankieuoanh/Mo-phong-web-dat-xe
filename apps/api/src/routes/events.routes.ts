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
