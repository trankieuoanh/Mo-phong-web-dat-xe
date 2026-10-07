#!/usr/bin/env node
/**
 * migrate-firebase-to-d1.js — nap du lieu vao Cloudflare D1 qua REST API.
 *
 *   Firestore `events`, `users`  ──┐
 *   powerBI/*.csv (11 bang)      ──┴──▶  D1 `gsm-db`  (schema: migrations/*.sql)
 *
 * Thiet ke + ly do: docs/d1-schema-design.md. Chay tay, KHONG phai code cua app (khong ai
 * import file nay; khong `server-only`). Khong them thu vien: `fetch` + `firebase-admin`.
 *
 * Cach dung (tu thu muc goc):
 *   node scripts/migrate-firebase-to-d1.js --dry-run        doc + bien doi + dem, KHONG ghi D1
 *   node scripts/migrate-firebase-to-d1.js                  nap tiep, toi da --limit lượt ghi
 *   node scripts/migrate-firebase-to-d1.js --only events,users,dim_user
 *   node scripts/migrate-firebase-to-d1.js --since 2026-10-01T00:00:00Z
 *                                                           CHI events/users MOI sau moc do (delta luc chuyen app sang D1)
 *   node scripts/migrate-firebase-to-d1.js --verify         doi chieu so luong + mau (chi doc)
 *   node scripts/migrate-firebase-to-d1.js --all-rows       nap DU 137k dong (mac dinh chi nap tap con mock — scripts/lib/mock-subset.js)
 *   node scripts/migrate-firebase-to-d1.js --verify --deep  doi chieu 11 bang CSV vs D1 THEO TUNG COT (tong/dem/distinct) + mau theo
 *                                                           khoa chinh + PRAGMA foreign_key_check (chi doc D1, khong ton Firestore)
 *   node scripts/migrate-firebase-to-d1.js --verify --full  doi chieu TUNG TRUONG cua MOI event/user Firestore voi D1 (chi doc;
 *                                                           ton ~1 luot doc Firestore/document)
 *   node scripts/migrate-firebase-to-d1.js --reset-state    quen tien do (nap lai tu dau, van idempotent)
 *   Tuy chon: --limit N (mac dinh 90000), --batch-size N (mac dinh 100 cau lenh / request)
 *
 * IDEMPOTENT: moi dong la `INSERT … ON CONFLICT(khoa chinh) DO UPDATE` — chay lai khong nhan
 * doi, hong giua chung chay tiep duoc. Moi request la mot BATCH = mot transaction (tat ca
 * hoac khong). Tien do luu o scripts/.migrate-d1-state.json SAU moi batch thanh cong.
 *
 * HAN MUC GHI cua goi Free la 100.000 dong/ngay (moi index them 1 luot ghi/dong): script dem
 * `meta.rows_written` THAT do D1 tra ve va DUNG truoc khi vuot --limit, chua 10k cho app.
 *
 * Bien moi truong (.env.local): CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN (quyen D1 Edit),
 * CLOUDFLARE_D1_DATABASE_ID (tuy chon — mac dinh doc tu wrangler.jsonc), va FIREBASE_* de doc
 * Firestore. KHONG BAO GIO in token/private key ra log.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const mock = require('./lib/mock-subset.js');

const ROOT = path.resolve(__dirname, '..');
const CSV_DIR = path.join(ROOT, 'powerBI');
const MIGRATION_DDL = path.join(ROOT, 'migrations', '0002_analytics_schema.sql');
const KEY_PATH = path.join(ROOT, 'serviceAccountKey.json');
const STATE_PATH = path.join(__dirname, '.migrate-d1-state.json');

const DEFAULT_LIMIT = 90000;
const DEFAULT_BATCH = 100;
const RETRIES = 5;
/** Gio dia phuong cua file CSV (cung TZ cua seed-events.js). */
const CSV_TZ = '+07:00';
/** Cot CSV la thoi diem (gio VN) -> doi sang UTC ISO micro-giay. */
const CSV_TIMESTAMP_COLS = new Set(['session_start', 'event_datetime']);

/** Thu tu nap: app, roi dim, roi fact (FOREIGN KEY). Khop thu tu tao bang trong migration. */
const ANALYTICS_TABLES = [
  'dim_region',
  'dim_hex',
  'dim_promo',
  'dim_promo_cap_history',
  'dim_date',
  'dim_merchant',
  'dim_user',
  'fact_promo_budget',
  'fact_ride',
  'fact_food',
  'fact_promo_burn',
];
const ALL_TABLES = ['events', 'users', ...ANALYTICS_TABLES];
/** Luot ghi cho moi dong: events co 3 index phu. */
const WRITES_PER_ROW = { events: 4 };

// ─────────────────────────────────────────────────────────────
// Tien ich
// ─────────────────────────────────────────────────────────────

