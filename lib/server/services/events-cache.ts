/**
 * Cache cho `GET /api/events` — mot instance duy nhat cho ca tien trinh.
 *
 * Tach khoi event.service.ts de `GET /api/health` doc duoc bo dem ma KHONG keo
 * `db/firebase-admin.ts` vao — health phai tra loi duoc khi chua co credential.
 */
import 'server-only';
import type { EventQuery } from '../validators/event.validator';
import { createQueryCache } from './query-cache';

/** 5 phut: Power BI refresh trong khoang nay ton 0 luot doc Firestore. */
export const EVENTS_CACHE_TTL_MS = 5 * 60 * 1000;

export const eventsCache = createQueryCache<Record<string, unknown>[]>({
  name: 'events',
  ttlMs: EVENTS_CACHE_TTL_MS,
  // Moi khoa giu ca mang event; ban khong loc ~9.000 dong. 50 khoa la du cho
  // Power BI + man /history cua vai nguoi dung ma khong phinh bo nho.
  maxEntries: 50,
  validate: Array.isArray,
});

/**
 * Khoa = cac tham so DI VAO QUERY FIRESTORE, theo thu tu co dinh.
 * `flat` khong nam trong khoa — no chi doi hinh dang JSON sau khi doc, nen
 * `?flat=1` va dang long nhau dung chung mot lan doc.
 */
export function eventsCacheKey(query: EventQuery): string {
  return JSON.stringify({
    session_id: query.sessionId,
    user_id: query.userId,
    flow: query.flow,
    from: query.from?.toISOString(),
    to: query.to?.toISOString(),
    limit: query.limit,
  });
}

/**
 * Goi SAU KHI ghi Firestore thanh cong. Chi xoa khoa loc theo dung session/user
 * cua event vua ghi — man /history va lenh curl kiem tra tracking thay ngay.
 *
 * Khoa rong (khong loc, hoac chi loc flow/from/to) CHI het han theo TTL: app ban
 * ~10 event moi luong, xoa ca chung o moi lan ghi thi cache cua Power BI gan nhu
 * khong bao gio trung khi co nguoi dang click.
 */
export function invalidateEventsFor(sessionId: string, userId: string): void {
  eventsCache.invalidate((key) => {
    const parsed = JSON.parse(key) as { session_id?: string; user_id?: string };
    return parsed.session_id === sessionId || parsed.user_id === userId;
  });
}

export function getEventsCacheStats() {
  return eventsCache.stats();
}
