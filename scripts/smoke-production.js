#!/usr/bin/env node
/**
 * smoke-production.js — kiem tra nhanh BAN DEPLOY (hoac dev server) sau khi chuyen sang D1 (PHASE 10).
 *
 *   node scripts/smoke-production.js https://<app>.vercel.app
 *   node scripts/smoke-production.js http://localhost:3000 --login            them: dang nhap SDT that
 *   node scripts/smoke-production.js https://<app>.vercel.app --token <ANALYTICS_TOKEN>
 *
 * Kiem tra: health · POST event an danh · doc lai · event ket thuc funnel bi chan khi chua dang nhap ·
 * user_id gia bi chan · 11 bang analytics · va — quan trong nhat — event vua gui nam TRONG D1
 * (doc thang qua REST), chung to ban deploy ghi vao D1 chu khong con ghi Firestore.
 *
 * GHI du lieu thu (session `zsmoke-*`, SDT 0919…) va XOA het o cuoi. Can CLOUDFLARE_* trong .env.local
 * de doc/xoa o D1. Thoat 0 = tat ca dat.
 */
'use strict';

const d1 = require('./lib/d1-rest.js');

const args = process.argv.slice(2);
const base = (args.find((a) => /^https?:\/\//.test(a)) ?? '').replace(/\/$/, '');
const withLogin = args.includes('--login');
const tokenIdx = args.indexOf('--token');
const token = tokenIdx >= 0 ? args[tokenIdx + 1] : null;
if (!base) {
  console.error('Dùng: node scripts/smoke-production.js <url> [--login] [--token <ANALYTICS_TOKEN>]');
  process.exit(1);
}

const cfg = d1.config();
const sql = async (text, params = []) => (await d1.batch(cfg, [{ sql: text, params }]))[0];
const headers = (extra = {}) => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra });
const call = async (path, init = {}) => {
  const res = await fetch(base + path, { ...init, headers: headers(init.headers) });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body, res };
};

let pass = 0;
let fail = 0;
const check = (name, ok, extra = '') => {
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`);
};

const stamp = Date.now();
const session = `zsmoke-${stamp}`;
const anon = `anon-smoke${stamp}`;
const phone = `0919${String(stamp).slice(-6)}`;
const e164 = `+84${phone.slice(1)}`;
const event = (over = {}) => JSON.stringify({ user_id: anon, session_id: session, flow: 'ride', event_name: 'screen_view', screen_name: 'home', previous_screen: null, step_index: 0, properties: { smoke: { ok: true } }, ...over });

async function cleanup() {
  await d1.batch(cfg, [
    { sql: "DELETE FROM events WHERE session_id LIKE 'zsmoke-%'" },
    { sql: 'DELETE FROM users WHERE phone = ?', params: [e164] },
  ]);
}

async function main() {
  console.log(`Smoke test: ${base}${token ? ' (có Bearer token)' : ''}\n`);

  const health = await call('/api/health');
  check('GET /api/health → 200 {status: ok}', health.status === 200 && health.body?.status === 'ok');

  const posted = await call('/api/events', { method: 'POST', body: event() });
  check('POST /api/events (khách ẩn danh) → 201 + event_id', posted.status === 201 && typeof posted.body?.event_id === 'string', `${posted.status} ${JSON.stringify(posted.body).slice(0, 80)}`);

  const inD1 = posted.body?.event_id ? (await sql('SELECT id, user_id, json_extract(properties, "$.smoke.ok") AS ok, created_at FROM events WHERE id = ?', [posted.body.event_id])).results : [];
  check('Event nằm TRONG D1 (đọc thẳng qua REST) ⇒ bản deploy ghi D1, không còn ghi Firestore', inD1.length === 1 && inD1[0].user_id === anon && inD1[0].ok === 1, inD1[0]?.created_at);

  const read = await call(`/api/events?session_id=${session}`);
  check('GET /api/events?session_id= đọc lại đúng event', read.status === 200 && Array.isArray(read.body) && read.body.length === 1 && read.body[0].properties?.smoke?.ok === true, `${read.status}`);

  const forged = await call('/api/events', { method: 'POST', body: event({ user_id: 'hacker' }) });
  check('POST với user_id giả, không cookie → 401', forged.status === 401);
  const confirm = await call('/api/events', { method: 'POST', body: event({ event_name: 'confirm_ride', screen_name: 'ride_confirm', step_index: 5 }) });
  check('confirm_ride khi chưa đăng nhập → 401', confirm.status === 401);
  const bad = await call('/api/events', { method: 'POST', body: event({ flow: 'zzz' }) });
  check('Body sai (flow lạ) → 400', bad.status === 400);

  const analytics = await call('/api/analytics/dim_region');
  check('GET /api/analytics/dim_region → 200 {rows:[…]}', analytics.status === 200 && Array.isArray(analytics.body?.rows) && analytics.body.rows.length === 1, `${analytics.status}`);
  const paged = await call('/api/analytics/dim_user?limit=2');
  check('Phân trang: limit=2 → 2 dòng + next_cursor', paged.status === 200 && paged.body?.rows?.length === 2 && typeof paged.body?.next_cursor === 'string');
  check('Bảng lạ → 404', (await call('/api/analytics/nope')).status === 404);

  if (withLogin) {
    const sent = await call('/api/auth/send-code', { method: 'POST', body: JSON.stringify({ phone }) });
    const code = sent.body?.dev_code;
    check('send-code trả dev_code (cần SMS_MOCK_EXPOSE_CODE=true trên production)', sent.status === 200 && /^\d{6}$/.test(code ?? ''), sent.status === 200 ? '' : JSON.stringify(sent.body));
    if (code) {
      const cookieHeader = (sent.res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
      const verified = await call('/api/auth/verify', { method: 'POST', body: JSON.stringify({ phone, code }), headers: { Cookie: cookieHeader } });
      check('verify đúng mã → 200 + cookie gsm_auth', verified.status === 200 && (verified.res.headers.getSetCookie?.() ?? []).some((c) => c.startsWith('gsm_auth=')), `${verified.status}`);
      const auth = (verified.res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
      const ok = await call('/api/events', { method: 'POST', body: event({ event_name: 'confirm_ride', screen_name: 'ride_confirm', step_index: 5, user_id: 'ignored', properties: {} }), headers: { Cookie: auth } });
      check('confirm_ride KHI ĐÃ đăng nhập → 201, user_id bị ghi đè bằng SĐT', ok.status === 201, `${ok.status}`);
      const row = ok.body?.event_id ? (await sql('SELECT user_id FROM events WHERE id = ?', [ok.body.event_id])).results[0] : null;
      check('D1: event của người đăng nhập mang SĐT, không phải user_id gửi lên', row?.user_id === e164, row?.user_id);
      const user = (await sql('SELECT phone, created_at, last_login_at FROM users WHERE phone = ?', [e164])).results[0];
      check('D1: bảng users có dòng của SĐT vừa đăng nhập', user?.phone === e164);
    }
  }
}

main()
  .catch((e) => {
    fail += 1;
    console.log(`FAIL  Smoke test gãy: ${e.message}`);
  })
  .finally(async () => {
    await cleanup().catch((e) => console.log(`CẢNH BÁO: dọn dẹp lỗi: ${e.message}`));
    const left = (await sql("SELECT (SELECT COUNT(*) FROM events WHERE session_id LIKE 'zsmoke-%') AS n").catch(() => ({ results: [{ n: '?' }] }))).results[0].n;
    console.log(`\nDọn dẹp: còn ${left} event zsmoke.  ${pass}/${pass + fail} PASS`);
    process.exit(fail === 0 ? 0 : 1);
  });
