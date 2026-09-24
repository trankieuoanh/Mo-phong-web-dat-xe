/**
 * GET /api/health — KHONG cham Firestore.
 *
 * Muc dich: xac nhan app chay dung TRUOC khi credential vao cuoc. Neu bo route
 * nay thi loi Firebase va loi cua chinh Next se tron vao nhau va rat kho tach.
 * Xem setup.md Phase 0.
 *
 * Day cung la route duy nhat tra loi duoc khi chua co `.env.local` — vi vay no
 * KHONG import gi tu `lib/server/db`.
 */
export const runtime = 'nodejs';

export function GET() {
  return Response.json({ status: 'ok' });
}