function fail(message) {
  console.error(`\nLỗi: ${message}`);
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseArgs(argv) {
  const opts = { dryRun: false, verify: false, full: false, deep: false, allRows: false, resetState: false, limit: DEFAULT_LIMIT, batchSize: DEFAULT_BATCH, only: null, since: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (value === undefined) fail(`${arg} cần một giá trị.`);
      i += 1;
      return value;
    };
    switch (arg) {
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--verify':
        opts.verify = true;
        break;
      case '--all-rows':
        opts.allRows = true;
        break;
      case '--deep':
        opts.deep = true;
        break;
      case '--full':
        opts.full = true;
        break;
      case '--reset-state':
        opts.resetState = true;
        break;
      case '--limit':
      case '--batch-size': {
        const n = Number(next());
        if (!Number.isInteger(n) || n < 1) fail(`${arg} phải là số nguyên dương.`);
        if (arg === '--limit') opts.limit = n;
        else opts.batchSize = Math.min(n, 500);
        break;
      }
      case '--since': {
        const d = new Date(next());
        if (Number.isNaN(d.getTime())) fail('--since phải là ngày ISO, vd 2026-10-01T00:00:00Z.');
        opts.since = d;
        break;
      }
      case '--only':
        opts.only = next().split(',').map((s) => s.trim()).filter(Boolean);
        break;
      case '-h':
      case '--help':
        console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^#!.*\n/, ''));
        process.exit(0);
        break;
      default:
        fail(`Tham số không hiểu: ${arg}. Dùng --help.`);
    }
  }
  if (opts.since && !opts.only) opts.only = ['events', 'users']; // delta chi ap dung cho 2 bang nguon Firestore
  if (opts.only) {
    const unknown = opts.only.filter((n) => !ALL_TABLES.includes(n));
    if (unknown.length > 0) fail(`--only: không có bảng ${unknown.join(', ')}. Hợp lệ: ${ALL_TABLES.join(', ')}`);
  }
  return opts;
}

function loadEnv() {
  const envPath = path.join(ROOT, '.env.local');
  if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') process.loadEnvFile(envPath);
}

// ─────────────────────────────────────────────────────────────
// D1 qua REST
// ─────────────────────────────────────────────────────────────

function d1Config() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  let databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  if (!databaseId) {
    try {
      const wrangler = fs.readFileSync(path.join(ROOT, 'wrangler.jsonc'), 'utf8');
      databaseId = /"database_id"\s*:\s*"([0-9a-f-]{36})"/.exec(wrangler)?.[1];
    } catch {
      /* xuong duoi: bao thieu */
    }
  }
  const missing = [
    !accountId && 'CLOUDFLARE_ACCOUNT_ID',
    !token && 'CLOUDFLARE_API_TOKEN',
    !databaseId && 'CLOUDFLARE_D1_DATABASE_ID (hoặc wrangler.jsonc)',
  ].filter(Boolean);
  if (missing.length > 0) fail(`Thiếu cấu hình Cloudflare: ${missing.join(', ')}.`);
  return { url: `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`, token };
}

/**
 * Gui MOT batch (mang cac {sql, params}). Tra ve mang ket qua tung cau lenh.
 * Retry co backoff cho 429/5xx/mang; loi SQL (rang buoc, kieu) nem thang ra — thu lai vo ich.
 */
async function d1Batch(cfg, statements) {
  for (let attempt = 1; ; attempt += 1) {
    let res;
    try {
      res = await fetch(cfg.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(statements.length === 1 ? statements[0] : { batch: statements }),
      });
    } catch (err) {
      if (attempt >= RETRIES) throw new Error(`Không gọi được D1: ${err.message}`);
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < RETRIES) {
      const wait = Number(res.headers.get('retry-after')) * 1000 || 1000 * 2 ** attempt;
      console.warn(`  D1 trả HTTP ${res.status}, thử lại sau ${wait}ms (${attempt}/${RETRIES - 1})`);
      await sleep(wait);
      continue;
    }
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.success) {
      const detail = (body?.errors ?? []).map((e) => `${e.code}: ${e.message}`).join('; ') || `HTTP ${res.status}`;
      throw new Error(`D1 từ chối batch (${statements.length} câu): ${detail}`);
    }
    return body.result;
  }
}

const sumWritten = (results) => results.reduce((n, r) => n + (r?.meta?.rows_written ?? 0), 0);

function upsertSql(table, columns, pk) {
  const updates = columns.filter((c) => !pk.includes(c)).map((c) => `${c} = excluded.${c}`);
  const conflict = updates.length > 0 ? `DO UPDATE SET ${updates.join(', ')}` : 'DO NOTHING';
  return (
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')}) ` +
    `ON CONFLICT(${pk.join(', ')}) ${conflict}`
  );
}

