const fs = require('fs');
const { launch, clickText, sleep } = require('./lib');
const { readMap, dist, distToPolyline, pathLength } = require('./mapkit');
const B = 'http://localhost:3000';
const LOG = process.env.DEVLOG;
const routeCalls = () => (LOG ? (fs.readFileSync(LOG, 'utf8').match(/GET \/api\/route\?/g) || []).length : 0);
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };
const waitFor = async (fn, t = 20000, step = 200) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > t) return null; await sleep(step); } };
const place = (id, label, lat, lon) => ({ id, label, address: label + ', Hà Nội', source: 'search', lat, lon });
const seed = (page, withRestaurant) => page.evaluate((withRestaurant, origin, restaurant) => {
  sessionStorage.setItem('gsm_cart', JSON.stringify([{ itemId: 'banh-mi-01', quantity: 1 }]));
  sessionStorage.setItem('gsm_offer', JSON.stringify(null));
  sessionStorage.setItem('gsm_food_draft', JSON.stringify(withRestaurant ? { origin, restaurantId: restaurant.id, restaurantName: restaurant.label, restaurantPlace: restaurant } : { origin }));
}, withRestaurant, place('osm-origin', 'Địa chỉ giao', 21.0278, 105.8008), place('osm-R1', 'Quán Phở Thìn', 21.0367, 105.7821));

(async () => {
  const phone = '0913' + String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
  const { browser, page } = await launch();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  try {
    // 1. Khong chon quan → hanh vi cu
    await page.goto(B + '/', { waitUntil: 'networkidle2' }); await sleep(1000);
    await seed(page, false); await page.goto(B + '/food/confirm', { waitUntil: 'networkidle2' });
    await waitFor(async () => (await readMap(page)).origin, 20000); await sleep(2500);
    const m0 = await readMap(page);
    check('Khong chon quan: chi ghim dia chi giao, KHONG co tuyen (hanh vi cu)', m0.pts.length === 0 && !!m0.origin && !m0.destination);

    // 2. Co quan → tuyen quan → khach
    await seed(page, true); await page.goto(B + '/food/confirm', { waitUntil: 'networkidle2' });
    const m1 = await waitFor(async () => { const m = await readMap(page); return m.pts.length > 2 ? m : null; }, 25000);
    check('Co quan: ve tuyen QUAN → KHACH bam duong', !!m1 && m1.pts.length > 10 && pathLength(m1.pts) / dist(m1.origin, m1.destination) > 1.02, `${m1?.pts.length} diem`);
    check('Co ghim quan (xuat phat) + ghim giao (dich)', !!m1?.origin && !!m1?.destination);
    check('Hien quang duong + thoi gian that', /\d+ phút • [\d.]+ km/.test(m1?.text || ''));
    const enabled = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'Đặt đơn'); return !!b && !b.disabled; });
    check('Nut "Dat don" KHONG bi chan boi tuyen (gia khong phu thuoc quang duong)', enabled);
    await page.screenshot({ path: process.env.SHOTS + '/food-confirm.png' });
    const callsBefore = routeCalls();

    // 3. Dat don (dang nhap) → success co xe giao hang
    await clickText(page, 'Đặt đơn', { exact: true }); await sleep(1200);
    await page.type('input[type=tel]', phone); await clickText(page, 'Gửi mã'); await sleep(2500);
    const code = /mã của bạn:\s*(\d{6})/.exec(await page.evaluate(() => document.querySelector('[role=dialog]').innerText.replace(/\s+/g, ' ')))[1];
    await page.type('input[autocomplete=one-time-code]', code); await clickText(page, 'Xác nhận', { exact: true });
    check('Toi /food/success', !!(await waitFor(() => page.url().includes('/food/success'), 30000)));
    const base = await waitFor(async () => { const m = await readMap(page); return m.pts.length > 2 && m.vehicle ? m : null; }, 15000);
    check('Success: co ban do, tuyen va xe giao hang', !!base, `${base?.pts.length} diem`);
    check('Success dung CHUNG tuyen (khong goi them /api/route)', routeCalls() === callsBefore, `+${routeCalls() - callsBefore}`);
    const samples = []; const t0 = Date.now(); let done = false;
    for (;;) {
      const m = await readMap(page);
      if (m.vehicle) samples.push(m.vehicle);
      if (m.text.includes('Đơn hàng đã đến nơi')) { done = true; break; }
      if (Date.now() - t0 > 60000) break;
      await sleep(300);
    }
    await page.screenshot({ path: process.env.SHOTS + '/food-success.png' });
    check('Xe giao hang luon nam tren tuyen', samples.every((v) => distToPolyline(v, base.pts) <= 3), `${samples.length} mau`);
    const jumps = samples.slice(1).map((s, i) => dist(s, samples[i]));
    check('Xe khong nhay', Math.max(...jumps) < pathLength(base.pts) * 0.12);
    check('Toi noi: "Don hang da den noi" va xe o cuoi tuyen', done && dist(samples.at(-1), base.pts.at(-1)) <= 2);
    check('Khong co pageerror', errors.length === 0, errors[0] || '');
    console.log(JSON.stringify({ phone: '+84' + phone.slice(1) }));
  } catch (e) { check('Kich ban khong gay', false, e.message.slice(0, 300)); }
  await browser.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} PASS`);
  process.exit(results.every(Boolean) ? 0 : 1);
})();
