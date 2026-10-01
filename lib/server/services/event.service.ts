/**
 * Ghi & doc bang `events` tren Cloudflare D1 (qua REST — lib/server/db/d1.ts).
 * Xem docs/d1-schema-design.md va api-endpoints.md.
 *
 * Hop dong cua `GET /api/events` GIU NGUYEN so voi ban Firestore cu: cung tham so loc, cung
 * thu tu, cung dang JSON (`properties` la object, `created_at` la chuoi ISO). Chi co hai khac
 * biet nho: `created_at` chinh xac toi micro-giay, va `seed_batch` chi xuat hien o event seed.
 */
import 'server-only';
import { randomInt } from 'node:crypto';
import type { CreateEventResponse, EventPayload } from '@/lib/shared';
import { d1Query } from '../db/d1';
import type { EventQuery } from '../validators/event.validator';
import type { CacheStatus } from './query-cache';
import {
  EVENTS_FULL_RECONCILIATION_INTERVAL_MS,
  eventsCache,
  eventsCacheKey,
  invalidateEventsFor,
  isIncrementalQuery,
} from './events-cache';
import { syncEvents, type EventsSource, type SyncedDoc, type SyncTimestamp } from './events-sync';

// ─────────────────────────────────────────────────────────────
// Thoi gian & id
// ─────────────────────────────────────────────────────────────

const ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** 20 ky tu `[A-Za-z0-9]` — cung dang voi auto-id cu cua Firestore — id cua event da migrate duoc giu nguyen. */
function newEventId(): string {
  let id = '';
  for (let i = 0; i < 20; i += 1) id += ID_ALPHABET[randomInt(ID_ALPHABET.length)];
  return id;
}

/** `YYYY-MM-DDTHH:MM:SS.ffffffZ` — do rong CO DINH nen so sanh chuoi = so sanh thoi gian. */
function toIsoMicros(date: Date): string {
  return `${date.toISOString().slice(0, 23)}000Z`;
}

function syncTsToIso(ts: SyncTimestamp): string {
  const base = new Date(ts.seconds * 1000).toISOString().slice(0, 19);
  return `${base}.${String(ts.nanoseconds).padStart(9, '0').slice(0, 6)}Z`;
}

function isoToSyncTs(iso: string): SyncTimestamp {
  const seconds = Math.floor(Date.parse(`${iso.slice(0, 19)}Z`) / 1000);
  const fraction = /\.(\d+)/.exec(iso)?.[1] ?? '0';
  return { seconds, nanoseconds: Number(fraction.padEnd(9, '0').slice(0, 9)) };
}

/**
 * created_at do APP gan truoc khi ghi (khac `serverTimestamp()` cu cua Firestore la gio COMMIT),
 * nen hai request song song co the commit sai thu tu so voi created_at. Doc tang dan phai lui
 * lai mot doan de khong sot — phan doc trung duoc gop theo id (events-sync.ts).
 */
const SYNC_OVERLAP_SECONDS = 5;

// ─────────────────────────────────────────────────────────────
// Ghi
// ─────────────────────────────────────────────────────────────

