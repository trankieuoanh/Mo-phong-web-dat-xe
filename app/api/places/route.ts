/**
 * GET /api/places — tim dia chi that (Photon). Hop dong o api-endpoints.md muc 3b.
 *
 * KHONG cham Firestore, KHONG ghi event nao: go phim khong phai mot buoc funnel.
 *
 * VI SAO PHAI NAM O SERVER chu khong goi thang Photon tu trinh duyet: dieu khoan
 * OSM bat buoc moi request mang `User-Agent` dinh danh ung dung kem cach lien he,
 * ma trinh duyet KHONG cho JavaScript dat header do.
 */
import type { NextRequest } from 'next/server';
import { searchPlaces } from '@/lib/server/services/photon.service';
import { validatePlaceQuery } from '@/lib/server/validators/place.validator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const result = validatePlaceQuery(request.nextUrl.searchParams);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  try {
    return Response.json(await searchPlaces(result.value));
  } catch (error) {
    // 502 chu khong phai 500: loi nam o dich vu ben ngoai, khong phai o app nay.
    // FE se hien canh bao nhung VAN liet ke 5 dia chi goi y — ha tang loi khong
    // duoc ket nguoi dung (api-endpoints.md muc 3b).
    const detail = error instanceof Error ? error.message : 'unknown';
    console.error('[GET /api/places] Photon that bai:', error);
    return Response.json(
      { error: `Không tìm được địa chỉ lúc này (${detail})` },
      { status: 502 },
    );
  }
}
