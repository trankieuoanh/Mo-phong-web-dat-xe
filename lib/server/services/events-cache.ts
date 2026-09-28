/**
 * Cache cho `GET /api/events` — mot instance duy nhat cho ca tien trinh.
 *
 * Tach khoi event.service.ts de `GET /api/health` doc duoc bo dem ma KHONG keo
 * `db/firebase-admin.ts` vao — health phai tra loi duoc khi chua co credential.
 */
import 'server-only';
import type { EventQuery } from '../validators/event.validator';
import { getSyncStats, type EventsSnapshot } from './events-sync';
import { createQueryCache } from './query-cache';

/**
 * 5 phut: Power BI refresh trong khoang nay ton 0 luot doc Firestore.
 * Het han KHONG co nghia la doc lai toan bo — xem events-sync.ts.
 */
export const EVENTS_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Doi chieu TOAN BO dinh ky, du dong bo tang dan van dang chay tot.
 *
 * Dem `count()` o moi lan lam moi da bat duoc seed (created_at lui ngay) va xoa
 * ngoai API. Thu duy nhat no bo sot la sua tay tren console Firebase ma KHONG
 * doi so luong document. 24 gio = ~1 lan doc toan bo moi ngay cho moi instance
 * con song — du re so voi han muc 50.000, du nhanh de sai sot khong ton qua
 * mot ngay. Cold start (restart, deploy, instance moi) von da doc toan bo.
 */
export const EVENTS_FULL_RECONCILIATION_INTERVAL_MS = 24 * 60 * 60 * 1000;

export const eventsCache = createQueryCache<EventsSnapshot>({
  name: 'events',
  ttlMs: EVENTS_CACHE_TTL_MS,
  // Moi khoa giu ca mang event; ban khong loc ~9.000 dong. 50 khoa la du cho
  // Power BI + man /history cua vai nguoi dung ma khong phinh bo nho.
  maxEntries: 50,
  validate: (value) => Array.isArray(value?.docs) && Array.isArray(value?.rows),
  size: (value) => value.rows.length,
});

/**
 * Khoa nao dong bo tang dan duoc: chi khoa KHONG loc session/user va KHONG co
 * limit — dung duong Power BI goi. Xem `EventsSource.incremental`.
 */
export function isIncrementalQuery(query: EventQuery): boolean {
  return !query.sessionId && !query.userId && query.limit === undefined;
}

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
  return { ...eventsCache.stats(), ...getSyncStats() };
}