// ─────────────────────────────────────────────────────────────
// Nguon 1: CSV  (kieu cot lay tu CHINH file migration, khong suy doan)
// ─────────────────────────────────────────────────────────────

/** Doc `migrations/0002_analytics_schema.sql` -> { bang: { columns:[{name,type}], pk:[...] } }. */
function readAnalyticsSchema() {
  const ddl = fs.readFileSync(MIGRATION_DDL, 'utf8');
  const schema = {};
  for (const m of ddl.matchAll(/CREATE TABLE (\w+) \(([\s\S]*?)\n\) WITHOUT ROWID;/g)) {
    const columns = [];
    let pk = [];
    for (const raw of m[2].split('\n')) {
      const line = raw.trim().replace(/,$/, '');
      const composite = /^PRIMARY KEY \(([^)]+)\)$/.exec(line);
      if (composite) {
        pk = composite[1].split(',').map((s) => s.trim());
        continue;
      }
      if (line.startsWith('FOREIGN KEY')) continue;
      const col = /^(\w+) (TEXT|INTEGER|REAL)\b(.*)$/.exec(line);
      if (!col) continue;
      columns.push({ name: col[1], type: col[2] });
      if (/PRIMARY KEY/.test(col[3])) pk = [col[1]];
    }
    schema[m[1]] = { columns, pk };
  }
  return schema;
}

/** Parser CSV toi thieu (dau nhay kep, "" thoat, CRLF). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** `2026-06-01 10:02:42` (gio VN) -> `2026-06-01T03:02:42.000000Z`. */
function csvTimeToUtcIso(raw) {
  const d = new Date(`${raw.replace(' ', 'T')}${CSV_TZ}`);
  if (Number.isNaN(d.getTime())) throw new Error(`thời điểm sai: "${raw}"`);
  return `${d.toISOString().slice(0, 19)}.000000Z`;
}

function convertCsvValue(col, raw, table, line) {
  if (raw === '') return null;
  try {
    if (CSV_TIMESTAMP_COLS.has(col.name)) return csvTimeToUtcIso(raw);
    if (col.type === 'TEXT') return raw;
    if (raw === 'True') return 1;
    if (raw === 'False') return 0;
    const n = Number(raw);
    if (!Number.isFinite(n)) throw new Error(`"${raw}" không phải số`);
    if (col.type === 'INTEGER' && !Number.isInteger(n)) throw new Error(`"${raw}" không phải số nguyên`);
    return n;
  } catch (err) {
    throw new Error(`${table} dòng ${line}, cột ${col.name}: ${err.message}`);
  }
}

function loadCsvTable(table, spec) {
  const file = path.join(CSV_DIR, `${table}.csv`);
  if (!fs.existsSync(file)) fail(`Không thấy ${path.relative(ROOT, file)}.`);
  let text = fs.readFileSync(file, 'utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM do Power BI xuat
  const [header, ...body] = parseCsv(text);
  const missing = spec.columns.filter((c) => !header.includes(c.name)).map((c) => c.name);
  const extra = header.filter((h) => !spec.columns.some((c) => c.name === h));
  if (missing.length > 0 || extra.length > 0) {
    fail(`${table}.csv lệch schema D1 — thiếu: [${missing}] thừa: [${extra}]`);
  }
  const index = new Map(header.map((h, i) => [h, i]));
  return body.map((cells, i) => spec.columns.map((col) => convertCsvValue(col, cells[index.get(col.name)] ?? '', table, i + 2)));
}

let ALL_ROWS = false; // --all-rows
let loadedSessionIds = null;

/** session_id dang co (hoac se co) trong D1: fact_ride day du + phan fact_food theo tap con. */
function sessionIdsOfLoaded(schema) {
  if (loadedSessionIds) return loadedSessionIds;
  const ids = new Set();
  for (const [table, limit] of [['fact_ride', Infinity], ['fact_food', mock.LIMITS.fact_food]]) {
    const names = schema[table].columns.map((c) => c.name);
    const at = names.indexOf('session_id');
    loadCsvTable(table, schema[table]).slice(0, limit).forEach((r) => ids.add(r[at]));
  }
  loadedSessionIds = ids;
  return ids;
}

/** Dong CSV can nap/doi chieu cho `table` — tap con mock mac dinh, du bo `--all-rows`. */
function loadRows(table, schema) {
  const rows = loadCsvTable(table, schema[table]);
  if (ALL_ROWS) return rows;
  return mock.subset(table, rows, schema[table].columns.map((c) => c.name), () => sessionIdsOfLoaded(schema));
}

// ─────────────────────────────────────────────────────────────
// Nguon 2: Firestore (events, users)
// ─────────────────────────────────────────────────────────────

function connectFirestore() {
  const { cert, getApps, initializeApp } = require('firebase-admin/app');
  const { getFirestore, Timestamp, FieldPath } = require('firebase-admin/firestore');
  let credential;
  if (fs.existsSync(KEY_PATH)) credential = cert(require(KEY_PATH));
  else {
    const { FIREBASE_PROJECT_ID: projectId, FIREBASE_CLIENT_EMAIL: clientEmail, FIREBASE_PRIVATE_KEY: privateKey } = process.env;
    if (!projectId || !clientEmail || !privateKey) fail('Thiếu credential Firebase (FIREBASE_* trong .env.local).');
    credential = cert({ projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, '\n') });
  }
  const app = getApps()[0] ?? initializeApp({ credential });
  return { db: getFirestore(app), Timestamp, FieldPath };
}

