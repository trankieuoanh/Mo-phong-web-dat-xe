#!/usr/bin/env node
/**
 * sync-events.js — dong bo TANG DAN collection Firestore `events` -> BigQuery.
 *
 *   Firestore `events`  --(doc moi)-->  staging  --MERGE-->  gsm_analytics.fact_events
 *
 * Firestore van la noi luu chinh; BigQuery chi la sink phan tich cho Power BI.
 * Script nay KHONG duoc app import (khong o app/, lib/) nen khong dinh quy tac
 * `server-only`; no tu chua, giong scripts/seed-events.js.
 *
 * Cach dung (tu thu muc goc):
 *   node scripts/bigquery/sync-events.js --init         tao dataset + bang + view (chay lai an toan)
 *   node scripts/bigquery/sync-events.js --dry-run      doc Firestore + bien doi, KHONG cham BigQuery
 *   node scripts/bigquery/sync-events.js                tang dan tu checkpoint
 *   node scripts/bigquery/sync-events.js --backfill     doc TOAN BO events (idempotent)
 *   node scripts/bigquery/sync-events.js --since 2026-09-01T00:00:00Z
 *   Tuy chon: --batch-size N (mac dinh 1000), --limit N (chan tong document, CHI voi --dry-run)
 *
 * CHONG TRUNG (idempotent): MERGE theo `event_id` = Firestore document ID. Chay lai
 * bao nhieu lan ket qua van mot dong / event.
 *
 * CHECKPOINT: doc Firestore `system/bigquery_events_sync`. Chi ghi SAU KHI MERGE
 * thanh cong, nen sap giua chung thi lan sau doc lai tu diem cu — khong mat event.
 * Moi lan doc lui OVERLAP_MS so voi checkpoint de bat event commit tre / cung
 * timestamp; phan doc trung do MERGE loai bo.
 *
 * KHONG lan sang BigQuery: (1) document bi XOA o Firestore (vd. `seed --clear`);
 * (2) event seed ghi `created_at` lui ve qua khu — cursor khong thay, phai `--backfill`.
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const SQL_DIR = __dirname;
const KEY_PATH = path.join(ROOT, 'serviceAccountKey.json');

const EVENTS_COLLECTION = 'events';
const STATE_DOC = 'system/bigquery_events_sync';

/** Doc lui so voi checkpoint: bat event commit tre + cung timestamp. */
const OVERLAP_MS = 10 * 60 * 1000;
const DEFAULT_BATCH = 1000;
const RETRIES = 4;

// ─────────────────────────────────────────────────────────────
// Tien ich
// ─────────────────────────────────────────────────────────────

function fail(message) {
  console.error(`\nLỗi: ${message}`);
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseArgs(argv) {
  const opts = { init: false, dryRun: false, backfill: false, since: null, batchSize: DEFAULT_BATCH, limit: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (value === undefined) fail(`${arg} cần một giá trị.`);
      i += 1;
      return value;
    };
    switch (arg) {
      case '--init':
        opts.init = true;
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--backfill':
        opts.backfill = true;
        break;
      case '--since': {
        const d = new Date(next());
        if (Number.isNaN(d.getTime())) fail('--since phải là ngày ISO, vd 2026-09-01T00:00:00Z.');
        opts.since = d;
        break;
      }
      case '--batch-size':
      case '--limit': {
        const n = Number(next());
        if (!Number.isInteger(n) || n < 1) fail(`${arg} phải là số nguyên dương.`);
        if (arg === '--limit') opts.limit = n;
        else opts.batchSize = Math.min(n, 5000);
        break;
      }
      case '-h':
      case '--help':
        console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^#!.*\n/, ''));
        process.exit(0);
        break;
      default:
        fail(`Tham số không hiểu: ${arg}. Dùng --help.`);
    }
  }
  if (opts.backfill && opts.since) fail('--backfill và --since không đi cùng nhau.');
  if (opts.limit && !opts.dryRun) fail('--limit chỉ dùng với --dry-run (đọc dở thì không được ghi checkpoint).');
  return opts;
}

