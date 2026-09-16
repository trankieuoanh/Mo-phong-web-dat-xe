/**
 * GET /api/places — tim dia chi that. Hop dong o api-endpoints.md muc 3b.
 *
 * KHONG cham Firestore, KHONG ghi event nao: go phim khong phai mot buoc funnel.
 */
import { Router } from 'express';
import { searchPlaces } from '../services/place.service.js';
import { validatePlaceQuery } from '../validators/place.validator.js';

export const placesRouter: Router = Router();

placesRouter.get('/places', async (req, res) => {
  const params = new URLSearchParams(req.url.split('?')[1] ?? '');
  const result = validatePlaceQuery(params);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }

  try {
    const places = await searchPlaces(result.value);
    res.json(places);
  } catch (error) {
    // 502 chu khong phai 500: loi nam o dich vu ben ngoai, khong phai o app nay.
    // FE se hien canh bao nhung VAN liet ke 5 dia chi goi y — ha tang loi khong
    // duoc ket nguoi dung (api-endpoints.md muc 3b).
    const detail = error instanceof Error ? error.message : 'unknown';
    console.error('[GET /api/places] Nominatim that bai:', error);
    res.status(502).json({ error: `Không tìm được địa chỉ lúc này (${detail})` });
  }
});
