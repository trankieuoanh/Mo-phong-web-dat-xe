/**
 * GET /api/route — tim tuyen duong that (OSRM). Hop dong o api-endpoints.md muc 3c.
 *
 * Thu muc ten `route` chua file ten `route.ts` — trong la lung nhung dung quy
 * uoc App Router: ten THU MUC la duong dan URL, ten FILE luon la `route.ts`.
 *
 * KHONG cham Firestore, KHONG ghi event nao.
 */
import type { NextRequest } from 'next/server';
import { findRoute } from '@/lib/server/services/route.service';
import { validateRouteQuery } from '@/lib/server/validators/route.validator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const result = validateRouteQuery(request.nextUrl.searchParams);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  try {
    return Response.json(await findRoute(result.value));
  } catch (error) {
    // 502 chu khong phai 500: loi nam o dich vu ben ngoai, khong phai o app nay.
    // FE bat 502 roi goi straightRoute() va ghi route_source: 'straight' —
    // luong dat xe khong bao gio bi chan vi OSRM (api-endpoints.md muc 3c).
    const detail = error instanceof Error ? error.message : 'unknown';
    console.error('[GET /api/route] OSRM that bai:', error);
    return Response.json(
      { error: `Không tính được tuyến đường lúc này (${detail})` },
      { status: 502 },
    );
  }
}