/**
 * Retry co backoff CHI cho loi tam thoi (mang, 429, 5xx). Loi quyen/credential/SQL
 * nem thang ra: thu lai khong sua duoc, va nuot no chi che mat nguyen nhan.
 */
async function withRetry(label, fn) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      const code = err?.code ?? err?.response?.status;
      const transient =
        [429, 500, 502, 503, 504, 4, 8, 13, 14].includes(code) ||
        ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND'].includes(err?.code) ||
        /rateLimitExceeded|backendError|internalError|UNAVAILABLE|DEADLINE_EXCEEDED/i.test(String(err?.message));
      if (!transient || attempt >= RETRIES) throw err;
      const wait = 1000 * 2 ** attempt;
      console.warn(`  ${label}: lỗi tạm (${code ?? err.message}), thử lại sau ${wait}ms (${attempt}/${RETRIES - 1})`);
      await sleep(wait);
    }
  }
}

/** Loi quyen thuong gap — noi ro phai lam gi, KHONG in credential. */
function explain(err) {
  const msg = String(err?.message ?? err);
  if (err?.code === 403 || /Access Denied|permission|PERMISSION_DENIED/i.test(msg)) {
    return `${msg}\n  → Service account BigQuery thiếu quyền. Cần "BigQuery Job User" ở project và ` +
      '"BigQuery Data Editor" ở dataset (docs/BIGQUERY_SETUP.md mục 4).';
  }
  if (err?.code === 404 || /Not found: (Dataset|Table)/i.test(msg)) {
    return `${msg}\n  → Chưa có dataset/bảng. Chạy: node scripts/bigquery/sync-events.js --init`;
  }
  if (/invalid_grant|DECODER routines|Could not load the default credentials/i.test(msg)) {
    return `${msg}\n  → Credential sai. Kiểm tra BIGQUERY_CLIENT_EMAIL / BIGQUERY_PRIVATE_KEY (docs/BIGQUERY_SETUP.md mục 5).`;
  }
  return msg;
}

// ─────────────────────────────────────────────────────────────
// Cau hinh + ket noi
// ─────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.join(ROOT, '.env.local');
  if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') process.loadEnvFile(envPath);
}

function ident(name, value, pattern) {
  if (!value) fail(`Thiếu biến môi trường ${name}. Xem docs/BIGQUERY_SETUP.md mục 5.`);
  if (!pattern.test(value)) fail(`${name}="${value}" chứa ký tự không hợp lệ.`);
  return value;
}

function bqConfig() {
  return {
    projectId: ident('BIGQUERY_PROJECT_ID', process.env.BIGQUERY_PROJECT_ID, /^[a-z][a-z0-9-]{4,60}[a-z0-9]$/),
    dataset: ident('BIGQUERY_DATASET', process.env.BIGQUERY_DATASET || 'gsm_analytics', /^[A-Za-z0-9_]+$/),
    table: ident('BIGQUERY_EVENTS_TABLE', process.env.BIGQUERY_EVENTS_TABLE || 'fact_events', /^[A-Za-z0-9_]+$/),
    location: ident('BIGQUERY_LOCATION', process.env.BIGQUERY_LOCATION || 'asia-southeast1', /^[A-Za-z0-9-]+$/),
    clientEmail: process.env.BIGQUERY_CLIENT_EMAIL,
    privateKey: process.env.BIGQUERY_PRIVATE_KEY,
  };
}

function connectFirestore() {
  const { cert, getApps, initializeApp } = require('firebase-admin/app');
  const { getFirestore, Timestamp, FieldPath } = require('firebase-admin/firestore');

  let credential;
  if (fs.existsSync(KEY_PATH)) {
    credential = cert(require(KEY_PATH));
  } else {
    const { FIREBASE_PROJECT_ID: projectId, FIREBASE_CLIENT_EMAIL: clientEmail, FIREBASE_PRIVATE_KEY: privateKey } = process.env;
    const missing = [
      !projectId && 'FIREBASE_PROJECT_ID',
      !clientEmail && 'FIREBASE_CLIENT_EMAIL',
      !privateKey && 'FIREBASE_PRIVATE_KEY',
    ].filter(Boolean);
    if (missing.length > 0) fail(`Thiếu credential Firebase: ${missing.join(', ')} (.env.local hoặc serviceAccountKey.json).`);
    credential = cert({ projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, '\n') });
  }
  const app = getApps()[0] ?? initializeApp({ credential });
  return { db: getFirestore(app), Timestamp, FieldPath };
}

