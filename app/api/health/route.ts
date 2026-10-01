/**
 * GET /api/health — KHONG cham Firestore.
 *
 * Muc dich: xac nhan app chay dung TRUOC khi credential vao cuoc. Neu bo route
 * nay thi loi Firebase va loi cua chinh Next se tron vao nhau va rat kho tach.
 * Xem setup.md Phase 0.
 *
 * Day cung la route duy nhat tra loi duoc khi chua co `.env.local` — vi vay no
 * KHONG import gi tu `lib/server/db` (ke ca gian tiep qua event.service.ts).
 */
import { getEventsCacheStats } from '@/lib/server/services/events-cache';

export const runtime = 'nodejs';
// Bo dem cache thay doi theo tung request — khong duoc de Next cache tinh route nay.
export const dynamic = 'force-dynamic';

export function GET() {
  // `events_cache` chi la bo dem hit/miss, khong chua credential hay du lieu event.
  // events-cache.ts khong import db/, nen route nay van khong cham Firestore.
  return Response.json({ status: 'ok', events_cache: getEventsCacheStats() });
}
