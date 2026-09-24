/**
 * GET /api/tiles — nha cung cap tile nao con dung duoc. Hop dong o
 * api-endpoints.md muc 3d.
 *
 * KHONG cham Firestore, KHONG ghi event nao.
 *
 * Khong co validator vi endpoint nay khong nhan tham so nao — nhung no VAN doc
 * mot thu tu request: origin. Xem duoi.
 */
import type { NextRequest } from 'next/server';
import { findUsableTileProviders } from '@/lib/server/services/tiles.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * ORIGIN LAY TU CHINH REQUEST, khong phai tu bien moi truong.
 *
 * Stadia phan quyen theo `Referer`, nen phep do chi ra ket luan dung neu no hoi
 * upstream bang dung cai origin ma TRINH DUYET se gui. Ban tach hai process
 * truoc day phai khai bao tay qua `WEB_ORIGIN`, va dat sai bien do chinh la thu
 * da sinh ra loi "ban do 401 tren ban deploy": phep do hoi Stadia bang referer
 * localhost, ket luan Stadia con song, trong khi trinh duyet that an 401.
 *
 * DOC HEADER chu khong dung `new URL(request.url).origin`: sau mot proxy
 * (Vercel), `request.url` co the mang dia chi noi bo cua server chu khong phai
 * dia chi nguoi dung go vao. `x-forwarded-host` la thu Vercel dat va la thu
 * dung. `host` la duong lui cho luc chay local, noi khong co proxy nao.
 */
function originOf(request: NextRequest): string {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (!host) return request.nextUrl.origin;

  // Chay local thi khong co `x-forwarded-proto`, va localhost la http.
  const proto =
    request.headers.get('x-forwarded-proto') ??
    (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host) ? 'http' : 'https');

  return `${proto}://${host}`;
}

export async function GET(request: NextRequest) {
  const origin = originOf(request);

  try {
    const providers = await findUsableTileProviders(origin);
    return Response.json({ providers });
  } catch (error) {
    // KHONG tra mang rong o day. FE coi mot loi la "khong biet gi" va lui ve
    // dung ca bang TILE_PROVIDERS, nen mot mang rong va mot loi 502 dan toi hai
    // ket cuc KHAC HAN nhau: mang rong nghia la "da do, khong nha nao dung
    // duoc" va se lam ban do trang han. Phep do that bai thi bao khong biet,
    // dung bao la tat ca deu chet.
    console.error('[GET /api/tiles] Do that bai:', error);
    return Response.json(
      { error: 'Không dò được nhà cung cấp tile lúc này' },
      { status: 502 },
    );
  }
}
