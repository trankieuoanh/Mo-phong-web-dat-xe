#!/usr/bin/env node
/**
 * import-powerbi.js — nap 11 file CSV trong `powerBI/` vao Firestore.
 *
 * Moi CSV thanh MOT collection `pbi_<ten file>` (bo hau to `(1)`), doc id la
 * khoa tu nhien (R0000001, U00001, WELCOME30-v1…), nen chay lai la GHI DE chu
 * khong nhan doi. Khong dong vao collection `events`/`users` cua app.
 *
 * Moi document co them field `import_batch` (giong `seed_batch` cua
 * seed-events.js): `--clear` chi xoa nhung document co field do.
 *
 * GOI SPARK (20k write/ngay): script mac dinh chi ghi toi da 18.000 document moi
 * lan chay va nho tien do o `scripts/.import-powerbi-state.json`. Chay lai cung
 * lenh moi ngay se nap tiep. Dim nap truoc (≈4k dong), fact sau.
 *
 * Cach dung (tu thu muc goc):
 *   node scripts/import-powerbi.js --dry-run            xem truoc, khong can credential
 *   node scripts/import-powerbi.js                       nap tiep, toi da 18.000 write
 *   node scripts/import-powerbi.js --limit 100000        goi Blaze: nap nhieu hon
 *   node scripts/import-powerbi.js --only dim_promo,dim_region
 *   node scripts/import-powerbi.js --clear               xoa moi document pbi_* da nap
 *   node scripts/import-powerbi.js --reset-state         quen tien do (nap lai tu dau)
 *
 * Credential: giong seed-events.js (serviceAccountKey.json hoac .env.local).
 * Khong them thu vien nao (CLAUDE.md quy tac 8).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CSV_DIR = path.join(ROOT, 'powerBI');
const KEY_PATH = path.join(ROOT, 'serviceAccountKey.json');
const STATE_PATH = path.join(__dirname, '.import-powerbi-state.json');

const COLLECTION_PREFIX = 'pbi_';
const DEFAULT_LIMIT = 18000;
const CLEAR_PAGE = 400;

/** Gio dia phuong cua du lieu (cung TZ_OFFSET cua seed-events.js). */
const TZ = '+07:00';

/**
 * Thu tu nap = thu tu mang nay: dim truoc, fact nho truoc fact lon.
 * `file` la ten that tren dia; `id` tinh doc id tu mot dong da parse.
 */
const TABLES = [
  { name: 'dim_region', file: 'dim_region.csv', id: (r) => r.region_id },
  { name: 'dim_hex', file: 'dim_hex.csv', id: (r) => r.hex_id },
  { name: 'dim_promo', file: 'dim_promo.csv', id: (r) => r.promo_code },
  { name: 'dim_promo_cap_history', file: 'dim_promo_cap_history.csv', id: (r) => r.cap_version_id },
  { name: 'dim_date', file: 'dim_date.csv', id: (r) => r.date_key },
  { name: 'dim_merchant', file: 'dim_merchant.csv', id: (r) => r.merchant_id },
  { name: 'dim_user', file: 'dim_user.csv', id: (r) => r.user_id },
  {
    name: 'fact_promo_budget',
    file: 'fact_promo_budget.csv',
    id: (r) => [r.month_start, r.service, r.hex_id, r.segment].join('_'),
  },
  { name: 'fact_promo_burn', file: 'fact_promo_burn.csv', id: (r) => r.burn_event_id },
  { name: 'fact_ride', file: 'fact_ride(1).csv', id: (r) => r.session_id },
  { name: 'fact_food', file: 'fact_food(1).csv', id: (r) => r.session_id },
];

/** Cot thanh Timestamp (gio VN). Cac cot ngay `YYYY-MM-DD` khac giu nguyen chuoi. */
const TIMESTAMP_COLS = new Set(['session_start', 'event_datetime']);

// ─────────────────────────────────────────────────────────────
// Tham so dong lenh
// ─────────────────────────────────────────────────────────────

