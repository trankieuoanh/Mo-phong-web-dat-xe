const { launch, text, clickText, sleep } = require('./lib');
const B = 'http://localhost:3000';
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };
const waitUrl = async (page, frag, t = 20000) => { const t0 = Date.now(); while (!page.url().includes(frag)) { if (Date.now() - t0 > t) return false; await sleep(250); } return true; };
const api = (p, init) => fetch(B + p, init).then((r) => r.json());

(async () => {
  const phoneLocal = '0912' + String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
  const phoneE164 = '+84' + phoneLocal.slice(1);
  const { browser, page } = await launch();
  const apiLog = [];
  page.on('response', (r) => { if (r.url().includes('/api/events') && r.request().method() === 'POST') apiLog.push(r.status()); });
  try {
    await page.goto(B + '/', { waitUntil: 'networkidle2' }); await sleep(1500);
    check('Khách vào / không bị đẩy sang /login', !page.url().includes('/login'));
    await clickText(page, 'Đặt xe', { exact: true }); check('→ /ride/address', await waitUrl(page, '/ride/address'));
    await clickText(page, 'Nhà'); check('→ /ride/pickup', await waitUrl(page, '/ride/pickup'));
    await clickText(page, 'Chọn điểm đón này'); check('→ /ride/vehicle', await waitUrl(page, '/ride/vehicle'));
    await clickText(page, 'Green Bike Xe máy'); await sleep(1500);
    if (!page.url().includes('/ride/promo')) await clickText(page, 'Tiếp tục');
    check('→ /ride/promo', await waitUrl(page, '/ride/promo'));
    await sleep(1500); await clickText(page, 'Bỏ qua'); check('→ /ride/confirm', await waitUrl(page, '/ride/confirm'));
    await sleep(1500);
    const sessionBefore = await page.evaluate(() => sessionStorage.getItem('gsm_session_id'));
    const anonId = await page.evaluate(() => localStorage.getItem('gsm_anon_id'));
    check('Có session_id và user_id ẩn danh', !!sessionBefore && /^anon-/.test(anonId || ''), anonId);

    // Bấm "Đặt xe" khi chưa đăng nhập → hộp thoại, KHÔNG chuyển trang
    await clickText(page, 'Đặt xe', { exact: true }); await sleep(1200);
    const dialog = await page.evaluate(() => !!document.querySelector('[role=dialog]'));
    check('Hộp thoại đăng nhập hiện ra, vẫn ở /ride/confirm', dialog && page.url().includes('/ride/confirm'));

    // Đóng bằng Esc rồi mở lại
    await page.keyboard.press('Escape'); await sleep(600);
    check('Esc đóng hộp thoại', !(await page.evaluate(() => !!document.querySelector('[role=dialog]'))));
    await clickText(page, 'Đặt xe', { exact: true }); await sleep(1000);

    await page.type('input[type=tel]', phoneLocal); await clickText(page, 'Gửi mã'); await sleep(2500);
    const body = await page.evaluate(() => (document.querySelector('[role=dialog]') || document.body).innerText.replace(/\s+/g, ' ')); const code = /mã của bạn:\s*(\d{6})/.exec(body)?.[1];
    check('Form hiện mã demo 6 số (D1 không cản đăng nhập)', !!code, code);
    await page.type('input[autocomplete=one-time-code]', code === '000000' ? '111111' : '000000'); // sai có chủ ý
    await clickText(page, 'Xác nhận', { exact: true }); await sleep(2000);
    check('Mã sai báo lỗi, vẫn ở hộp thoại', (await page.evaluate(() => document.querySelector('[role=dialog]')?.innerText || '')).includes('không đúng'));
    await page.evaluate(() => { const i = document.querySelector('input[autocomplete=one-time-code]'); i.focus(); i.select(); }); for (let k = 0; k < 6; k++) await page.keyboard.press('Backspace');
    await page.type('input[autocomplete=one-time-code]', code);
    await clickText(page, 'Xác nhận', { exact: true });
    check('Đăng nhập đúng → /ride/finding-driver', await waitUrl(page, '/ride/finding-driver', 25000));
    await sleep(800);
    const sess = await page.evaluate(() => sessionStorage.getItem('gsm_session_id'));
    await clickText(page, 'Hủy đơn'); await sleep(2500);
    check('Bấm "Hủy đơn" → về trang chủ "/" (không bị FlowGuard đẩy sang /ride/address)', page.url().replace(B, '') === '/', page.url().replace(B, ''));
    const ev = await api(`/api/events?session_id=${sess}`);
    const cancel = ev.find((e) => e.event_name === 'cancel_ride');
    check('cancel_ride đã ghi, mirror giá của confirm_ride', cancel && cancel.properties.final_price > 0 && cancel.properties.cancel_stage === 'finding_driver', JSON.stringify(cancel?.properties.final_price));
    check('Không có driver_assigned sau khi huỷ', !ev.some((e) => e.event_name === 'driver_assigned' && e.created_at > (cancel?.created_at ?? '')));
    console.log(JSON.stringify({ session: sess, phone: phoneE164 }));
  } catch (e) { check('Kịch bản không gãy', false, e.message.slice(0, 300)); }
  await browser.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} PASS`);
  process.exit(results.every(Boolean) ? 0 : 1);
})();