function connectBigQuery(cfg) {
  const { BigQuery } = require('@google-cloud/bigquery');
  if (!cfg.clientEmail || !cfg.privateKey) {
    fail('Thiếu BIGQUERY_CLIENT_EMAIL / BIGQUERY_PRIVATE_KEY. Xem docs/BIGQUERY_SETUP.md mục 5.');
  }
  return new BigQuery({
    projectId: cfg.projectId,
    location: cfg.location,
    credentials: { client_email: cfg.clientEmail, private_key: cfg.privateKey.replace(/\\n/g, '\n') },
  });
}

// ─────────────────────────────────────────────────────────────
// Bien doi Firestore -> dong BigQuery
// ─────────────────────────────────────────────────────────────

/** Timestamp Firestore -> chuoi RFC3339, giu MICRO-giay (BigQuery TIMESTAMP chi toi micro). */
function tsToIso(ts) {
  const base = new Date(ts.seconds * 1000).toISOString().slice(0, 19);
  return `${base}.${String(ts.nanoseconds).padStart(9, '0').slice(0, 6)}Z`;
}

const REQUIRED_STRINGS = ['session_id', 'user_id', 'flow', 'event_name', 'screen_name'];

/**
 * Tra ve `{ row }` hoac `{ skip: 'ly do' }`.
 * `created_at` thieu/sai kieu -> NULL, KHONG thay bang gio hien tai: gia gio sai
 * se lam sai moi bieu do theo thoi gian ma khong ai biet. Lan sau document co
 * created_at that thi MERGE tu sua.
 */
function transform(doc, Timestamp) {
  const data = doc.data();
  for (const field of REQUIRED_STRINGS) {
    if (typeof data[field] !== 'string' || data[field] === '') return { skip: `thiếu/sai ${field}` };
  }
  if (!Number.isInteger(data.step_index)) return { skip: 'thiếu/sai step_index' };

  let properties = data.properties;
  if (properties === undefined || properties === null) properties = {};
  if (typeof properties !== 'object' || Array.isArray(properties)) return { skip: 'properties không phải object' };

  const createdAt = data.created_at instanceof Timestamp ? data.created_at : null;
  return {
    row: {
      event_id: doc.id,
      session_id: data.session_id,
      user_id: data.user_id,
      flow: data.flow,
      event_name: data.event_name,
      screen_name: data.screen_name,
      previous_screen: typeof data.previous_screen === 'string' ? data.previous_screen : null,
      step_index: data.step_index,
      properties_json: JSON.stringify(properties),
      platform: typeof data.platform === 'string' ? data.platform : null,
      created_at: createdAt ? tsToIso(createdAt) : null,
      seed_batch: typeof data.seed_batch === 'string' ? data.seed_batch : null,
    },
    ts: createdAt,
  };
}

// ─────────────────────────────────────────────────────────────
// Doc Firestore theo trang
// ─────────────────────────────────────────────────────────────

/**
 * Tang dan: `created_at >= start`, sap (created_at, __name__) — cung thu tu on dinh
 * de `startAfter(lastDoc)` khong bo sot/lap khi nhieu event cung timestamp.
 * Backfill: sap theo __name__ de LOT CA document created_at null/vang.
 * Khong can composite index moi (khoang + orderBy cung mot field created_at).
 */
