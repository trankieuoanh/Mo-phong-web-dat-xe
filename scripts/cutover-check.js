#!/usr/bin/env node
/**
 * cutover-check.js — kiem tra TRUOC khi chuyen production sang D1 (PHASE 10). Chi doc.
 *
 *   node scripts/cutover-check.js
 *
 * Kiem: cau hinh Cloudflare o may nay · D1 truy cap duoc · migration da ap · moi bang co du lieu
 * (so voi CSV / Firestore khi co the) · va IN RA danh sach bien moi truong can dat tren Vercel.
 * Thoat 0 = san sang; 1 = con thieu.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const d1 = require('./lib/d1-rest.js');
const mock = require('./lib/mock-subset.js');

const ROOT = path.resolve(__dirname, '..');
const cfg = d1.config();
const q = async (sql) => (await d1.batch(cfg, [{ sql }]))[0].results;
let bad = 0;
const ok = (name, good, extra = '') => {
  if (!good) bad += 1;
  console.log(`${good ? '✅' : '❌'} ${name}${extra ? '  — ' + extra : ''}`);
};

/** CSV khong co dau nhay (da kiem) nen tach theo dau phay la du. */
function readCsv(table) {
  const lines = fs.readFileSync(path.join(ROOT, 'powerBI', `${table}.csv`), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  const header = lines[0].split(',');
  return { header, rows: lines.slice(1).map((l) => l.split(',')) };
}

/** So dong KY VONG theo chinh sach tap con mock (scripts/lib/mock-subset.js) — cung quy tac voi migrate. */
const CSV_ROWS = {};
const tables = ['dim_region', 'dim_hex', 'dim_promo', 'dim_promo_cap_history', 'dim_date', 'dim_merchant', 'dim_user', 'fact_promo_budget', 'fact_ride', 'fact_food', 'fact_promo_burn'];
{
  const data = Object.fromEntries(tables.map((t) => [t, readCsv(t)]));
  const sessions = () => {
    const ids = new Set();
    for (const [t, limit] of [['fact_ride', Infinity], ['fact_food', mock.LIMITS.fact_food]]) {
      const at = data[t].header.indexOf('session_id');
      data[t].rows.slice(0, limit).forEach((r) => ids.add(r[at]));
    }
    return ids;
  };
  for (const t of tables) CSV_ROWS[t] = mock.subset(t, data[t].rows, data[t].header, sessions).length;
}

async function main() {
  const tables = (await q("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'")).map((r) => r.name);
  ok('D1 truy cập được qua REST bằng token ở .env.local', true);
  const migs = (await q('SELECT name FROM d1_migrations ORDER BY id')).map((r) => r.name);
  ok('Migration đã áp trên D1 thật', migs.includes('0001_initial_schema.sql') && migs.includes('0002_analytics_schema.sql'), migs.join(', '));
  ok('Đủ 13 bảng (events, users + 11 bảng phân tích)', ['events', 'users', ...Object.keys(CSV_ROWS)].every((t) => tables.includes(t)));

  const idx = (await q("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_events_%'")).map((r) => r.name);
  ok('3 index của events', idx.length === 3, idx.join(', '));

  const ev = Number((await q('SELECT COUNT(*) AS n FROM events'))[0].n);
  const us = Number((await q('SELECT COUNT(*) AS n FROM users'))[0].n);
  ok('events có dữ liệu', ev > 0, `${ev} dòng`);
  ok('users có dữ liệu', us > 0, `${us} dòng`);

  let pending = [];
  for (const [t, n] of Object.entries(CSV_ROWS)) {
    const got = Number((await q(`SELECT COUNT(*) AS n FROM ${t}`))[0].n);
    if (got !== n) pending.push(`${t} ${got}/${n}`);
  }
  ok('11 bảng phân tích đúng số dòng kỳ vọng (tập con mock: fact_food, fact_promo_burn nạp một phần)', pending.length === 0, pending.length ? `CHƯA đúng: ${pending.join(', ')} → chạy node scripts/migrate-firebase-to-d1.js` : `fact_food ${CSV_ROWS.fact_food}, fact_promo_burn ${CSV_ROWS.fact_promo_burn}`);

  const latest = (await q('SELECT MAX(created_at) AS t FROM events WHERE seed_batch IS NULL'))[0].t;
  console.log(`\nEvent thật mới nhất trong D1: ${latest}  ← mốc để chạy delta: node scripts/migrate-firebase-to-d1.js --since <mốc trừ ~1 giờ>`);

  console.log(`
Biến môi trường cần đặt trên VERCEL (Project → Settings → Environment Variables → Production), rồi REDEPLOY:
  CLOUDFLARE_ACCOUNT_ID        ${process.env.CLOUDFLARE_ACCOUNT_ID ? '(đã có ở máy này)' : '(THIẾU ở máy này)'}
  CLOUDFLARE_D1_DATABASE_ID    ${process.env.CLOUDFLARE_D1_DATABASE_ID ? '(đã có ở máy này)' : '(lấy từ wrangler.jsonc)'}
  CLOUDFLARE_API_TOKEN         nên tạo token RIÊNG cho Vercel: chỉ quyền "D1 Edit" trên account này
  AUTH_SECRET                  >= 32 ký tự (đã có từ trước nếu đang chạy production)
  SMS_PROVIDER=mock
  SMS_MOCK_EXPOSE_CODE=true    bắt buộc với mock trên production (xem setup.md)
  ANALYTICS_TOKEN              TUỲ CHỌN — khoá GET /api/events và /api/analytics/*
KHÔNG đặt tiền tố NEXT_PUBLIC_. FIREBASE_* / BIGQUERY_* app không còn dùng (xoá ở PHASE 11, chưa xoá bây giờ).
Gợi ý: đặt Function Region của Vercel gần D1 (D1 đang phục vụ từ APAC → Singapore "sin1") để giảm độ trễ.`);
  console.log(`\n${bad === 0 ? 'SẴN SÀNG chuyển production.' : `${bad} mục chưa đạt — chưa nên chuyển.`}`);
  process.exit(bad === 0 ? 0 : 1);
}
main().catch((e) => {
  console.error(`Lỗi: ${e.message}`);
  process.exit(1);
});
