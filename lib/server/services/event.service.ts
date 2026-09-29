/**
 * Ghi & doc collection `events`. Xem db-design.md va api-endpoints.md.
 */
import 'server-only';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { CreateEventResponse, EventPayload } from '@/lib/shared';
import { EVENTS_COLLECTION, getDb } from '../db/firebase-admin';
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

export async function createEvent(payload: EventPayload): Promise<CreateEventResponse> {
  const ref = await getDb()
    .collection(EVENTS_COLLECTION)
    .add({
      ...payload,
      // Hai field nay do SERVER tu gan — client gui len cung da bi validator loai.
      platform: 'web',
      created_at: FieldValue.serverTimestamp(),
    });

  // SAU khi .add() thanh cong: ghi that bai thi da nem o tren, cache giu nguyen.
  invalidateEventsFor(payload.session_id, payload.user_id);

  return {
    event_id: ref.id,
    // XAP XI, lech vai mili-giay: serverTimestamp() chua co gia tri that luc .add() tra ve.
    // Gia tri chuan dung cho phan tich la field `created_at` trong Firestore.
    // Khong doc lai document — ton them 1 read ma client cung bo qua response.
    created_at: new Date().toISOString(),
  };
}

/**
 * Doc qua cache — xem events-cache.ts. `flatten` chay SAU cache nen `?flat=1`
 * va dang long nhau dung chung mot lan doc Firestore.
 */
export async function listEvents(
  query: EventQuery,
): Promise<{ events: Record<string, unknown>[]; cacheStatus: CacheStatus }> {
  const key = eventsCacheKey(query);
  const { value, status } = await eventsCache.get(key, (previous) =>
    syncEvents(previous, firestoreSource(query), {
      now: Date.now(),
      reconcileMs: EVENTS_FULL_RECONCILIATION_INTERVAL_MS,
      label: `[events] key=${key}`,
    }),
  );
  const rows = value.rows;
  return { events: query.flat ? flatten(rows) : rows, cacheStatus: status };
}

/** Noi events-sync.ts voi Firestore that. Ba ham cung chung MOT bo loc. */
function firestoreSource(query: EventQuery): EventsSource {
  const toTimestamp = (ts: SyncTimestamp) => new Timestamp(ts.seconds, ts.nanoseconds);
  return {
    incremental: isIncrementalQuery(query),
    fetchAll: () => fetchEvents(query),
    // Khong orderBy: events-sync.ts tu sap lai sau khi ghep. Bo loc `flow ==`
    // cong dieu kien khoang tren created_at dung CUNG composite index
    // (flow, created_at) ma `?flow=` von da can — khong phat sinh index moi.
    fetchSince: async (cursor) => {
      const snapshot = await baseQuery(query).where('created_at', '>=', toTimestamp(cursor)).get();
      return snapshot.docs.map(toSyncedDoc);
    },
    // Aggregation: tinh ~1 luot doc cho moi 1.000 document khop, khong phai 1/document.
    countUpTo: async (cursor) => {
      const snapshot = await baseQuery(query)
        .where('created_at', '<=', toTimestamp(cursor))
        .count()
        .get();
      return snapshot.data().count;
    },
  };
}

/** Cac dieu kien `where` cua GET /api/events — chua co orderBy/limit. */
function baseQuery(query: EventQuery): FirebaseFirestore.Query {
  let ref = getDb().collection(EVENTS_COLLECTION) as FirebaseFirestore.Query;
  if (query.sessionId) ref = ref.where('session_id', '==', query.sessionId);
  if (query.userId) ref = ref.where('user_id', '==', query.userId);
  if (query.flow) ref = ref.where('flow', '==', query.flow);
  if (query.from) ref = ref.where('created_at', '>=', Timestamp.fromDate(query.from));
  if (query.to) ref = ref.where('created_at', '<=', Timestamp.fromDate(query.to));
  return ref;
}

function toSyncedDoc(doc: FirebaseFirestore.QueryDocumentSnapshot): SyncedDoc {
  const data = doc.data();
  const createdAt = data.created_at;
  const isTimestamp = createdAt instanceof Timestamp;
  return {
    id: doc.id,
    // Giu Timestamp THO lam cursor: chuoi ISO chi toi mili-giay, cat mat phan
    // micro-giay ma Firestore dung de so sanh.
    ts: isTimestamp ? { seconds: createdAt.seconds, nanoseconds: createdAt.nanoseconds } : null,
    row: {
      id: doc.id,
      ...data,
      // Timestamp cua Firestore serialize ra JSON thanh {_seconds, _nanoseconds} —
      // pandas va jq deu khong doc duoc. Doi sang chuoi ISO ngay tai day.
      created_at: isTimestamp ? createdAt.toDate().toISOString() : null,
    },
  };
}

async function fetchEvents(query: EventQuery): Promise<SyncedDoc[]> {
  let ref = baseQuery(query);

  /**
   * Loc theo session thi sap theo buoc (dung cho replay mot phien);
   * loc theo user thi sap TRONG BO NHO (xem duoi); con lai sap theo thoi gian.
   *
   * Vi sao user_id khong dung orderBy cua Firestore: mot where('==') cong mot
   * orderBy tren field KHAC se bi Firestore tu choi va bat tao composite index —
   * tuc nguoi chay du an phai bam link, doi index build, roi moi demo duoc.
   * Du lieu mot nguoi dung chi vai tram document nen sap trong JS re hon nhieu
   * so voi bat cau hinh them sau khi clone. Xem api-endpoints.md muc 3.
   */
  const sortInMemory = Boolean(query.userId) && !query.sessionId;
  if (!sortInMemory) {
    ref = query.sessionId ? ref.orderBy('step_index') : ref.orderBy('created_at');
  }

  /**
   * `limit` di vao query Firestore chu khong cat sau khi lay ve: moi document
   * doc len la MOT LUOT DOC tinh vao han muc (free tier 50.000/ngay), nen cat o
   * client thi tra tien cho ca nhung dong da vut di.
   *
   * Ngoai le: khi dang sap trong bo nho thi khong the limit o Firestore — 200
   * document dau theo thu tu tuy y khong phai 200 document dau theo thoi gian.
   * Truong hop do cat sau khi sap, xem duoi.
   */
  if (query.limit !== undefined && !sortInMemory) ref = ref.limit(query.limit);

  const snapshot = await ref.get();

  const events = snapshot.docs.map(toSyncedDoc);

  if (sortInMemory) {
    // created_at co the la null voi document vua ghi (serverTimestamp chua ket
    // thuc). Day chung xuong cuoi thay vi de String(null) xen vao giua.
    events.sort((a, b) =>
      String(a.row.created_at ?? '￿').localeCompare(String(b.row.created_at ?? '￿')),
    );
  }

  // Chi nhanh sap-trong-bo-nho moi phai cat o day — xem ghi chu o cho dat limit.
  return query.limit !== undefined && sortInMemory ? events.slice(0, query.limit) : events;
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
