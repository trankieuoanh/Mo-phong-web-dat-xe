#!/usr/bin/env node
/**
 * test-d1.js — kiem thu DATABASE D1 (PHASE 8): CRUD, loc, sap xep, phan trang, rang buoc, khoa ngoai,
 * trung lap, batch nguyen tu, plan truy van co dung index. Chay tay: `node scripts/test-d1.js`.
 *
 * AN TOAN: moi dong thu co id/phone/ma bat dau bang `ZTEST` va bi XOA het o cuoi (ke ca khi test
 * that bai). Khong dong vao du lieu that. Ton khoang 60 luot ghi trong han muc ngay cua D1.
 */
'use strict';

const d1 = require('./lib/d1-rest.js');

const cfg = d1.config();
const run = async (sql, params = []) => (await d1.batch(cfg, [{ sql, params }]))[0];
const rows = async (sql, params = []) => (await run(sql, params)).results;
const expectError = async (fn) => {
  try {
    await fn();
    return null;
  } catch (e) {
    return String(e.message);
  }
};

let pass = 0;
let fail = 0;
function check(name, ok, extra = '') {
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`);
}

const EVT = (id, over = {}) => [
  id, over.session ?? 'ZTEST-s1', over.user ?? 'ZTEST-u1', over.flow ?? 'ride', over.name ?? 'screen_view',
  over.screen ?? 'home', over.prev ?? null, over.step ?? 0, over.props ?? '{"a":{"b":1}}', 'web',
  'at' in over ? over.at : '2030-01-01T00:00:00.000000Z', over.seed ?? null,
];
const INSERT =
  'INSERT INTO events (id, session_id, user_id, flow, event_name, screen_name, previous_screen, step_index, properties, platform, created_at, seed_batch) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)';

async function cleanup() {
  await d1.batch(cfg, [
    { sql: "DELETE FROM events WHERE id LIKE 'ZTEST%'" },
    { sql: "DELETE FROM users WHERE phone LIKE 'ZTEST%'" },
    { sql: "DELETE FROM dim_hex WHERE hex_id LIKE 'ZTEST%'" },
    { sql: "DELETE FROM dim_region WHERE region_id LIKE 'ZTEST%'" },
  ]);
}

async function main() {
  await cleanup();
  const before = Number((await rows('SELECT COUNT(*) AS n FROM events WHERE id NOT LIKE ?', ['ZTEST%']))[0].n);

  // ── CREATE / READ / UPDATE / DELETE ──
  const created = await run(INSERT, EVT('ZTEST-1'));
  check('CREATE event: 4 lượt ghi (1 dòng + 3 index)', created.meta.rows_written === 4, `rows_written=${created.meta.rows_written}`);
  const read = (await rows('SELECT * FROM events WHERE id = ?', ['ZTEST-1']))[0];
  check('READ: đủ cột, kiểu đúng', read && read.step_index === 0 && read.flow === 'ride' && read.previous_screen === null && read.seed_batch === null && read.platform === 'web');
  check('READ: json_extract đọc được khoá lồng nhau', (await rows("SELECT json_extract(properties,'$.a.b') AS b FROM events WHERE id = ?", ['ZTEST-1']))[0].b === 1);
  const upd = await run("UPDATE events SET properties = '{\"a\":2}', step_index = 3 WHERE id = ?", ['ZTEST-1']);
  const after = (await rows('SELECT properties, step_index FROM events WHERE id = ?', ['ZTEST-1']))[0];
  check('UPDATE', upd.meta.changes === 1 && after.step_index === 3 && JSON.parse(after.properties).a === 2);
  const del = await run('DELETE FROM events WHERE id = ?', ['ZTEST-1']);
  check('DELETE', del.meta.changes === 1 && (await rows('SELECT 1 FROM events WHERE id = ?', ['ZTEST-1'])).length === 0);

  // ── Lọc / sắp xếp / limit ──
  await d1.batch(cfg, [
    { sql: INSERT, params: EVT('ZTEST-a', { step: 2, at: '2030-01-01T00:00:03.000000Z', name: 'select_vehicle', screen: 'vehicle_selection' }) },
    { sql: INSERT, params: EVT('ZTEST-b', { step: 0, at: '2030-01-01T00:00:01.000000Z' }) },
    { sql: INSERT, params: EVT('ZTEST-c', { step: 1, at: '2030-01-01T00:00:02.000000Z', flow: 'food', user: 'ZTEST-u2', session: 'ZTEST-s2' }) },
    { sql: INSERT, params: EVT('ZTEST-d', { step: 1, at: '2030-01-01T00:00:02.000000Z', seed: 'ZTEST-seed' }) },
  ]);
  const bySession = await rows("SELECT id FROM events WHERE session_id = 'ZTEST-s1' ORDER BY step_index, created_at, id");
  check('Lọc session + sắp theo step_index', bySession.map((r) => r.id).join() === 'ZTEST-b,ZTEST-d,ZTEST-a', bySession.map((r) => r.id).join());
  const byFlow = await rows("SELECT id FROM events WHERE id LIKE 'ZTEST%' AND flow = 'food'");
  check('Lọc flow', byFlow.length === 1 && byFlow[0].id === 'ZTEST-c');
  const byUser = await rows("SELECT id FROM events WHERE user_id = 'ZTEST-u2'");
  check('Lọc user_id', byUser.length === 1);
  const range = await rows("SELECT id FROM events WHERE id LIKE 'ZTEST%' AND created_at >= ? AND created_at <= ? ORDER BY created_at, id", ['2030-01-01T00:00:02.000000Z', '2030-01-01T00:00:03.000000Z']);
  check('Lọc khoảng from/to (đầu cuối đều bao gồm)', range.map((r) => r.id).join() === 'ZTEST-c,ZTEST-d,ZTEST-a', range.map((r) => r.id).join());
  const tie = await rows("SELECT id FROM events WHERE id LIKE 'ZTEST%' ORDER BY created_at, id");
  check('Cùng created_at → tie-break theo id (ổn định)', tie.map((r) => r.id).join() === 'ZTEST-b,ZTEST-c,ZTEST-d,ZTEST-a');
  check('LIMIT', (await rows("SELECT id FROM events WHERE id LIKE 'ZTEST%' ORDER BY created_at, id LIMIT ?", [2])).length === 2);
  const seeds = await rows("SELECT id FROM events WHERE seed_batch IS NOT NULL AND id LIKE 'ZTEST%'");
  check('seed_batch IS NOT NULL chỉ trả event seed', seeds.length === 1 && seeds[0].id === 'ZTEST-d');

  // ── Phân trang keyset trên TOÀN BỘ events ──
  const total = Number((await rows('SELECT COUNT(*) AS n FROM events'))[0].n);
  let seen = 0;
  let last = null;
  let pages = 0;
  for (;;) {
    const page = last
      ? await rows('SELECT created_at, id FROM events WHERE (created_at, id) > (?, ?) ORDER BY created_at, id LIMIT 1000', [last.created_at, last.id])
      : await rows('SELECT created_at, id FROM events ORDER BY created_at, id LIMIT 1000');
    pages += 1;
    seen += page.length;
    if (page.length < 1000) break;
    last = page[page.length - 1];
  }
  check(`Phân trang keyset đi hết ${total} dòng, không sót/lặp`, seen === total, `${seen}/${total} trong ${pages} trang`);

  // ── Ràng buộc & trùng lặp ──
  check('PK trùng bị từ chối', (await expectError(() => run(INSERT, EVT('ZTEST-b')))) !== null);
  const upsert = await run(`${INSERT} ON CONFLICT(id) DO UPDATE SET step_index = excluded.step_index`, EVT('ZTEST-b', { step: 9 }));
  check('ON CONFLICT DO UPDATE ghi đè, không nhân đôi', upsert.meta.changes === 1 && (await rows("SELECT COUNT(*) AS n FROM events WHERE id='ZTEST-b'"))[0].n === 1 && (await rows("SELECT step_index FROM events WHERE id='ZTEST-b'"))[0].step_index === 9);
  check("CHECK flow: 'bad' bị từ chối", /CHECK/i.test((await expectError(() => run(INSERT, EVT('ZTEST-x1', { flow: 'bad' })))) ?? ''));
  check('CHECK json_valid: properties không phải JSON bị từ chối', /CHECK/i.test((await expectError(() => run(INSERT, EVT('ZTEST-x2', { props: '{oops' })))) ?? ''));
  check('CHECK step_index >= 0', /CHECK/i.test((await expectError(() => run(INSERT, EVT('ZTEST-x3', { step: -1 })))) ?? ''));
  check('NOT NULL created_at', /NOT NULL/i.test((await expectError(() => run(INSERT, EVT('ZTEST-x4', { at: null })))) ?? ''));
  check('Không dòng rác sau các lần thất bại', (await rows("SELECT COUNT(*) AS n FROM events WHERE id LIKE 'ZTEST-x%'"))[0].n === 0);

  // ── Batch nguyên tử ──
  const batchErr = await expectError(() => d1.batch(cfg, [{ sql: INSERT, params: EVT('ZTEST-y1') }, { sql: INSERT, params: EVT('ZTEST-y1') }]));
  check('Batch lỗi giữa chừng → rollback toàn bộ', batchErr !== null && (await rows("SELECT COUNT(*) AS n FROM events WHERE id='ZTEST-y1'"))[0].n === 0);

  // ── users: upsert giữ created_at ──
  const up = (phone, t) => run('INSERT INTO users (phone, created_at, last_login_at) VALUES (?,?,?) ON CONFLICT(phone) DO UPDATE SET last_login_at = excluded.last_login_at', [phone, t, t]);
  await up('ZTEST-p', '2030-01-01T00:00:00.000000Z');
  await up('ZTEST-p', '2030-01-02T00:00:00.000000Z');
  const u = (await rows("SELECT * FROM users WHERE phone='ZTEST-p'"))[0];
  check('users upsert: created_at giữ nguyên, last_login_at cập nhật', u.created_at.startsWith('2030-01-01') && u.last_login_at.startsWith('2030-01-02'));

  // ── Khóa ngoại ──
  const fkBad = await expectError(() => run("INSERT INTO dim_hex (hex_id, region_id, nearest_district, center_lat, center_lng, hex_tier, h3_resolution) VALUES ('ZTEST-h','ZTEST-NOPE','x',1.0,2.0,'Inner',6)"));
  check('FK: dim_hex trỏ region không tồn tại bị từ chối', /FOREIGN KEY/i.test(fkBad ?? ''), (fkBad ?? '').slice(-70));
  await run("INSERT INTO dim_region (region_id, region_name, tier) VALUES ('ZTEST-R','x','T')");
  await run("INSERT INTO dim_hex (hex_id, region_id, nearest_district, center_lat, center_lng, hex_tier, h3_resolution) VALUES ('ZTEST-h','ZTEST-R','x',1.0,2.0,'Inner',6)");
  const fkDel = await expectError(() => run("DELETE FROM dim_region WHERE region_id='ZTEST-R'"));
  check('FK: xóa region đang được tham chiếu bị từ chối', /FOREIGN KEY/i.test(fkDel ?? ''));
  await run("DELETE FROM dim_hex WHERE hex_id='ZTEST-h'");
  check('FK: xóa đúng thứ tự (con trước, cha sau) thành công', (await run("DELETE FROM dim_region WHERE region_id='ZTEST-R'")).meta.changes === 1);

  // ── Plan truy vấn có dùng index ──
  const plan = async (sql, params) => (await rows(`EXPLAIN QUERY PLAN ${sql}`, params)).map((r) => r.detail).join(' | ');
  const p1 = await plan("SELECT * FROM events WHERE session_id = 'x' ORDER BY step_index, created_at, id", []);
  const p2 = await plan("SELECT * FROM events WHERE user_id = 'x' ORDER BY created_at, id LIMIT 5", []);
  const p3 = await plan("SELECT * FROM events WHERE created_at >= '2030' ORDER BY created_at, id", []);
  check('Lọc session dùng idx_events_session_step', /idx_events_session_step/.test(p1), p1);
  check('Lọc user dùng idx_events_user_created_at', /idx_events_user_created_at/.test(p2), p2);
  check('Lọc theo thời gian dùng idx_events_created_at', /idx_events_created_at/.test(p3), p3);

  // ── Dữ liệu thật không bị ảnh hưởng ──
  const afterCount = Number((await rows('SELECT COUNT(*) AS n FROM events WHERE id NOT LIKE ?', ['ZTEST%']))[0].n);
  check('Số event thật không đổi sau bài test', afterCount === before, `${before} → ${afterCount}`);
}

main()
  .catch((e) => {
    fail += 1;
    console.log(`FAIL  Bài test gãy: ${e.message}`);
  })
  .finally(async () => {
    await cleanup().catch((e) => console.log(`CẢNH BÁO: dọn dẹp lỗi: ${e.message}`));
    const left = await rows("SELECT (SELECT COUNT(*) FROM events WHERE id LIKE 'ZTEST%') + (SELECT COUNT(*) FROM users WHERE phone LIKE 'ZTEST%') + (SELECT COUNT(*) FROM dim_hex WHERE hex_id LIKE 'ZTEST%') + (SELECT COUNT(*) FROM dim_region WHERE region_id LIKE 'ZTEST%') AS n").catch(() => [{ n: '?' }]);
    console.log(`\nDọn dẹp: còn ${left[0].n} dòng ZTEST.  ${pass}/${pass + fail} PASS`);
    process.exit(fail === 0 ? 0 : 1);
  });