async function* pages({ db, Timestamp, FieldPath }, { start, batchSize, limit }) {
  let query = db.collection(EVENTS_COLLECTION);
  if (start) query = query.where('created_at', '>=', start).orderBy('created_at').orderBy(FieldPath.documentId());
  else query = query.orderBy(FieldPath.documentId());

  let last = null;
  let total = 0;
  for (;;) {
    const size = limit ? Math.min(batchSize, limit - total) : batchSize;
    if (size <= 0) return;
    let page = query.limit(size);
    if (last) page = page.startAfter(last);
    const snapshot = await withRetry('đọc Firestore', () => page.get());
    if (snapshot.empty) return;
    last = snapshot.docs[snapshot.docs.length - 1];
    total += snapshot.size;
    yield snapshot.docs;
    if (snapshot.size < size) return;
  }
}

// ─────────────────────────────────────────────────────────────
// Checkpoint
// ─────────────────────────────────────────────────────────────

async function readCheckpoint(db) {
  const snap = await withRetry('đọc checkpoint', () => db.doc(STATE_DOC).get());
  return snap.exists ? snap.data() : null;
}

/** Chi tien len, khong bao gio lui. */
async function saveCheckpoint(db, Timestamp, cursor, summary) {
  const existing = await readCheckpoint(db);
  const keep = existing?.cursor && cursor && existing.cursor.toMillis() > cursor.toMillis() ? existing.cursor : cursor;
  await withRetry('ghi checkpoint', () =>
    db.doc(STATE_DOC).set(
      { cursor: keep ?? null, last_run_at: Timestamp.now(), last_summary: summary },
      { merge: true },
    ),
  );
}

// ─────────────────────────────────────────────────────────────
// BigQuery
// ─────────────────────────────────────────────────────────────

const STAGING_SCHEMA = [
  { name: 'event_id', type: 'STRING' },
  { name: 'session_id', type: 'STRING' },
  { name: 'user_id', type: 'STRING' },
  { name: 'flow', type: 'STRING' },
  { name: 'event_name', type: 'STRING' },
  { name: 'screen_name', type: 'STRING' },
  { name: 'previous_screen', type: 'STRING' },
  { name: 'step_index', type: 'INT64' },
  // JSON dang chuoi: load job NDJSON vao cot JSON kem on dinh; MERGE se PARSE_JSON.
  { name: 'properties_json', type: 'STRING' },
  { name: 'platform', type: 'STRING' },
  { name: 'created_at', type: 'TIMESTAMP' },
  { name: 'seed_batch', type: 'STRING' },
];

const COLUMNS = STAGING_SCHEMA.filter((c) => c.name !== 'properties_json').map((c) => c.name);

function mergeSql(cfg, staging) {
  const target = `\`${cfg.projectId}.${cfg.dataset}.${cfg.table}\``;
  const src = `\`${cfg.projectId}.${cfg.dataset}.${staging}\``;
  const setList = [...COLUMNS.filter((c) => c !== 'event_id'), 'properties', 'synced_at']
    .map((c) => `T.${c} = S.${c}`)
    .join(', ');
  const insertCols = [...COLUMNS, 'properties', 'synced_at'].join(', ');
  const insertVals = [...COLUMNS, 'properties', 'synced_at'].map((c) => `S.${c}`).join(', ');
  const selectCols = COLUMNS.join(', ');
  return `
MERGE ${target} T
USING (
  SELECT ${selectCols}, PARSE_JSON(properties_json) AS properties, CURRENT_TIMESTAMP() AS synced_at
  FROM ${src}
  WHERE TRUE
  QUALIFY ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY created_at DESC NULLS LAST) = 1
) S
ON T.event_id = S.event_id
WHEN MATCHED THEN UPDATE SET ${setList}
WHEN NOT MATCHED THEN INSERT (${insertCols}) VALUES (${insertVals})`;
}