/** Timestamp Firestore -> `YYYY-MM-DDTHH:MM:SS.ffffffZ`. Nano-giay bi cat con micro-giay. */
function tsToIso(ts) {
  const base = new Date(ts.seconds * 1000).toISOString().slice(0, 19);
  return `${base}.${String(ts.nanoseconds).padStart(9, '0').slice(0, 6)}Z`;
}

const EVENT_COLUMNS = [
  'id', 'session_id', 'user_id', 'flow', 'event_name', 'screen_name', 'previous_screen',
  'step_index', 'properties', 'platform', 'created_at', 'seed_batch',
];
const USER_COLUMNS = ['phone', 'created_at', 'last_login_at'];

/** -> { params } hoac { skip: 'ly do' }. Khong bao gio thay created_at thieu bang gio hien tai. */
function eventParams(doc, Timestamp) {
  const d = doc.data();
  for (const f of ['session_id', 'user_id', 'flow', 'event_name', 'screen_name']) {
    if (typeof d[f] !== 'string' || d[f] === '') return { skip: `thiếu/sai ${f}` };
  }
  if (!['ride', 'food', 'none'].includes(d.flow)) return { skip: `flow lạ "${d.flow}"` };
  if (!Number.isInteger(d.step_index) || d.step_index < 0) return { skip: 'thiếu/sai step_index' };
  if (!(d.created_at instanceof Timestamp)) return { skip: 'thiếu created_at (cột NOT NULL)' };
  const properties = d.properties ?? {};
  if (typeof properties !== 'object' || Array.isArray(properties)) return { skip: 'properties không phải object' };
  return {
    params: [
      doc.id, d.session_id, d.user_id, d.flow, d.event_name, d.screen_name,
      typeof d.previous_screen === 'string' ? d.previous_screen : null,
      d.step_index, JSON.stringify(properties),
      typeof d.platform === 'string' ? d.platform : 'web',
      tsToIso(d.created_at),
      typeof d.seed_batch === 'string' ? d.seed_batch : null,
    ],
  };
}

function userParams(doc, Timestamp) {
  const d = doc.data();
  const created = d.created_at instanceof Timestamp ? d.created_at : null;
  const last = d.last_login_at instanceof Timestamp ? d.last_login_at : null;
  if (!created && !last) return { skip: 'không có created_at lẫn last_login_at' };
  // Hai cot NOT NULL: neu thieu mot cai thi muon cai con lai (cung la lan dang nhap that).
  return { params: [doc.id, tsToIso(created ?? last), tsToIso(last ?? created)] };
}

// ─────────────────────────────────────────────────────────────
// Trang thai + chay
// ─────────────────────────────────────────────────────────────

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return { done: {}, events_last_id: null, users_last_id: null };
  }
}

const writeState = (state) => fs.writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);

/** Nap mot mang `rows` (moi phan tu la mang params) vao `table`. Tra ve so dong da ghi trong lan nay. */
async function pushRows({ cfg, table, columns, pk, rows, startAt, budget, batchSize, onProgress }) {
  const sql = upsertSql(table, columns, pk);
  const perRow = WRITES_PER_ROW[table] ?? 1;
  let pos = startAt;
  let written = 0;
  while (pos < rows.length) {
    const room = Math.floor((budget - written) / perRow);
    if (room <= 0) return { pos, written, stoppedByLimit: true };
    const chunk = rows.slice(pos, pos + Math.min(batchSize, room));
    const results = await d1Batch(cfg, chunk.map((params) => ({ sql, params })));
    written += sumWritten(results);
    pos += chunk.length;
    onProgress(pos, written);
  }
  return { pos, written, stoppedByLimit: false };
}

