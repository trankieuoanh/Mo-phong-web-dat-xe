/**
 * Dong bo TANG DAN collection `events` vao cache — chi doc document moi.
 *
 * File nay KHONG import firebase-admin: Firestore duoc tiem vao qua
 * `EventsSource` (hien thuc o event.service.ts), nen logic cursor/merge test
 * duoc bang mot bo du lieu gia.
 *
 * VI SAO `created_at` DU LAM CURSOR — va vi sao KHONG du mot minh:
 *
 *   - Moi lan ghi qua API la `.add()` voi `created_at = serverTimestamp()`.
 *     API KHONG co update, KHONG co delete. Gio cua server Firestore gan dung
 *     thoi diem commit, nen document commit SAU lan doc cua ta luon co
 *     `created_at` >= cursor. Khong co lech gio client.
 *
 *   - Nhung `scripts/seed-events.js` ghi THANG Firestore voi `created_at` LUI VE
 *     QUA KHU (trai 90 ngay), va `--clear` XOA thang. Console Firebase cung
 *     sua/xoa duoc. Cursor theo `created_at` khong thay bat ky cai nao.
 *
 *   => Luoi an toan hai lop:
 *      1. Moi lan dong bo tang dan, dem `count()` phia Firestore (~1 luot doc
 *         moi 1.000 document) va so voi cache. Lech = co insert lui ngay hoac
 *         co xoa ngoai API → doc lai toan bo.
 *      2. Sua ma KHONG doi so luong (sua tay tren console) thi count khong thay.
 *         Cai do chi bat duoc bang doi chieu toan bo dinh ky
 *         (`reconcileMs`, xem events-cache.ts).
 *
 * Them field `updated_at` KHONG giai quyet gi: API khong bao gio update, va
 * sua tren console thi cung khong ai gan `updated_at`.
 */
import 'server-only';

/** Cung hinh voi `Timestamp` cua Firestore — giu nguyen do chinh xac micro-giay. */
export interface SyncTimestamp {
  seconds: number;
  nanoseconds: number;
}

export interface SyncedDoc {
  id: string;
  /** `created_at` dang THO. `null` neu document thieu field hoac sai kieu. */
  ts: SyncTimestamp | null;
  /** Dung object API tra ve (created_at da doi sang chuoi ISO). */
  row: Record<string, unknown>;
}

export interface EventsSnapshot {
  docs: SyncedDoc[];
  /** `docs.map(d => d.row)` tinh san mot lan — CACHE HIT khong ton gi. */
  rows: Record<string, unknown>[];
  /**
   * `created_at` lon nhat DA THAY TRONG DU LIEU (khong phai gio he thong).
   * `null` = tap rong, hoac khoa nay khong dong bo tang dan duoc.
   */
  cursor: SyncTimestamp | null;
  /** Lan doc toan bo gan nhat, ms. Dung de hen doi chieu dinh ky. */
  lastFullAt: number;
}

export interface EventsSource {
  /**
   * `false` voi khoa loc theo session/user/limit: thu tu sap khac (step_index,
   * sap trong bo nho) hoac `limit` lam "document moi" khong co nghia. Cac khoa
   * do nho, doc lai toan bo nhu truoc.
   */
  incremental: boolean;
  /** Query hien tai, nguyen thu tu Firestore tra ve. */
  fetchAll(): Promise<SyncedDoc[]>;
  /** Cung bo loc + `created_at >= cursor`. */
  fetchSince(cursor: SyncTimestamp): Promise<SyncedDoc[]>;
  /** Cung bo loc + `created_at <= cursor`, dem bang aggregation `count()`. */
  countUpTo(cursor: SyncTimestamp): Promise<number>;
}

export interface SyncOptions {
  now: number;
  reconcileMs: number;
  /** Tien to log, vd `[events] key={}`. */
  label: string;
}

const counters = {
  fullRefreshes: 0,
  incrementalRefreshes: 0,
  countMismatches: 0,
  /** Document THAT SU moi (id chua co trong cache) nhan duoc qua dong bo tang dan. */
  changedDocuments: 0,
  /** Tong document da doc ve tu Firestore — gan dung so luot doc bi tinh (chua ke count()). */
  documentsFetched: 0,
};

export function getSyncStats() {
  return { ...counters };
}

export function compareTs(a: SyncTimestamp, b: SyncTimestamp): number {
  return a.seconds - b.seconds || a.nanoseconds - b.nanoseconds;
}

/**
 * Cung thu tu voi `orderBy('created_at')` cua Firestore: theo thoi gian, hoa
 * nhau thi theo document ID (Firestore ngam them `__name__` tang dan). Nho vay
 * ket qua sau khi ghep tang dan GIONG HET mot lan doc toan bo.
 *
 * `ts === null` len dau: Firestore xep gia tri null truoc Timestamp. Moi document
 * ghi qua API hay seed deu co Timestamp, nen nhanh nay chi de phong du lieu tay.
 */