/** Staging -> MERGE -> xoa staging. Tra ve { inserted, updated }. */
async function mergeBatch(bq, cfg, rows, runId, batchNo) {
  const staging = `${cfg.table}_stg_${runId}_${batchNo}`;
  const dataset = bq.dataset(cfg.dataset);
  const file = path.join(os.tmpdir(), `${staging}.ndjson`);
  fs.writeFileSync(file, `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`);

  try {
    // expirationTime 1 ngay: du script sap truoc khi xoa, BigQuery van tu don.
    await withRetry('tạo staging', () =>
      dataset.createTable(staging, {
        schema: STAGING_SCHEMA,
        expirationTime: Date.now() + 24 * 60 * 60 * 1000,
      }),
    );
    const [job] = await withRetry('load staging', () =>
      dataset.table(staging).load(file, { sourceFormat: 'NEWLINE_DELIMITED_JSON', schema: { fields: STAGING_SCHEMA } }),
    );
    if (job.status?.errors?.length) throw new Error(`Load job lỗi: ${JSON.stringify(job.status.errors)}`);

    const target = `\`${cfg.projectId}.${cfg.dataset}.${cfg.table}\``;
    const [existing] = await withRetry('đếm trùng', () =>
      bq.query({
        query: `SELECT COUNT(DISTINCT s.event_id) AS c FROM \`${cfg.projectId}.${cfg.dataset}.${staging}\` s
                JOIN ${target} t ON t.event_id = s.event_id`,
      }),
    );
    const updated = Number(existing[0].c);
    const unique = new Set(rows.map((r) => r.event_id)).size;

    await withRetry('MERGE', () => bq.query({ query: mergeSql(cfg, staging) }));
    return { inserted: unique - updated, updated };
  } finally {
    fs.rmSync(file, { force: true });
    await dataset.table(staging).delete({ ignoreNotFound: true }).catch((e) => {
      console.warn(`  Không xoá được staging ${staging} (sẽ tự hết hạn sau 1 ngày): ${e.message}`);
    });
  }
}