async function runMigrate(opts) {
  const only = new Set(opts.only ?? ALL_TABLES);
  if (opts.resetState && fs.existsSync(STATE_PATH)) fs.unlinkSync(STATE_PATH);
  const state = readState();
  const cfg = opts.dryRun ? null : d1Config();
  const schema = readAnalyticsSchema();
  for (const t of ANALYTICS_TABLES) if (!schema[t]) fail(`Không đọc được DDL của ${t} từ migrations/0002.`);

  let budget = opts.limit;
  let totalWritten = 0;
  const report = [];
  console.log(`Chế độ: ${opts.dryRun ? 'DRY RUN (không ghi D1)' : 'GHI D1'} · giới hạn ${opts.limit} lượt ghi · batch ${opts.batchSize}\n`);

  const consume = (n) => {
    totalWritten += n;
    budget -= n;
  };

  // ── events + users từ Firestore ──
  const needFirestore = ['events', 'users'].some((t) => only.has(t));
  const fsx = needFirestore ? connectFirestore() : null;

  for (const [table, columns, mapper, stateKey] of [
    ['events', EVENT_COLUMNS, eventParams, 'events_last_id'],
    ['users', USER_COLUMNS, userParams, 'users_last_id'],
  ]) {
    if (!only.has(table)) continue;
    if (budget <= 0) {
      report.push(`${table}: bỏ qua (hết hạn mức lượt này)`);
      continue;
    }
    const { db, Timestamp, FieldPath } = fsx;
    const pk = [columns[0]];
    // --since: doc theo thoi gian (bat event MOI co id nho hon con tro `lastId`), khong dung/khong ghi con tro id.
    const sinceTs = opts.since ? Timestamp.fromDate(opts.since) : null;
    const timeField = table === 'events' ? 'created_at' : 'last_login_at';
    let lastId = opts.dryRun || sinceTs ? null : state[stateKey]; // dry-run dem TOAN BO, khong theo tien do
    let lastSnap = null;
    let read = 0;
    let skipped = 0;
    let wrote = 0;
    let hitLimit = false;
    for (;;) {
      let q = sinceTs
        ? db.collection(table).where(timeField, '>=', sinceTs).orderBy(timeField).orderBy(FieldPath.documentId()).limit(500)
        : db.collection(table).orderBy(FieldPath.documentId()).limit(500);
      if (sinceTs ? lastSnap : lastId) q = q.startAfter(sinceTs ? lastSnap : lastId);
      const snap = await q.get();
      if (snap.empty) break;
      const rows = [];
      let lastGood = lastId;
      for (const doc of snap.docs) {
        read += 1;
        const out = mapper(doc, Timestamp);
        if (out.skip) {
          skipped += 1;
          console.warn(`  BỎ QUA ${table}/${doc.id}: ${out.skip}`);
        } else rows.push(out.params);
        lastGood = doc.id;
        lastSnap = doc;
      }
      if (opts.dryRun) {
        wrote += rows.length;
        lastId = lastGood;
        continue;
      }
      const r = await pushRows({
        cfg, table, columns, pk, rows, startAt: 0, budget, batchSize: opts.batchSize,
        onProgress: (p) => process.stdout.write(`\r${table}: ${wrote + p} dòng…`),
      });
      wrote += r.pos;
      consume(r.written);
      if (r.stoppedByLimit) {
        // Chi nho toi dong CUOI DA GHI trong trang nay (params[0] = id); dong bi bo qua
        // nam giua se duoc doc/bo qua lai lan sau — vo hai.
        if (r.pos > 0) lastId = rows[r.pos - 1][0];
        hitLimit = true;
        break;
      }
      lastId = lastGood;
      if (!sinceTs) {
        state[stateKey] = lastId;
        writeState(state);
      }
      if (snap.size < 500) break;
    }
    if (!opts.dryRun && !sinceTs) {
      state[stateKey] = lastId;
      writeState(state);
    }
    report.push(`${table}: đọc ${read}, ${opts.dryRun ? 'sẽ ghi' : 'đã ghi'} ${wrote}, bỏ qua ${skipped}${hitLimit ? '  ⏸ dừng vì hạn mức' : ''}`);
    process.stdout.write('\n');
  }

  // ── 11 bảng CSV ──
  for (const table of ANALYTICS_TABLES) {
    if (!only.has(table) || opts.since) continue;
    const spec = schema[table];
    const rows = loadRows(table, schema);
    const done = state.done[table] ?? 0;
    if (opts.dryRun) {
      report.push(`${table}: ${rows.length} dòng CSV hợp lệ (đã nạp: ${done})`);
      continue;
    }
    if (done >= rows.length) {
      report.push(`${table}: đã đủ ${rows.length}/${rows.length}`);
      continue;
    }
    if (budget <= 0) {
      report.push(`${table}: ${done}/${rows.length}  ⏸ chưa nạp (hết hạn mức lượt này)`);
      continue;
    }
    const r = await pushRows({
      cfg, table, columns: spec.columns.map((c) => c.name), pk: spec.pk, rows, startAt: done,
      budget, batchSize: opts.batchSize,
      onProgress: (p) => process.stdout.write(`\r${table}: ${p}/${rows.length}`),
    });
    consume(r.written);
    state.done[table] = r.pos;
    writeState(state);
    process.stdout.write('\n');
    report.push(`${table}: ${r.pos}/${rows.length}${r.stoppedByLimit ? '  ⏸ dừng vì hạn mức' : ' ✓'}`);
  }

  console.log(`\n── Kết quả ──\n${report.join('\n')}`);
  if (!opts.dryRun) {
    console.log(`\nSố lượt ghi D1 thật sự lần này: ${totalWritten} (hạn mức ${opts.limit}).`);
    const left = ALL_TABLES.filter((t) => only.has(t)).some((t) => report.some((l) => l.startsWith(`${t}:`) && l.includes('⏸')));
    if (left) console.log('Còn dữ liệu chưa nạp — chạy lại cùng lệnh khi hạn mức ngày mới (Spark/Free) được reset.');
  }
}