function fail(message) {
  console.error(`\nLỗi: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const opts = { dryRun: false, clear: false, resetState: false, limit: DEFAULT_LIMIT, only: null };
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
      case '--clear':
        opts.clear = true;
        break;
      case '--reset-state':
        opts.resetState = true;
        break;
      case '--limit': {
        const n = Number(next());
        if (!Number.isInteger(n) || n < 1) fail('--limit phải là số nguyên dương.');
        opts.limit = n;
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
  if (opts.only) {
    const unknown = opts.only.filter((n) => !TABLES.some((t) => t.name === n));
    if (unknown.length > 0) {
      fail(`--only: không có bảng ${unknown.join(', ')}. Hợp lệ: ${TABLES.map((t) => t.name).join(', ')}`);
    }
  }
  return opts;
}

// ─────────────────────────────────────────────────────────────
// CSV
// ─────────────────────────────────────────────────────────────

/** Parser CSV toi thieu: dau nhay kep, "" thoat, CRLF. File goc khong co dau nhay nhung van xu ly dung. */
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

const NUMBER_RE = /^-?\d+(\.\d+)?$/;

/** Cot luon la chuoi du gia tri trong nhu so (vd hex_id chi gom chu so). */
function isStringCol(col) {
  return col.endsWith('_id') || col.endsWith('_code') || col === 'date';
}

function convert(col, raw) {
  if (raw === '') return null;
  if (raw === 'True') return true;
  if (raw === 'False') return false;
  if (TIMESTAMP_COLS.has(col)) return { __ts: raw };
  if (!isStringCol(col) && NUMBER_RE.test(raw)) return Number(raw);
  return raw;
}

function loadTable(table) {
  const file = path.join(CSV_DIR, table.file);
  if (!fs.existsSync(file)) fail(`Không thấy ${path.relative(ROOT, file)}.`);
  let text = fs.readFileSync(file, 'utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM do Power BI xuat
  const [header, ...body] = parseCsv(text);
  return body.map((cells) => {
    const row = {};
    header.forEach((col, i) => {
      row[col] = convert(col, cells[i] ?? '');
    });
    return row;
  });
}

/** Bien `{__ts: '2026-06-01 10:02:42'}` thanh Timestamp that khi da co Firestore. */
function toDoc(row, Timestamp, batchId) {
  const doc = {};
  for (const [k, v] of Object.entries(row)) {
    if (v !== null && typeof v === 'object' && '__ts' in v) {
      const d = new Date(`${v.__ts.replace(' ', 'T')}${TZ}`);
      if (Number.isNaN(d.getTime())) fail(`Ngày giờ sai ở cột ${k}: "${v.__ts}"`);
      doc[k] = Timestamp ? Timestamp.fromDate(d) : d.toISOString();
    } else doc[k] = v;
  }
  doc.import_batch = batchId;
  return doc;
}

// ─────────────────────────────────────────────────────────────
// Trang thai nap (resume)
// ─────────────────────────────────────────────────────────────

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function writeState(state) {
  fs.writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
}

function newBatchId() {
  return `pbi-${new Date().toISOString().replace(/[:.]/g, '-')}`;
}

// ─────────────────────────────────────────────────────────────
// Firestore — credential giong seed-events.js
// ─────────────────────────────────────────────────────────────

function readCredential() {
  const { cert } = require('firebase-admin/app');

  if (fs.existsSync(KEY_PATH)) {
    return { credential: cert(require(KEY_PATH)), source: path.relative(ROOT, KEY_PATH) };
  }

  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) {
    fail(
      'Không tìm thấy credential Firebase (serviceAccountKey.json hoặc .env.local).\n' +
        'Chép .env.example thành .env.local rồi điền giá trị (setup.md Phase 1).\n' +
        'Muốn xem trước dữ liệu mà chưa cần credential thì chạy với --dry-run.',
    );
  }
  if (typeof process.loadEnvFile !== 'function') {
    fail(`Node ${process.version} quá cũ để đọc .env.local (cần Node 20.12+).`);
  }
  process.loadEnvFile(envPath);

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const missing = [
    !projectId && 'FIREBASE_PROJECT_ID',
    !clientEmail && 'FIREBASE_CLIENT_EMAIL',
    !privateKey && 'FIREBASE_PRIVATE_KEY',
  ].filter(Boolean);
  if (missing.length > 0) fail(`.env.local thiếu biến: ${missing.join(', ')}. Xem setup.md Phase 1.`);

  return {
    credential: cert({ projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, '\n') }),
    source: '.env.local',
  };
}

function connect() {
  let appModule;
  let firestoreModule;
  try {
    appModule = require('firebase-admin/app');
    firestoreModule = require('firebase-admin/firestore');
  } catch {
    fail("Không import được 'firebase-admin'. Chạy `npm install` ở thư mục gốc rồi thử lại.");
  }
  const { credential, source } = readCredential();
  console.log(`Credential Firebase lấy từ: ${source}`);
  // getApps() truoc initializeApp — cung ly do voi lib/server/db/firebase-admin.ts.
  const app = appModule.getApps()[0] ?? appModule.initializeApp({ credential });
  return { db: firestoreModule.getFirestore(app), Timestamp: firestoreModule.Timestamp };
}

// ─────────────────────────────────────────────────────────────
// Cac lenh
// ─────────────────────────────────────────────────────────────

function selectedTables(opts) {
  return opts.only ? TABLES.filter((t) => opts.only.includes(t.name)) : TABLES;
}

function dryRun(opts) {
  console.log('DRY RUN — không ghi gì.\n');
  const state = readState();
  let total = 0;
  for (const table of selectedTables(opts)) {
    const rows = loadTable(table);
    const done = state?.progress?.[table.name] ?? 0;
    total += rows.length;
    const ids = new Set(rows.map(table.id));
    console.log(
      `${(COLLECTION_PREFIX + table.name).padEnd(34)} ${String(rows.length).padStart(6)} dòng` +
        `  (đã nạp: ${done})` +
        (ids.size === rows.length ? '' : `  ⚠ id trùng: ${rows.length - ids.size}`),
    );
    if (rows.length > 0) {
      console.log(`  doc id mẫu: ${table.id(rows[0])}`);
      console.log(`  ${JSON.stringify(toDoc(rows[0], null, '<batch>'))}`);
    }
  }
  console.log(`\nTổng: ${total} document. Mỗi lần chạy thật ghi tối đa ${opts.limit}.`);
}

async function importAll(opts) {
  if (opts.resetState && fs.existsSync(STATE_PATH)) fs.unlinkSync(STATE_PATH);
  const state = readState() ?? { batch_id: newBatchId(), progress: {} };
  const { db, Timestamp } = connect();

  let budget = opts.limit;
  console.log(`\nĐợt nạp: ${state.batch_id} — tối đa ${budget} write lần này.\n`);

  for (const table of selectedTables(opts)) {
    if (budget <= 0) break;
    const rows = loadTable(table);
    const start = state.progress[table.name] ?? 0;
    if (start >= rows.length) {
      console.log(`${COLLECTION_PREFIX + table.name}: đã đủ ${rows.length}/${rows.length}, bỏ qua.`);
      continue;
    }

    const end = Math.min(rows.length, start + budget);
    const collection = db.collection(COLLECTION_PREFIX + table.name);
    const writer = db.bulkWriter();
    let failed = 0;
    writer.onWriteError((err) => {
      if (err.failedAttempts < 5) return true; // BulkWriter tu retry, toi da 5 lan
      failed += 1;
      console.error(`\n  Ghi lỗi ${err.documentRef.id}: ${err.message}`);
      return false;
    });

    for (let i = start; i < end; i += 1) {
      const id = String(table.id(rows[i]));
      if (!id || id.includes('/')) fail(`${table.name} dòng ${i + 2}: doc id không hợp lệ ("${id}").`);
      writer.set(collection.doc(id), toDoc(rows[i], Timestamp, state.batch_id));
      if ((i - start + 1) % 2000 === 0) {
        process.stdout.write(`\r${COLLECTION_PREFIX + table.name}: ${i + 1}/${rows.length}`);
      }
    }
    await writer.close();
    if (failed > 0) {
      fail(`${failed} document ghi lỗi ở ${table.name}. Tiến độ chưa lưu cho bảng này — chạy lại để thử tiếp.`);
    }

    state.progress[table.name] = end;
    writeState(state); // luu sau MOI bang: Ctrl+C giua chung khong mat het
    budget -= end - start;
    console.log(`\r${COLLECTION_PREFIX + table.name}: ${end}/${rows.length}${end === rows.length ? ' ✓' : ''}`);
  }

  const remaining = selectedTables(opts).reduce(
    (sum, t) => sum + Math.max(0, loadTable(t).length - (state.progress[t.name] ?? 0)),
    0,
  );
  console.log(
    remaining === 0
      ? '\nXong — đã nạp đủ.'
      : `\nCòn ${remaining} document. Chạy lại cùng lệnh (quota Spark reset mỗi ngày) để nạp tiếp.`,
  );
  console.log('Xoá lại bằng:  node scripts/import-powerbi.js --clear');
}

async function clearAll(opts) {
  const { db } = connect();
  for (const table of selectedTables(opts)) {
    const name = COLLECTION_PREFIX + table.name;
    let deleted = 0;
    for (;;) {
      // orderBy('import_batch') chi tra ve document CO field do.
      const snap = await db.collection(name).orderBy('import_batch').limit(CLEAR_PAGE).get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      deleted += snap.size;
      process.stdout.write(`\r${name}: đã xoá ${deleted}`);
    }
    console.log(`\r${name}: đã xoá ${deleted}`);
  }
  const state = readState();
  if (state) {
    if (opts.only) {
      for (const t of opts.only) delete state.progress[t];
      writeState(state);
    } else fs.unlinkSync(STATE_PATH);
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.dryRun) return dryRun(opts);
  if (opts.clear) return clearAll(opts);
  return importAll(opts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
