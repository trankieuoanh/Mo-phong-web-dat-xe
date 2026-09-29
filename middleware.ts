/**
 * Bat buoc dang nhap: trang nao cung chuyen ve /login neu KHONG CO cookie.
 *
 * Chi kiem tra su co mat cua cookie, KHONG kiem chu ky: middleware chay o Edge
 * runtime va khong duoc import `lib/server` (CLAUDE.md quy tac 1). Chu ky that
 * duoc kiem o GET /api/auth/me (AppProvider goi khi mount) va o POST /api/events
 * — cookie gia chi qua duoc cua nay, khong ghi duoc event nao.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE } from '@/lib/shared/phone';

export function middleware(request: NextRequest) {
  if (request.cookies.has(AUTH_COOKIE)) return NextResponse.next();

  const url = request.nextUrl.clone();
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  url.pathname = '/login';
  url.search = next === '/' ? '' : `?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Loai tru: /login, moi /api/* (route tu tra 401), asset cua Next, file tinh co duoi.
  matcher: ['/((?!login|api/|_next/|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)'],
};