// ─────────────────────────────────────────────────────────────
// --verify: doi chieu (chi doc)
// ─────────────────────────────────────────────────────────────

async function runVerify(opts) {
  const cfg = d1Config();
  const schema = readAnalyticsSchema();
  const { db } = connectFirestore();
  const rows = [];
  let bad = 0;

  const count = async (table) => {
    const r = await d1Batch(cfg, [{ sql: `SELECT COUNT(*) AS n FROM ${table}`, params: [] }]);
    return Number((r[0] ?? r).results[0].n);
  };

  for (const table of ['events', 'users']) {
    const fsCount = (await db.collection(table).count().get()).data().count;
    const d1Count = await count(table);
    const ok = fsCount === d1Count;
    if (!ok) bad += 1;
    rows.push(`| ${table} | Firestore ${fsCount} | D1 ${d1Count} | ${ok ? '✅' : '❌ lệch ' + (d1Count - fsCount)} |`);
  }
  for (const table of ANALYTICS_TABLES) {
    const csvCount = loadRows(table, schema).length;
    const d1Count = await count(table);
    const ok = csvCount === d1Count;
    if (!ok) bad += 1;
    rows.push(`| ${table} | CSV ${csvCount} | D1 ${d1Count} | ${ok ? '✅' : d1Count < csvCount ? `⏳ thiếu ${csvCount - d1Count}` : '❌ thừa'} |`);
  }
  console.log('| Bảng | Nguồn | D1 | Kết quả |\n|---|---|---|---|');
  console.log(rows.join('\n'));

  // Mau: 5 event ngau nhien (theo id) so tung truong.
  const sample = await d1Batch(cfg, [{ sql: 'SELECT * FROM events ORDER BY RANDOM() LIMIT 5', params: [] }]);
  const picked = (sample[0] ?? sample).results;
  let sampleBad = 0;
  for (const row of picked) {
    const snap = await db.collection('events').doc(row.id).get();
    const d = snap.data();
    const same =
      snap.exists &&
      d.session_id === row.session_id && d.user_id === row.user_id && d.flow === row.flow &&
      d.event_name === row.event_name && d.screen_name === row.screen_name &&
      (d.previous_screen ?? null) === row.previous_screen && d.step_index === row.step_index &&
      JSON.stringify(d.properties ?? {}) === JSON.stringify(JSON.parse(row.properties)) &&
      tsToIso(d.created_at) === row.created_at && (d.seed_batch ?? null) === row.seed_batch;
    if (!same) sampleBad += 1;
    console.log(`  mẫu events/${row.id}: ${same ? '✅ khớp từng trường' : '❌ KHÁC'}`);
  }
  if (picked.length === 0) console.log('  (chưa có event nào trong D1 để lấy mẫu)');
  process.exit(bad > 0 || sampleBad > 0 ? 2 : 0);
}

