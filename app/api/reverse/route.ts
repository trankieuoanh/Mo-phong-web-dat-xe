/**
 * GET /api/reverse — bien toa do GPS thanh mot dia chi doc duoc (Photon).
 *
 * Khong co endpoint nay thi man xac nhan don chi noi duoc "Quanh vi tri cua
 * ban", tuc nguoi dung bam Dat don ma khong biet giao di dau.
 *
 * TRA 200 KEM `null` khi Photon khong biet cho do la dau — KHONG phai loi, va
 * FE giu nhan mac dinh roi di tiep. Dung doi thanh 404.
 *
 * KHONG cham Firestore, KHONG ghi event nao.
 */
import type { NextRequest } from 'next/server';
import { reversePlace } from '@/lib/server/services/photon.service';
import { validateReverseQuery } from '@/lib/server/validators/place.validator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const result = validateReverseQuery(request.nextUrl.searchParams);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  try {
    return Response.json(await reversePlace(result.value));
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown';
    console.error('[GET /api/reverse] Photon that bai:', error);
    return Response.json(
      { error: `Không tra được địa chỉ lúc này (${detail})` },
      { status: 502 },
    );
  }
}
