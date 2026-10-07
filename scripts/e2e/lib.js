const puppeteer = require('puppeteer-core');
const fs = require('fs');
exports.launch = async () => {
  const dir = process.env.HOME + '/ffprof-pptr';
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  // Khong co GPS trong headless: tat geolocation de app lui ve DEFAULT_PICKUP ngay thay vi doi mai.
  fs.writeFileSync(dir + '/user.js', 'user_pref("geo.enabled", false);\nuser_pref("permissions.default.geo", 2);\n' + (process.env.W ? `user_pref("layout.css.devPixelsPerPx", "${800 / Number(process.env.W)}");\n` : ''));
  const browser = await puppeteer.launch({ browser: 'firefox', executablePath: '/snap/bin/firefox', headless: true,
    args: ['--no-remote', '--profile', process.env.HOME + '/ffprof-pptr', '--width=1440', '--height=900'], protocol: 'webDriverBiDi',
    env: { ...process.env, ...(process.env.W ? { MOZ_HEADLESS_WIDTH: process.env.W, MOZ_HEADLESS_HEIGHT: process.env.H || '900' } : {}) } });
  const page = await browser.newPage();
  // Firefox/BiDi khong ho tro page.setViewport (emulation.setScreenOrientationOverride): goi thang browsingContext.
  if (process.env.W) await page.mainFrame().browsingContext.setViewport({ viewport: { width: Number(process.env.W), height: Number(process.env.H || 900) } });
  return { browser, page };
};
exports.text = (page) => page.evaluate(() => document.body.innerText.replace(/\n+/g, ' | ').slice(0, 400));
exports.buttons = (page) => page.evaluate(() => [...document.querySelectorAll('button,a[href]')].map((e) => (e.innerText || e.getAttribute('aria-label') || '').trim().replace(/\n/g, ' ')).filter(Boolean).slice(0, 40));
exports.clickText = async (page, text, { exact = false, timeout = 15000 } = {}) => {
  const t0 = Date.now();
  for (;;) {
    const ok = await page.evaluate((text, exact) => {
      const els = [...document.querySelectorAll('button,a,[role=button],li,div[role=option],label')];
      const el = els.reverse().find((e) => { const ts = [(e.innerText || '').trim(), e.getAttribute('aria-label') || ''].map((x) => x.replace(/\s+/g, ' ')); return ts.some((t) => (exact ? t === text : t.includes(text))); });
      if (!el || el.disabled) return false;
      el.scrollIntoView({ block: 'center' }); el.click(); return true;
    }, text, exact);
    if (ok) return;
    if (Date.now() - t0 > timeout) throw new Error(`Khong thay nut "${text}". Dang o ${page.url()} :: ${await exports.text(page)}`);
    await new Promise((r) => setTimeout(r, 300));
  }
};
exports.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
