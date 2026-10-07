// Tien ich do SVG ban do cho cac kich ban route*.js
exports.readMap = (page) => page.evaluate(() => {
  const num = (s) => s.split(',').map(Number);
  const line = document.querySelector('[data-testid=route-line]');
  const pts = line ? line.getAttribute('points').trim().split(/\s+/).map(num) : [];
  const tr = (id) => { const el = document.querySelector(`[data-testid=${id}]`); const m = el && /translate\(([-\d.]+) ([-\d.]+)\)/.exec(el.getAttribute('transform')); return m ? [Number(m[1]), Number(m[2])] : null; };
  const head = document.querySelector('[data-testid=vehicle-heading]');
  const hm = head && /rotate\(([-\d.]+)\)/.exec(head.getAttribute('transform'));
  return { pts, origin: tr('origin'), destination: tr('destination'), vehicle: tr('vehicle'), heading: hm ? Number(hm[1]) : null, text: document.body.innerText.replace(/\s+/g, ' ') };
});
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
exports.dist = dist;
/** Khoang cach tu diem p toi doan ab. */
function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return dist(p, [a[0] + dx * t, a[1] + dy * t]);
}
exports.distToPolyline = (p, pts) => Math.min(...pts.slice(1).map((q, i) => segDist(p, pts[i], q)));
exports.pathLength = (pts) => pts.slice(1).reduce((n, q, i) => n + dist(pts[i], q), 0);
exports.maxDeviation = (pts, a, b) => Math.max(...pts.map((p) => segDist(p, a, b)));
exports.readDraft = (page) => page.evaluate(() => { try { return JSON.parse(sessionStorage.getItem('gsm_ride_draft_v2')); } catch { return null; } });