function compareDocs(a: SyncedDoc, b: SyncedDoc): number {
  if (a.ts === null || b.ts === null) {
    if (a.ts !== b.ts) return a.ts === null ? -1 : 1;
  } else {
    const byTime = compareTs(a.ts, b.ts);
    if (byTime !== 0) return byTime;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function maxCursor(start: SyncTimestamp | null, docs: SyncedDoc[]): SyncTimestamp | null {
  let max = start;
  for (const doc of docs) {
    if (doc.ts && (max === null || compareTs(doc.ts, max) > 0)) max = doc.ts;
  }
  return max;
}

function fmt(ts: SyncTimestamp | null): string {
  if (!ts) return 'null';
  return `${new Date(ts.seconds * 1000).toISOString().slice(0, 19)}.${String(ts.nanoseconds).padStart(9, '0')}Z`;
}

function snapshotOf(docs: SyncedDoc[], cursor: SyncTimestamp | null, lastFullAt: number): EventsSnapshot {
  return { docs, rows: docs.map((d) => d.row), cursor, lastFullAt };
}

async function fullLoad(source: EventsSource, options: SyncOptions, reason: string): Promise<EventsSnapshot> {
  const started = Date.now();
  const docs = await source.fetchAll();
  counters.fullRefreshes += 1;
  counters.documentsFetched += docs.length;
  const cursor = source.incremental ? maxCursor(null, docs) : null;
  console.log(
    `${options.label} FULL RECONCILIATION reason=${reason} records=${docs.length} ` +
      `cursor=${fmt(cursor)} duration=${Date.now() - started}ms`,
  );
  return snapshotOf(docs, cursor, options.now);
}

/**
 * Tra ve snapshot MOI — `previous` khong bao gio bi sua, vi neu lan dong bo nay
 * nem loi thi query-cache se tra chinh `previous` cho nguoi goi (STALE).
 */
export async function syncEvents(
  previous: EventsSnapshot | undefined,
  source: EventsSource,
  options: SyncOptions,
): Promise<EventsSnapshot> {
  if (!previous) return fullLoad(source, options, 'initial');
  if (!source.incremental) return fullLoad(source, options, 'non-incremental-key');
  // Tap rong lan truoc: khong co cursor de bam vao. Doc lai tap rong ton 1 luot.
  if (previous.cursor === null) return fullLoad(source, options, 'no-cursor');
  if (options.now - previous.lastFullAt >= options.reconcileMs) {
    return fullLoad(source, options, 'periodic');
  }

  const started = Date.now();
  const cursor = previous.cursor;

  /**
   * `>=` chu khong phai `>`: document co `created_at` BANG cursor ma chua nam
   * trong cache (vd hai event commit cung micro-giay, mot cai den sau lan doc
   * truoc) van duoc lay. Phan trung lap bi gop theo document ID ben duoi.
   */
  const fetched = await source.fetchSince(cursor);
  counters.documentsFetched += fetched.length;

  const byId = new Map(previous.docs.map((doc) => [doc.id, doc]));
  let added = 0;
  for (const doc of fetched) {
    if (!byId.has(doc.id)) added += 1;
    // Cung ID → THAY the ban cu, khong bao gio nhan doi.
    byId.set(doc.id, doc);
  }
  const docs = [...byId.values()].sort(compareDocs);
  const nextCursor = maxCursor(cursor, fetched);

  /**
   * Doi chieu so luong, chan tren boi `nextCursor` chu KHONG dem ca collection:
   * mot event ghi qua API NGAY SAU lan fetchSince o tren co `created_at` >
   * nextCursor, nen khong bi dem — neu dem ca thi lech gia va doc lai toan bo
   * vo co. Document `ts === null` khong lot vao query co dieu kien tren
   * created_at, nen cung khong duoc tinh o phia cache.
   */
  const expected = docs.filter((doc) => doc.ts !== null).length;
  const actual = nextCursor ? await source.countUpTo(nextCursor) : 0;
  if (actual !== expected) {
    counters.countMismatches += 1;
    console.warn(
      `${options.label} COUNT MISMATCH firestore=${actual} cache=${expected} ` +
        '(seed/xoa/them lui ngay ngoai API) — doc lai toan bo',
    );
    return fullLoad(source, options, 'count-mismatch');
  }

  counters.incrementalRefreshes += 1;
  counters.changedDocuments += added;
  console.log(
    `${options.label} INCREMENTAL SYNC fetched=${fetched.length} new=${added} cached=${docs.length} ` +
      `lastSyncAt=${fmt(cursor)} newSyncAt=${fmt(nextCursor)} duration=${Date.now() - started}ms`,
  );
  return snapshotOf(docs, nextCursor, previous.lastFullAt);
}