async function runInit(bq, cfg) {
  const vars = { PROJECT: cfg.projectId, DATASET: cfg.dataset, TABLE: cfg.table, LOCATION: cfg.location };
  for (const file of ['create-dataset.sql', 'create-fact-events.sql', 'create-view-powerbi.sql']) {
    const sql = fs.readFileSync(path.join(SQL_DIR, file), 'utf8').replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k]);
    process.stdout.write(`  ${file} … `);
    try {
      await withRetry(file, () => bq.query({ query: sql }));
      console.log('ok');
    } catch (err) {
      if (file === 'create-dataset.sql') {
        console.log('bỏ qua');
        console.warn(
          `    Không tạo được dataset bằng script (${err.message}).\n` +
            '    Tạo dataset thủ công trong BigQuery console (docs/BIGQUERY_SETUP.md mục 3) rồi chạy lại --init.',
        );
        continue;
      }
      throw err;
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Chay
// ─────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  loadEnv();

  if (opts.init) {
    const cfg = bqConfig();
    console.log(`Khởi tạo ${cfg.projectId}.${cfg.dataset} (${cfg.location})`);
    await runInit(connectBigQuery(cfg), cfg);
    console.log('Xong. Tiếp theo: node scripts/bigquery/sync-events.js --backfill');
    return;
  }

  const fs_ = connectFirestore();
  const { db, Timestamp } = fs_;
  const cfg = opts.dryRun ? null : bqConfig();
  const bq = opts.dryRun ? null : connectBigQuery(cfg);

  // Xac dinh diem bat dau.
  const startedAt = Timestamp.now();
  const checkpoint = opts.dryRun || opts.backfill || opts.since ? await readCheckpoint(db).catch(() => null) : await readCheckpoint(db);
  let start = null;
  let mode;
  if (opts.backfill) {
    mode = 'BACKFILL (toàn bộ)';
  } else if (opts.since) {
    start = Timestamp.fromDate(opts.since);
    mode = `SINCE ${opts.since.toISOString()}`;
  } else if (checkpoint?.cursor) {
    start = Timestamp.fromMillis(checkpoint.cursor.toMillis() - OVERLAP_MS);
    mode = `INCREMENTAL từ ${start.toDate().toISOString()} (checkpoint − ${OVERLAP_MS / 60000} phút)`;
  } else {
    mode = 'LẦN ĐẦU (chưa có checkpoint) → đọc toàn bộ';
    opts.backfill = true;
  }
  console.log(`Chế độ: ${mode}${opts.dryRun ? '  [DRY RUN]' : ''}`);

  const stats = { fetched: 0, inserted: 0, updated: 0, skipped: 0, nullCreatedAt: 0, failed: 0 };
  const runId = Date.now().toString(36);
  let batchNo = 0;
  let cursor = null;
  const samples = [];

  try {
    for await (const docs of pages(fs_, { start, batchSize: opts.batchSize, limit: opts.limit })) {
      stats.fetched += docs.length;
      const rows = [];
      let batchMax = null;
      for (const doc of docs) {
        const out = transform(doc, Timestamp);
        if (out.skip) {
          stats.skipped += 1;
          console.warn(`  BỎ QUA ${doc.id}: ${out.skip}`);
          continue;
        }
        if (out.ts === null) stats.nullCreatedAt += 1;
        else if (batchMax === null || out.ts.toMillis() >= batchMax.toMillis()) batchMax = out.ts;
        rows.push(out.row);
      }

      if (opts.dryRun) {
        for (const r of rows) if (samples.length < 3) samples.push(r);
      } else if (rows.length > 0) {
        batchNo += 1;
        try {
          const { inserted, updated } = await mergeBatch(bq, cfg, rows, runId, batchNo);
          stats.inserted += inserted;
          stats.updated += updated;
        } catch (err) {
          stats.failed += rows.length;
          throw err;
        }
        // Checkpoint CHI sau khi MERGE xong. Backfill: dat ve luc BAT DAU quet (tru overlap)
        // vi event ghi trong luc quet co the roi vao khoang da di qua.
        if (!opts.backfill && !opts.since && batchMax) {
          cursor = batchMax;
          await saveCheckpoint(db, Timestamp, cursor, { ...stats, mode });
        }
      }
      process.stdout.write(`\r  đã đọc ${stats.fetched} document…`);
    }

    if (!opts.dryRun && opts.backfill) {
      cursor = Timestamp.fromMillis(startedAt.toMillis() - OVERLAP_MS);
      await saveCheckpoint(db, Timestamp, cursor, { ...stats, mode });
    }
  } catch (err) {
    console.error(`\n\nSync THẤT BẠI sau ${stats.fetched} document đã đọc.`);
    console.error(explain(err));
    console.log(summary(stats, cursor));
    process.exit(1);
  }

  console.log(`\n${summary(stats, cursor)}`);

  if (opts.dryRun) {
    console.log('\nMẫu 3 dòng đã biến đổi:');
    for (const r of samples) console.log(`  ${JSON.stringify(r)}`);
    return;
  }

  // Doi chieu so luong: bat seed lui ngay / document bi xoa o Firestore.
  if (!opts.since && !opts.limit) {
    try {
      const fsCount = (await db.collection(EVENTS_COLLECTION).count().get()).data().count;
      const [rows] = await bq.query({ query: `SELECT COUNT(*) AS c FROM \`${cfg.projectId}.${cfg.dataset}.${cfg.table}\`` });
      const bqCount = Number(rows[0].c);
      console.log(`Đối chiếu: Firestore=${fsCount}  BigQuery=${bqCount}`);
      if (fsCount !== bqCount) {
        console.warn(
          '  ⚠ Lệch số lượng. Nguyên nhân thường gặp: event seed ghi lùi ngày (chạy --backfill) ' +
            'hoặc document đã bị xoá ở Firestore (BigQuery không tự xoá theo).',
        );
      }
    } catch (err) {
      console.warn(`Không đối chiếu được số lượng: ${err.message}`);
    }
  }
}

function summary(s, cursor) {
  return [
    `Fetched: ${s.fetched}`,
    `Inserted: ${s.inserted}`,
    `Updated: ${s.updated}`,
    `Skipped: ${s.skipped}`,
    `Failed: ${s.failed}`,
    `created_at NULL: ${s.nullCreatedAt}`,
    `Checkpoint: ${cursor ? cursor.toDate().toISOString() : '(không đổi)'}`,
  ].join('\n');
}

if (require.main === module) {
  main().catch((err) => {
    console.error(explain(err));
    process.exit(1);
  });
}

// Chi de smoke test (khong app nao import file nay).
module.exports = { transform, tsToIso, mergeSql };
