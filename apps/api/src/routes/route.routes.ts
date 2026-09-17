/**
 * GET /api/route — tim tuyen duong that. Hop dong o api-endpoints.md muc 3c.
 *
 * KHONG cham Firestore, KHONG ghi event nao.
 */
import { Router } from 'express';
import { findRoute } from '../services/route.service.js';
import { validateRouteQuery } from '../validators/route.validator.js';

export const routeRouter: Router = Router();

routeRouter.get('/route', async (req, res) => {
  const params = new URLSearchParams(req.url.split('?')[1] ?? '');
  const result = validateRouteQuery(params);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }

  try {
    const route = await findRoute(result.value);
    res.json(route);
  } catch (error) {
    // 502 chu khong phai 500: loi nam o dich vu ben ngoai, khong phai o app nay.
    // FE bat 502 roi goi straightRoute() va ghi route_source: 'straight' —
    // luong dat xe khong bao gio bi chan vi OSRM (api-endpoints.md muc 3c).
    const detail = error instanceof Error ? error.message : 'unknown';
    console.error('[GET /api/route] OSRM that bai:', error);
    res.status(502).json({ error: `Không tính được tuyến đường lúc này (${detail})` });
  }
});