/** So sanh TUNG TRUONG cua moi event/user Firestore voi D1. Chi doc. */
async function runVerifyFull() {
  const cfg = d1Config();
  const { db, Timestamp } = connectFirestore();
  const q = async (sql, params = []) => (await d1Batch(cfg, [{ sql, params }]))[0].results;

  const d1Events = new Map();
  for (let last = null; ; ) {
    const page = last
      ? await q('SELECT * FROM events WHERE (created_at, id) > (?, ?) ORDER BY created_at, id LIMIT 1000', [last.created_at, last.id])
      : await q('SELECT * FROM events ORDER BY created_at, id LIMIT 1000');
    page.forEach((r) => d1Events.set(r.id, r));
    if (page.length < 1000) break;
    last = page[page.length - 1];
  }

  const diffs = { missing: [], field: [] };
  let compared = 0;
  const snap = await db.collection('events').get();
  for (const doc of snap.docs) {
    compared += 1;
    const d = doc.data();
    const row = d1Events.get(doc.id);
    if (!row) {
      diffs.missing.push(doc.id);
      continue;
    }
    const want = {
      session_id: d.session_id, user_id: d.user_id, flow: d.flow, event_name: d.event_name, screen_name: d.screen_name,
      previous_screen: d.previous_screen ?? null, step_index: d.step_index, platform: d.platform ?? 'web',
      created_at: tsToIso(d.created_at), seed_batch: d.seed_batch ?? null,
    };
    for (const [k, v] of Object.entries(want)) {
      if (row[k] !== v) diffs.field.push(`${doc.id}.${k}: firestore=${JSON.stringify(v)} d1=${JSON.stringify(row[k])}`);
    }
    if (JSON.stringify(d.properties ?? {}) !== JSON.stringify(JSON.parse(row.properties))) diffs.field.push(`${doc.id}.properties khác`);
  }
  console.log(`events: so ${compared} document Firestore với D1 (D1 có ${d1Events.size} dòng; dòng thừa so với Firestore: ${[...d1Events.keys()].filter((id) => !snap.docs.some((x) => x.id === id)).length})`);
  console.log(`  thiếu ở D1: ${diffs.missing.length}   lệch trường: ${diffs.field.length}`);
  diffs.field.slice(0, 10).forEach((l) => console.log(`    ${l}`));

  const usersSnap = await db.collection('users').get();
  const d1Users = new Map((await q('SELECT * FROM users')).map((r) => [r.phone, r]));
  let userBad = 0;
  for (const doc of usersSnap.docs) {
    const d = doc.data();
    const row = d1Users.get(doc.id);
    const created = d.created_at instanceof Timestamp ? tsToIso(d.created_at) : null;
    const last = d.last_login_at instanceof Timestamp ? tsToIso(d.last_login_at) : null;
    if (!row || row.created_at !== (created ?? last) || row.last_login_at !== (last ?? created)) userBad += 1;
  }
  console.log(`users: so ${usersSnap.size} document, lệch: ${userBad}`);
  process.exit(diffs.missing.length + diffs.field.length + userBad > 0 ? 2 : 0);
}

/**
 * Doi chieu SAU (chi doc D1): moi cot cua moi bang CSV duoc so bang tong hop (dem khac NULL, TOTAL cho cot so,
 * COUNT DISTINCT + tong do dai cho cot chuoi) tinh o CA HAI PHIA, cong mau theo khoa chinh so tung o, cong
 * `PRAGMA foreign_key_check`. Bang chua nap du (D1 < CSV) chi bao ⏳, khong tinh la loi.
 */
