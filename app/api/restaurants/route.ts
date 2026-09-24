/**
 * GET /api/restaurants — quan an quanh mot toa do, cho dai "Gan ban" o man menu.
 *
 * Dung Overpass chu khong phai Nominatim: Nominatim la geocoder nen
 * `amenity=restaurant` tra ve rat thua (6-hoac-0 quan giua Ha Noi), con Overpass
 * truy van thang co so du lieu OSM theo ban kinh — cung toa do do ra ~80 quan.
 *
 * KHONG cham Firestore, KHONG ghi event nao.
 */
import type { NextRequest } from 'next/server';
import { searchRestaurants } from '@/lib/server/services/overpass.service';
import { validateRestaurantQuery } from '@/lib/server/validators/place.validator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 30 giay, KHONG phai 10 giay mac dinh cua Vercel.
 *
 * `overpass.service.ts` dat timeout rieng cua no la 30s vi Overpass la ha tang
 * cong dong va co luc tra loi rat cham. Khong khai bao lai o day thi ham bi cat
 * o giay thu 10 va dai "Gan ban" HONG TREN BAN DEPLOY trong khi chay local van
 * tot — dung loai loi chi lo ra sau khi deploy.
 *
 * Hai con so nay phai di cung nhau: doi mot cai thi doi ca hai.
 */
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const result = validateRestaurantQuery(request.nextUrl.searchParams);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  try {
    return Response.json(await searchRestaurants(result.value));
  } catch (error) {
    // 502 giong /places: loi nam o dich vu ben ngoai. FE hien loi kem nut thu
    // lai chu KHONG chan man menu — ba cach tim mon con lai van dung duoc.
    const detail = error instanceof Error ? error.message : 'unknown';
    console.error('[GET /api/restaurants] Overpass that bai:', error);
    return Response.json(
      { error: `Không tìm được nhà hàng lúc này (${detail})` },
      { status: 502 },
    );
  }
}
