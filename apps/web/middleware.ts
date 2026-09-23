/**
 * Bom khoa `x-gsm-key` vao moi request `/api/*` — o TANG SERVER.
 *
 * VI SAO PHAI LA MIDDLEWARE CHU KHONG PHAI `lib/track.ts`. Khoa nay ton tai de
 * chan nguoi la POST document rac vao collection `events` sau khi app duoc deploy
 * cong khai (`api-endpoints.md` da canh bao truoc ve dieu do). Neu dat header
 * trong `track.ts` thi gia tri khoa nam trong bundle JS tai ve may nguoi dung —
 * mo DevTools la thay, va khoa thanh vo nghia.
 *
 * Dat o day thi khoa khong bao gio roi khoi may chu: trinh duyet goi `/api/events`
 * same-origin nhu cu, Vercel them header, roi moi chuyen tiep sang apps/api.
 *
 * KHONG DUNG TIEN TO `NEXT_PUBLIC_` (CLAUDE.md quy tac 2) — dung tien to do la
 * nhung thang gia tri vao bundle, tuc pha huy dung cai ly do file nay ton tai.
 *
 * CHAY LOCAL KHONG DOI GI: khong dat `EVENTS_WRITE_KEY` thi middleware tha
 * request di tiep, va `rewrites` trong next.config.ts xu ly nhu tu truoc toi nay.
 */
import { NextResponse, type NextRequest } from 'next/server';

const EVENTS_WRITE_KEY = process.env.EVENTS_WRITE_KEY;
const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:4000';

export const config = { matcher: '/api/:path*' };

export function middleware(request: NextRequest) {
  if (!EVENTS_WRITE_KEY) return NextResponse.next();

  const headers = new Headers(request.headers);
  headers.set('x-gsm-key', EVENTS_WRITE_KEY);

  /**
   * Tu rewrite thang sang apps/api thay vi `NextResponse.next()` roi de
   * `rewrites` cua next.config.ts lam not.
   *
   * Ly do: header sua trong middleware chi chac chan di theo request khi chinh
   * middleware quyet dinh dich den. Tha ra cho mot rewrite khac o chang sau la
   * dat cuoc vao thu tu xu ly noi bo cua Next — ma cai gia khi doan sai la
   * `confirm_ride` va `place_order` am tham an 401, dung kieu mat event cuoi
   * funnel ma next.config.ts da phai viet han mot doan dai de tranh.
   */
  const { pathname, search } = request.nextUrl;
  return NextResponse.rewrite(new URL(`${pathname}${search}`, API_ORIGIN), {
    request: { headers },
  });
}