async function runVerifyDeep(opts) {
  const cfg = d1Config();
  const schema = readAnalyticsSchema();
  const q = async (sql, params = []) => (await d1Batch(cfg, [{ sql, params }]))[0].results;
  const tables = ANALYTICS_TABLES.filter((t) => !opts.only || opts.only.includes(t));
  const approx = (a, b) => (a === b) || (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b)));
  let bad = 0;
  let pending = 0;

  for (const table of tables) {
    const spec = schema[table];
    const rows = loadRows(table, schema);
    const names = spec.columns.map((c) => c.name);
    const d1Count = Number((await q(`SELECT COUNT(*) AS n FROM ${table}`))[0].n);
    if (d1Count < rows.length) {
      pending += 1;
      console.log(`⏳ ${table}: D1 ${d1Count}/${rows.length} — chưa nạp đủ, bỏ qua đối chiếu sâu`);
      continue;
    }
    const problems = [];
    if (d1Count !== rows.length) problems.push(`số dòng D1 ${d1Count} ≠ CSV ${rows.length}`);

    // 1) Tong hop theo TUNG COT, cat nhom 30 cot / cau lenh.
    for (let from = 0; from < spec.columns.length; from += 30) {
      const group = spec.columns.slice(from, from + 30);
      const exprs = group.flatMap((c, i) =>
        c.type === 'TEXT'
          ? [`COUNT(${c.name}) AS n${i}`, `COUNT(DISTINCT ${c.name}) AS d${i}`, `COALESCE(SUM(LENGTH(${c.name})), 0) AS l${i}`]
          : [`COUNT(${c.name}) AS n${i}`, `TOTAL(${c.name}) AS s${i}`],
      );
      const got = (await q(`SELECT ${exprs.join(', ')} FROM ${table}`))[0];
      group.forEach((c, i) => {
        const colIdx = from + i;
        const vals = rows.map((r) => r[colIdx]).filter((v) => v !== null);
        if (got[`n${i}`] !== vals.length) problems.push(`${c.name}: số ô khác NULL D1 ${got[`n${i}`]} ≠ CSV ${vals.length}`);
        if (c.type === 'TEXT') {
          if (got[`d${i}`] !== new Set(vals).size) problems.push(`${c.name}: số giá trị phân biệt D1 ${got[`d${i}`]} ≠ CSV ${new Set(vals).size}`);
          const len = vals.reduce((n, v) => n + [...v].length, 0);
          if (got[`l${i}`] !== len) problems.push(`${c.name}: tổng độ dài D1 ${got[`l${i}`]} ≠ CSV ${len}`);
        } else {
          const sum = vals.reduce((n, v) => n + v, 0);
          if (!approx(got[`s${i}`], sum)) problems.push(`${c.name}: tổng D1 ${got[`s${i}`]} ≠ CSV ${sum}`);
        }
      });
    }

    // 2) Mau theo khoa chinh so TUNG O (dong dau, dong cuoi + ~100 dong ngau nhien; bang < 400 dong thi so het).
    const pk = spec.pk;
    const pkIdx = pk.map((k) => names.indexOf(k));
    const picked = rows.length <= 400
      ? rows
      : [rows[0], rows[rows.length - 1], ...Array.from({ length: 100 }, () => rows[Math.floor(Math.random() * rows.length)])];
    let compared = 0;
    for (let i = 0; i < picked.length; ) {
      const chunk = picked.slice(i, i + Math.floor(90 / pk.length));
      i += chunk.length;
      const cond = chunk.map(() => `(${pk.map((k) => `${k} = ?`).join(' AND ')})`).join(' OR ');
      const got = await q(`SELECT * FROM ${table} WHERE ${cond}`, chunk.flatMap((r) => pkIdx.map((j) => r[j])));
      const byKey = new Map(got.map((g) => [pk.map((k) => g[k]).join('\u0001'), g]));
      for (const r of chunk) {
        compared += 1;
        const g = byKey.get(pkIdx.map((j) => r[j]).join('\u0001'));
        if (!g) {
          problems.push(`thiếu dòng PK=${pkIdx.map((j) => r[j]).join('/')}`);
          continue;
        }
        names.forEach((n, j) => {
          if (!approx(g[n] ?? null, r[j])) problems.push(`PK=${pkIdx.map((x) => r[x]).join('/')} cột ${n}: D1 ${JSON.stringify(g[n])} ≠ CSV ${JSON.stringify(r[j])}`);
        });
      }
    }

    // 3) Khoa ngoai (D1 bat FK khi ghi; quet lai toan bo bang).
    const fk = await q(`PRAGMA foreign_key_check(${table})`).catch((e) => [{ error: e.message }]);
    if (fk.length > 0) problems.push(`foreign_key_check: ${fk.length} vi phạm ${JSON.stringify(fk[0]).slice(0, 120)}`);

    if (problems.length > 0) bad += 1;
    console.log(`${problems.length === 0 ? '✅' : '❌'} ${table}: ${rows.length} dòng · ${spec.columns.length} cột đối chiếu theo tổng hợp · ${compared} dòng so từng ô${problems.length ? '\n    ' + problems.slice(0, 8).join('\n    ') : ''}`);
  }

  if (!opts.only || opts.only.includes('fact_promo_burn')) {
    // 4) Quan he cheo bang: moi burn tro toi mot session co that.
    const orphan = await q('SELECT COUNT(*) AS n FROM fact_promo_burn b WHERE b.session_id NOT IN (SELECT session_id FROM fact_ride) AND b.session_id NOT IN (SELECT session_id FROM fact_food)');
    const burnN = Number((await q('SELECT COUNT(*) AS n FROM fact_promo_burn'))[0].n);
    if (burnN > 0) {
      console.log(`${orphan[0].n === 0 ? '✅' : '❌'} fact_promo_burn.session_id → fact_ride/fact_food: ${orphan[0].n} dòng mồ côi`);
      if (orphan[0].n !== 0) bad += 1;
    }
  }
  console.log(`\n${bad === 0 ? (pending === 0 ? 'TẤT CẢ ĐỐI CHIẾU SÂU ĐẠT.' : `Các bảng đã nạp đều đạt; còn ${pending} bảng chưa nạp đủ.`) : `${bad} bảng/quan hệ LỆCH.`}`);
  process.exit(bad > 0 ? 2 : pending > 0 ? 3 : 0);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  ALL_ROWS = opts.allRows;
  loadEnv();
  if (opts.verify && opts.deep) return runVerifyDeep(opts);
  if (opts.verify && opts.full) return runVerifyFull();
  if (opts.verify) return runVerify(opts);
  return runMigrate(opts);
}

main().catch((err) => {
  console.error(`\nThất bại: ${err.message}`);
  console.error('Tiến độ các batch đã xong được giữ nguyên; sửa lỗi rồi chạy lại cùng lệnh (idempotent).');
  process.exit(1);
});
