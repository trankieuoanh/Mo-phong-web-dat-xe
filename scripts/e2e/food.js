const { launch, text, clickText, sleep } = require('./lib');
const B = 'http://localhost:3000';
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };
const waitUrl = async (page, frag, t = 20000) => { const t0 = Date.now(); while (!page.url().includes(frag)) { if (Date.now() - t0 > t) return false; await sleep(250); } return true; };
const api = (p) => fetch(B + p).then((r) => r.json());
const dialogText = (page) => page.evaluate(() => document.querySelector('[role=dialog]')?.innerText.replace(/\s+/g, ' ') || '');

(async () => {
  const phoneLocal = '0913' + String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
  const phoneE164 = '+84' + phoneLocal.slice(1);
  const { browser, page } = await launch();
  let session;
  try {
    await page.goto(B + '/', { waitUntil: 'networkidle2' }); await sleep(1500);
    check('Khách vào / không bị đẩy sang /login', !page.url().includes('/login'));
    await clickText(page, 'Đặt đồ ăn', { exact: true }); check('→ /food (menu)', await waitUrl(page, '/food'));
    await sleep(4000);
    await clickText(page, 'Thêm Bánh mì thịt nướng vào giỏ'); await sleep(800);
    await clickText(page, 'Thêm Cà phê sữa đá vào giỏ'); await sleep(1000);
    session = await page.evaluate(() => sessionStorage.getItem('gsm_session_id'));
    const cart = await page.evaluate(() => sessionStorage.getItem('gsm_cart'));
    check('Giỏ hàng có 2 món (sessionStorage)', JSON.parse(cart || '[]').length === 2, cart);
    await clickText(page, 'Giỏ hàng'); check('→ /food/cart', await waitUrl(page, '/food/cart')); await sleep(2000);
    await clickText(page, 'Tiếp tục'); check('→ /food/offer', await waitUrl(page, '/food/offer')); await sleep(2000);
    await clickText(page, 'Bỏ qua'); check('→ /food/confirm', await waitUrl(page, '/food/confirm')); await sleep(2000);

    await clickText(page, 'Đặt đơn', { exact: true }); await sleep(1200);
    check('Bấm "Đặt đơn" khi chưa đăng nhập → hộp thoại, vẫn ở /food/confirm', !!(await dialogText(page)) && page.url().includes('/food/confirm'));
    await page.type('input[type=tel]', phoneLocal); await clickText(page, 'Gửi mã'); await sleep(2500);
    const code = /mã của bạn:\s*(\d{6})/.exec(await dialogText(page))?.[1];
    check('Form hiện mã demo', !!code, code);
    await page.type('input[autocomplete=one-time-code]', code); await clickText(page, 'Xác nhận', { exact: true });
    check('Đăng nhập đúng → tự đặt đơn → /food/success', await waitUrl(page, '/food/success', 25000));
    check('Đăng nhập KHÔNG đổi session_id', session === (await page.evaluate(() => sessionStorage.getItem('gsm_session_id'))));
    await sleep(2500);

    const events = await api(`/api/events?session_id=${session}`);
    const placed = events.find((e) => e.event_name === 'place_order');
    const adds = events.filter((e) => e.event_name === 'add_to_cart');
    check('add_to_cart x2, step_index = 3', adds.length === 2 && adds.every((e) => e.step_index === 3), `${adds.length}`);
    check('place_order mang SĐT', placed?.user_id === phoneE164, placed?.user_id);
    check('place_order đủ field & step_index = 6', placed && placed.step_index === 6 && placed.properties.final_total > 0 && placed.properties.item_count === 2, JSON.stringify(placed?.properties).slice(0, 140));
    check('Event trước đăng nhập mang id ẩn danh', events.filter((e) => e.event_name === 'add_to_cart').every((e) => /^anon-/.test(e.user_id)));
    check('final_total = cart_total + shipping − discount', placed && placed.properties.final_total === placed.properties.cart_total + placed.properties.shipping_fee - placed.properties.discount_amount);

    await page.goto(B + '/history', { waitUntil: 'networkidle2' }); await sleep(2500);
    await clickText(page, 'Đặt đồ ăn', { exact: true }); await sleep(1500);
    const hist = await text(page);
    check('/history tab Đặt đồ ăn hiện đơn vừa đặt', /Tổng số đơn \| 1/.test(hist), hist.slice(120, 260));
    console.log(JSON.stringify({ session, phone: phoneE164 }));
  } catch (e) { check('Kịch bản không gãy', false, e.message.slice(0, 300)); }
  await browser.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} PASS`);
  process.exit(results.every(Boolean) ? 0 : 1);
})();
