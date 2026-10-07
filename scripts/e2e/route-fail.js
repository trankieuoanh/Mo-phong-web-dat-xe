const { launch, clickText, sleep } = require('./lib');
const { readMap, readDraft } = require('./mapkit');
const B = 'http://localhost:3000';
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };
const waitFor = async (fn, t = 20000, step = 200) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > t) return null; await sleep(step); } };
const btnState = (page) => page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes('Chọn điểm đón này') || x.innerText.includes('Đang tính tuyến')); return b ? { disabled: b.disabled, text: b.innerText.trim() } : null; });
(async () => {
  const { browser, page } = await launch();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  try {
    await page.goto(B + '/', { waitUntil: 'networkidle2' }); await sleep(1200);
    await clickText(page, 'Đặt xe', { exact: true }); await sleep(2000); await clickText(page, 'Nhà');
    await waitFor(() => page.url().includes('/ride/pickup'));
    const sawLoading = await waitFor(async () => (await readMap(page)).text.includes('Đang tính tuyến đường'), 8000, 50);
    const loadingBtn = await btnState(page);
    check('Dang tinh: hien "Dang tinh tuyen duong…" va nut bi khoa', !!sawLoading || loadingBtn?.disabled === true, JSON.stringify(loadingBtn));
    const err = await waitFor(async () => (await readMap(page)).text.includes('Không tính được tuyến đường'), 30000);
    check('OSRM loi → the loi "Khong tinh duoc tuyen duong" (khong lo loi ky thuat)', !!err);
    const m = await readMap(page);
    check('KHONG ve bat ky duong nao khi chua co tuyen that (khong duong thang gia)', m.pts.length === 0);
    check('Ghim diem don + diem den van hien', !!m.origin && !!m.destination);
    check('Khong lo loi tho (OSRM/HTTP/502) ra giao dien', !/OSRM|HTTP|502|fetch|upstream/i.test(m.text));
    const b = await btnState(page);
    check('Nut "Chon diem don nay" BI KHOA khi chua co tuyen', b?.disabled === true, JSON.stringify(b));
    check('Draft KHONG chua tuyen', (await readDraft(page))?.route === undefined);
    // Thu lai den khi thanh cong (fake OSRM loi 3 request dau)
    let attempts = 0, ok = false;
    for (let i = 0; i < 6 && !ok; i += 1) {
      const hasRetry = await page.evaluate(() => !![...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'Thử lại'));
      if (!hasRetry) { ok = (await readMap(page)).pts.length > 2; if (ok) break; await sleep(1000); continue; }
      await clickText(page, 'Thử lại'); attempts += 1;
      ok = !!(await waitFor(async () => (await readMap(page)).pts.length > 2, 6000));
      if (!ok) await waitFor(async () => (await readMap(page)).text.includes('Không tính được tuyến đường'), 8000);
    }
    check('Bam "Thu lai" → tinh lai va CO tuyen that', ok, `${attempts} lan bam`);
    const after = await readMap(page);
    check('Co tuyen that → ve duong >2 diem, nut mo khoa', after.pts.length > 10 && (await btnState(page))?.disabled === false, `${after.pts.length} diem`);
    check('Khong con the loi sau khi thanh cong', !after.text.includes('Không tính được tuyến đường'));
    await clickText(page, 'Chọn điểm đón này'); check('Tiep tuc duoc sang /ride/vehicle', !!(await waitFor(() => page.url().includes('/ride/vehicle'), 15000)));
    check('Khong co pageerror', errors.length === 0, errors[0] || '');
  } catch (e) { check('Kich ban khong gay', false, e.message.slice(0, 300)); }
  await browser.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} PASS`);
  process.exit(results.every(Boolean) ? 0 : 1);
})();
