const fs = require('fs');
const { launch, clickText, sleep } = require('./lib');
const { readMap, readDraft, dist, distToPolyline, pathLength, maxDeviation } = require('./mapkit');
const B = 'http://localhost:3000';
const LOG = process.env.DEVLOG;
const routeCalls = () => (LOG ? (fs.readFileSync(LOG, 'utf8').match(/GET \/api\/route\?/g) || []).length : 0);
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };
const waitFor = async (fn, t = 20000, step = 200) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > t) return null; await sleep(step); } };
const waitUrl = (page, frag, t) => waitFor(() => page.url().includes(frag), t);

(async () => {
  const { browser, page } = await launch();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  const phone = '0912' + String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
  try {
    // ── A. Preview tai /ride/pickup ──
    await page.goto(B + '/', { waitUntil: 'networkidle2' }); await sleep(1200);
    await clickText(page, 'Đặt xe', { exact: true }); await waitUrl(page, '/ride/address');
    await sleep(1500); await clickText(page, 'Nhà'); await waitUrl(page, '/ride/pickup');
    const calls0 = routeCalls();
    const m1 = await waitFor(async () => { const m = await readMap(page); return m.pts.length > 2 ? m : null; }, 25000);
    check('Co duong tuyen sau khi tinh xong (route-line)', !!m1);
    const d1 = await readDraft(page);
    check('Draft luu tuyen OSRM that (source=osrm, >=10 diem)', d1?.route?.source === 'osrm' && d1.route.geometry.length >= 10, `${d1?.route?.geometry?.length} diem`);
    check('Polyline co dung so diem cua geometry (khong phai 2 diem)', m1 && m1.pts.length === d1.route.geometry.length, `${m1?.pts.length}`);
    const straight = dist(m1.origin, m1.destination), along = pathLength(m1.pts);
    check('Tuyen BAM DUONG: dai hon duong thang ≥ 5% va lech ≥ 8px', along / straight > 1.05 && maxDeviation(m1.pts, m1.origin, m1.destination) > 8, `duong ${along.toFixed(0)}px / thang ${straight.toFixed(0)}px / lech max ${maxDeviation(m1.pts, m1.origin, m1.destination).toFixed(0)}px`);
    check('Chip hien quang duong + thoi gian that', /\d+ phút • [\d.]+ km/.test(m1.text) && !m1.text.includes('đường chim bay'));
    check('Nut "Chon diem don nay" bat khi co tuyen', await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes('Chọn điểm đón này')); return !!b && !b.disabled; }));
    await page.screenshot({ path: process.env.SHOTS + '/pickup.png', fullPage: false });
    const geomA = JSON.stringify(d1.route.geometry);

    // ── B. Doi diem den ──
    const oldPts = JSON.stringify(m1.pts);
    await clickText(page, 'Đổi điểm đến'); await waitUrl(page, '/ride/address'); await sleep(1500);
    await clickText(page, 'Công ty'); await waitUrl(page, '/ride/pickup');
    const justAfter = await readMap(page);
    check('Ngay sau khi doi diem den: KHONG con ve tuyen cu', justAfter.pts.length === 0 || JSON.stringify(justAfter.pts) !== oldPts, `${justAfter.pts.length} diem ngay luc do`);
    const m2 = await waitFor(async () => { const m = await readMap(page); return m.pts.length > 2 ? m : null; }, 25000);
    const d2 = await readDraft(page);
    check('Diem den moi → tuyen MOI (khac tuyen cu)', !!m2 && JSON.stringify(d2.route.geometry) !== geomA, `${d2?.route?.geometry?.length} diem`);
    check('Tuyen moi cung bam duong', m2 && pathLength(m2.pts) / dist(m2.origin, m2.destination) > 1.02);
    const geomB = JSON.stringify(d2.route.geometry);

    // ── C. Vehicle → Promo → Confirm: cung hinh hoc ──
    await clickText(page, 'Chọn điểm đón này'); await waitUrl(page, '/ride/vehicle'); await sleep(2000);
    const dv = await readDraft(page);
    const mv = await readMap(page);
    check('Man chon xe: ve cung tuyen (route-line co mat)', mv.pts.length === dv.route.geometry.length && JSON.stringify(dv.route.geometry) === geomB);
    await clickText(page, 'Green Bike Xe máy'); await sleep(1200);
    if (!page.url().includes('/ride/promo')) await clickText(page, 'Tiếp tục');
    await waitUrl(page, '/ride/promo'); await sleep(1500); await clickText(page, 'Bỏ qua'); await waitUrl(page, '/ride/confirm'); await sleep(2000);
    const dc = await readDraft(page); const mc = await readMap(page);
    check('Man xac nhan: CUNG hinh hoc voi preview', JSON.stringify(dc.route.geometry) === geomB && mc.pts.length === dc.route.geometry.length);
    check('Tu pickup toi confirm KHONG goi them /api/route (dung chung tuyen)', routeCalls() - calls0 <= 2, `+${routeCalls() - calls0} request (gom ca lan doi diem den)`);
    const callsBeforeBook = routeCalls();

    // ── D. Dat → dang nhap → success: xe chay theo tuyen ──
    await clickText(page, 'Đặt xe', { exact: true }); await sleep(1200);
    await page.type('input[type=tel]', phone); await clickText(page, 'Gửi mã'); await sleep(2500);
    const code = /mã của bạn:\s*(\d{6})/.exec(await page.evaluate(() => document.querySelector('[role=dialog]').innerText.replace(/\s+/g, ' ')))[1];
    await page.type('input[autocomplete=one-time-code]', code); await clickText(page, 'Xác nhận', { exact: true });
    check('Toi man thanh cong', await waitUrl(page, '/ride/success', 40000));
    await sleep(1500);
    const base = await readMap(page);
    check('Success: co ban do voi tuyen + xe', base.pts.length === dc.route.geometry.length && !!base.vehicle, `${base.pts.length} diem`);
    const samples = [];
    const t0 = Date.now();
    for (;;) {
      const m = await readMap(page);
      if (m.vehicle) samples.push({ t: Date.now() - t0, v: m.vehicle, h: m.heading, arrived: m.text.includes('Đã đến nơi') });
      if (m.text.includes('Đã đến nơi') || Date.now() - t0 > 60000) break;
      await sleep(300);
    }
    await page.screenshot({ path: process.env.SHOTS + '/success.png', fullPage: false });
    const onRoute = samples.every((s) => distToPolyline(s.v, base.pts) <= 3);
    check('Moi mau vi tri xe NAM TREN polyline (≤ 3px)', onRoute, `${samples.length} mau, lech max ${Math.max(...samples.map((s) => distToPolyline(s.v, base.pts))).toFixed(2)}px`);
    const jumps = samples.slice(1).map((s, i) => dist(s.v, samples[i].v));
    const routePx = pathLength(base.pts);
    check('Xe KHONG nhay (buoc lon nhat < 12% do dai tuyen)', Math.max(...jumps) < routePx * 0.12, `buoc max ${Math.max(...jumps).toFixed(0)}px / tuyen ${routePx.toFixed(0)}px`);
    // Ghim nam o DIEM NGUOI DUNG CHON; tuyen OSRM bat/ket thuc o diem DUONG GAN NHAT (snap) nen lech vai px — xe phai khop DAU/CUOI TUYEN.
    check('Xe bat dau o dau tuyen, ket thuc o cuoi tuyen', dist(samples[0].v, base.pts[0]) < routePx * 0.1 && dist(samples.at(-1).v, base.pts.at(-1)) <= 2, `cuoi cach cuoi tuyen ${dist(samples.at(-1).v, base.pts.at(-1)).toFixed(1)}px`);
    const ds = []; let acc = 0; for (const s of samples) { ds.push(acc = Math.max(acc, 0)); }
    check('Hien "Da den noi" khi xe toi', samples.at(-1).arrived);
    const headings = new Set(samples.map((s) => Math.round(s.h)));
    check('Mui ten huong xoay theo tuyen (nhieu huong khac nhau)', headings.size > 2, `${headings.size} huong`);
    check('Khong goi them /api/route sau khi dat (khong tinh lai tuyen)', routeCalls() === callsBeforeBook, `${routeCalls() - callsBeforeBook} request moi`);
    check('Khong co pageerror', errors.length === 0, errors[0] || '');
    console.log(JSON.stringify({ phone: '+84' + phone.slice(1) }));
  } catch (e) { check('Kich ban khong gay', false, e.message.slice(0, 300)); }
  await browser.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} PASS`);
  process.exit(results.every(Boolean) ? 0 : 1);
})();
