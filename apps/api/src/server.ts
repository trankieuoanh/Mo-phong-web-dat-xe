/**
 * BE cua du an — process rieng, cong 4000.
 *
 * Trinh duyet KHONG goi thang vao day: apps/web proxy `/api/*` sang cong nay
 * qua `rewrites` trong next.config.ts, nen phia trinh duyet moi request la
 * same-origin — khong co preflight OPTIONS. Ly do xem apps/web/next.config.ts.
 *
 * cors() o duoi phuc vu viec goi THANG cong 4000 khi debug bang curl/Postman.
 */
import cors from 'cors';
import express from 'express';
import { eventsRouter } from './routes/events.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { placesRouter } from './routes/places.routes.js';
import { routeRouter } from './routes/route.routes.js';
import { tilesRouter } from './routes/tiles.routes.js';

// Render/Railway tu dat PORT cho tien trinh; local thi roi ve 4000.
const PORT = Number(process.env.PORT ?? 4000);

/**
 * `WEB_ORIGIN` nhan DANH SACH phan tach bang dau phay, vi tu luc co ban deploy
 * thi co hai origin hop le cung luc: domain that va `http://localhost:3000` khi
 * ngoi debug. Mot chuoi don van chay binh thuong — "a,b" chi la truong hop nhieu
 * hon mot phan tu.
 *
 * Chu y: gia tri nay con duoc `services/tiles.service.ts` dung lam `Referer` khi
 * do tile, va o do no lay PHAN TU DAU. Nen tren ban deploy hay de domain that
 * dung truoc localhost, neu khong phep do se hoi Stadia bang referer localhost
 * va ket luan Stadia con song trong khi trinh duyet that van an 401.
 */
const WEB_ORIGINS = (process.env.WEB_ORIGIN ?? 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();

app.use(cors({ origin: WEB_ORIGINS }));
app.use(express.json({ limit: '64kb' }));

app.use('/api', healthRouter);
app.use('/api', eventsRouter);
// Tra cuu dia chi va tuyen duong — khong cham Firestore, tra loi duoc ca khi
// chua co credential Firebase.
app.use('/api', placesRouter);
app.use('/api', routeRouter);
// Do xem nha cung cap tile nao con song. Cung nhom voi hai router tren: khong
// cham Firestore nen tra loi duoc ca khi chua co credential Firebase.
app.use('/api', tilesRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const server = app.listen(PORT, () => {
  console.log(`[api] http://localhost:${PORT}  (health: /api/health)`);
});

// Thieu handler nay thi loi khi mo cong bi nuot: tien trinh treo im lang,
// khong in gi ra ca stdout lan stderr. `apps/web` bao loi ro rang trong cung
// tinh huong, nen nguoi dung se tuong BE van song va di tim nham cho.
server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `[api] Cong ${PORT} dang bi chiem — nhieu kha nang lan chay truoc chua tat han.\n` +
        `      Cach tim va ket thuc tien trinh: xem setup.md muc "Gap loi?".`,
    );
  } else {
    console.error('[api] Khong khoi dong duoc server:', error);
  }
  process.exit(1);
});