export async function createEvent(payload: EventPayload): Promise<CreateEventResponse> {
  const id = newEventId();
  const createdAt = toIsoMicros(new Date());

  await d1Query(
    `INSERT INTO events
       (id, session_id, user_id, flow, event_name, screen_name, previous_screen,
        step_index, properties, platform, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      payload.session_id,
      payload.user_id,
      payload.flow,
      payload.event_name,
      payload.screen_name,
      payload.previous_screen,
      payload.step_index,
      JSON.stringify(payload.properties),
      // `platform` va `created_at` do SERVER tu gan — client gui len cung da bi validator loai.
      'web',
      createdAt,
    ],
  );

  // SAU khi INSERT thanh cong: ghi that bai thi da nem o tren, cache giu nguyen.
  invalidateEventsFor(payload.session_id, payload.user_id);

  return { event_id: id, created_at: createdAt };
}

// ─────────────────────────────────────────────────────────────
// Doc
// ─────────────────────────────────────────────────────────────

/**
 * Doc qua cache — xem events-cache.ts. `flatten` chay SAU cache nen `?flat=1`
 * va dang long nhau dung chung mot lan doc D1.
 */
export async function listEvents(
  query: EventQuery,
): Promise<{ events: Record<string, unknown>[]; cacheStatus: CacheStatus }> {
  const key = eventsCacheKey(query);
  const { value, status } = await eventsCache.get(key, (previous) =>
    syncEvents(previous, d1Source(query), {
      now: Date.now(),
      reconcileMs: EVENTS_FULL_RECONCILIATION_INTERVAL_MS,
      label: `[events] key=${key}`,
    }),
  );
  const rows = value.rows;
  return { events: query.flat ? flatten(rows) : rows, cacheStatus: status };
}

/** Noi events-sync.ts voi D1. Ba ham cung chung MOT bo loc (`whereClause`). */
function d1Source(query: EventQuery): EventsSource {
  const { where, params } = whereClause(query);
  return {
    incremental: isIncrementalQuery(query),
    fetchAll: () => fetchEvents(query),
    // events-sync.ts tu sap lai sau khi ghep.
    fetchSince: async (cursor) => {
      const since = syncTsToIso({ seconds: cursor.seconds - SYNC_OVERLAP_SECONDS, nanoseconds: cursor.nanoseconds });
      const { results } = await d1Query<EventRow>(
        `SELECT * FROM events WHERE ${[...where, 'created_at >= ?'].join(' AND ')} ORDER BY created_at, id`,
        [...params, since],
      );
      return results.map(toSyncedDoc);
    },
    countUpTo: async (cursor) => {
      const { results } = await d1Query<{ n: number }>(
        `SELECT COUNT(*) AS n FROM events WHERE ${[...where, 'created_at <= ?'].join(' AND ')}`,
        [...params, syncTsToIso(cursor)],
      );
      return Number(results[0]?.n ?? 0);
    },
  };
}

/** Cac dieu kien cua GET /api/events — chua co ORDER BY/LIMIT. Luon co it nhat `1 = 1`. */
function whereClause(query: EventQuery): { where: string[]; params: unknown[] } {
  const where: string[] = ['1 = 1'];
  const params: unknown[] = [];
  if (query.sessionId) {
    where.push('session_id = ?');
    params.push(query.sessionId);
  }
  if (query.userId) {
    where.push('user_id = ?');
    params.push(query.userId);
  }
  if (query.flow) {
    where.push('flow = ?');
    params.push(query.flow);
  }
  if (query.from) {
    where.push('created_at >= ?');
    params.push(toIsoMicros(query.from));
  }
  if (query.to) {
    where.push('created_at <= ?');
    params.push(toIsoMicros(query.to));
  }
  return { where, params };
}

interface EventRow {
  id: string;
  session_id: string;
  user_id: string;
  flow: string;
  event_name: string;
  screen_name: string;
  previous_screen: string | null;
  step_index: number;
  properties: string;
  platform: string;
  created_at: string;
  seed_batch: string | null;
}

function toSyncedDoc(row: EventRow): SyncedDoc {
  let properties: unknown = {};
  try {
    properties = JSON.parse(row.properties);
  } catch {
    // Cot co CHECK json_valid nen khong xay ra; neu co thi tra {} thay vi lam hong ca lan doc.
  }
  const { seed_batch: seedBatch, ...rest } = row;
  return {
    id: row.id,
    ts: isoToSyncTs(row.created_at),
    row: {
      ...rest,
      properties,
      // Event nguoi that khong co field nay (nhu document Firestore truoc day).
      ...(seedBatch !== null ? { seed_batch: seedBatch } : {}),
    },
  };
}

async function fetchEvents(query: EventQuery): Promise<SyncedDoc[]> {
  const { where, params } = whereClause(query);

  // Loc theo session thi sap theo buoc (dung cho replay mot phien); con lai sap theo thoi gian.
  // `id` luon di cuoi de thu tu on dinh, cung quy tac voi `compareDocs` cua events-sync.ts.
  // Khac ban Firestore: loc theo user_id cung sap/limit THANG o DB (co idx_events_user_created_at),
  // khong con phai sap trong bo nho de tranh composite index.
  const order = query.sessionId ? 'step_index, created_at, id' : 'created_at, id';
  let sql = `SELECT * FROM events WHERE ${where.join(' AND ')} ORDER BY ${order}`;
  if (query.limit !== undefined) {
    sql += ' LIMIT ?';
    params.push(query.limit);
  }
  const { results } = await d1Query<EventRow>(sql, params);
  return results.map(toSyncedDoc);
}

/**
 * Trai `properties` thanh cot `prop_<ten>` — cho cong cu BI doc JSON truc tiep.
 *
 * MOI DONG CO CUNG TAP KHOA, khoa thieu la `null`. Day moi la phan quan trong:
 * neu de moi dong chi mang khoa cua rieng no thi Power BI suy kieu bang cach doc
 * vai dong dau, va `prop_final_price` — chi xuat hien o `confirm_ride`, mot event
 * hiem trong dong su kien — co the khong lot vao mau, luc do cot do BIEN MAT khoi
 * bang ma khong bao gi.
 *
 * Tien to `prop_` khop analysis/fetch_events.py (dong 63-65) de hai duong doc du
 * lieu cho ra cung ten cot.
 */
function flatten(events: Record<string, unknown>[]): Record<string, unknown>[] {
  const keys = new Set<string>();
  for (const event of events) {
    for (const key of Object.keys((event.properties as Record<string, unknown>) ?? {})) {
      keys.add(key);
    }
  }

  return events.map((event) => {
    const { properties, ...rest } = event;
    const props = (properties as Record<string, unknown>) ?? {};
    const flat: Record<string, unknown> = { ...rest };
    for (const key of keys) flat[`prop_${key}`] = props[key] ?? null;
    return flat;
  });
}
