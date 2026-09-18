/**
 * GET /api/places    — tim dia chi that (Photon).
 * GET /api/reverse   — toa do -> dia chi that (Photon).
 * GET /api/restaurants — quan an that quanh mot toa do (Overpass).
 *
 * KHONG cham Firestore, KHONG ghi event nao: go phim va bat GPS khong phai mot
 * buoc funnel.
 *
 * Ba route nam chung mot file vi cung phuc vu "chon mot dia diem", nhung gio
 * dung HAI upstream khac nhau — Photon cho dia chi, Overpass cho POI. Ly do
 * tach o dau moi file service.
 */
import { Router } from 'express';
import { reversePlace, searchPlaces } from '../services/photon.service.js';
import { searchRestaurants } from '../services/overpass.service.js';
import {
  validatePlaceQuery,
  validateRestaurantQuery,
  validateReverseQuery,
} from '../validators/place.validator.js';

export const placesRouter: Router = Router();

placesRouter.get('/places', async (req, res) => {
  const params = new URLSearchParams(req.url.split('?')[1] ?? '');
  const result = validatePlaceQuery(params);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }

  try {
    const places = await searchPlaces(result.value);
    res.json(places);
  } catch (error) {
    // 502 chu khong phai 500: loi nam o dich vu ben ngoai, khong phai o app nay.
    // FE se hien canh bao nhung VAN liet ke 5 dia chi goi y — ha tang loi khong
    // duoc ket nguoi dung (api-endpoints.md muc 3b).
    const detail = error instanceof Error ? error.message : 'unknown';
    console.error('[GET /api/places] Photon that bai:', error);
    res.status(502).json({ error: `Không tìm được địa chỉ lúc này (${detail})` });
  }
});

/**
 * GET /api/reverse — bien toa do GPS thanh mot dia chi doc duoc.
 *
 * Khong co endpoint nay thi man xac nhan don chi noi duoc "Quanh vi tri cua
 * ban", tuc nguoi dung bam Dat don ma khong biet giao di dau.
 *
 * Tra 200 kem `null` khi Photon khong biet cho do la dau — KHONG phai loi, va
 * FE giu nhan mac dinh roi di tiep.
 */
placesRouter.get('/reverse', async (req, res) => {
  const params = new URLSearchParams(req.url.split('?')[1] ?? '');
  const result = validateReverseQuery(params);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }

  try {
    const place = await reversePlace(result.value);
    res.json(place);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown';
    console.error('[GET /api/reverse] Photon that bai:', error);
    res.status(502).json({ error: `Không tra được địa chỉ lúc này (${detail})` });
  }
});

/**
 * GET /api/restaurants — quan an quanh mot toa do, cho dai "Gan ban" o man menu.
 *
 * Dung Overpass chu khong phai Nominatim: Nominatim la geocoder nen
 * `amenity=restaurant` tra ve rat thua (6-hoac-0 quan giua Ha Noi), con Overpass
 * truy van thang co so du lieu OSM theo ban kinh — cung toa do do ra ~80 quan.
 */
placesRouter.get('/restaurants', async (req, res) => {
  const params = new URLSearchParams(req.url.split('?')[1] ?? '');
  const result = validateRestaurantQuery(params);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }

  try {
    const restaurants = await searchRestaurants(result.value);
    res.json(restaurants);
  } catch (error) {
    // 502 giong /places: loi nam o dich vu ben ngoai. FE hien loi kem nut thu
    // lai chu KHONG chan man menu — ba cach tim mon con lai van dung duoc.
    const detail = error instanceof Error ? error.message : 'unknown';
    console.error('[GET /api/restaurants] Overpass that bai:', error);
    res.status(502).json({ error: `Không tìm được nhà hàng lúc này (${detail})` });
  }
});
