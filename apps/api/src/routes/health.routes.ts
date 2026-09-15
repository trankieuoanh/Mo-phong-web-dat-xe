/**
 * GET /api/health — KHONG cham Firestore.
 *
 * Muc dich: xac nhan Express chay dung TRUOC khi credential vao cuoc.
 * Neu bo route nay thi loi Firebase va loi Express se tron vao nhau va rat kho tach.
 * Xem setup.md Phase 0.
 */
import { Router } from 'express';

export const healthRouter: Router = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});
