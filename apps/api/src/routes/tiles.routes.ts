/**
 * GET /api/tiles — nha cung cap tile nao con dung duoc. Hop dong o
 * api-endpoints.md muc 3d.
 *
 * KHONG cham Firestore, KHONG ghi event nao.
 *
 * Khong co validator vi endpoint nay khong nhan tham so nao.
 */
import { Router } from 'express';
import { findUsableTileProviders } from '../services/tiles.service.js';

export const tilesRouter: Router = Router();

tilesRouter.get('/tiles', async (_req, res) => {
  try {
    const providers = await findUsableTileProviders();
    res.json({ providers });
  } catch (error) {
    // KHONG tra 502 o day. FE coi mot loi la "khong biet gi" va lui ve dung ca
    // bang TILE_PROVIDERS, nen mot mang rong va mot loi 502 dan toi hai ket cuc
    // KHAC HAN nhau: mang rong nghia la "da do, khong nha nao dung duoc" va se
    // lam ban do trang han. Phep do that bai thi bao khong biet, dung bao la
    // tat ca deu chet.
    console.error('[GET /api/tiles] Do that bai:', error);
    res.status(502).json({ error: 'Không dò được nhà cung cấp tile lúc này' });
  }
});
