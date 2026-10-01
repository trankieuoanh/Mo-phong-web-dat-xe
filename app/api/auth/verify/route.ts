/**
 * POST /api/auth/verify — doi ma 6 so lay cookie dang nhap. Xem api-endpoints.md.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { authCookie, signToken } from '@/lib/server/services/auth-token';
import { verifyCode } from '@/lib/server/services/otp.service';
import { recordLogin } from '@/lib/server/services/user.service';
import { OTP_COOKIE } from '@/lib/shared';
import { validateVerify } from '@/lib/server/validators/auth.validator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REASON_MESSAGES = {
  not_found: 'Chưa gửi mã cho số này — bấm "Gửi mã" trước',
  expired: 'Mã đã hết hạn — vui lòng gửi lại mã',
  too_many_attempts: 'Nhập sai quá nhiều lần — vui lòng gửi lại mã',
  wrong_code: 'Mã xác thực không đúng',
} as const;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Body không phải JSON hợp lệ' }, { status: 400 });
  }

  const input = validateVerify(body);
  if (!input.ok) return Response.json({ error: input.error }, { status: 400 });

  try {
    const result = verifyCode(
      input.value.phone,
      input.value.code,
      request.cookies.get(OTP_COOKIE)?.value,
    );
    if (!result.ok) {
      return Response.json(
        { error: REASON_MESSAGES[result.reason], reason: result.reason },
        { status: 401 },
      );
    }
    // Khong chan dang nhap vi Firestore (vd. RESOURCE_EXHAUSTED) — xem user.service.ts.
    await recordLogin(input.value.phone).catch((error) => {
      console.warn('[POST /api/auth/verify] khong ghi duoc users/{phone}:', error);
    });

    const response = NextResponse.json({ phone: input.value.phone });
    response.cookies.set(authCookie(signToken(input.value.phone)));
    response.cookies.delete({ name: OTP_COOKIE, path: '/api/auth' });
    return response;
  } catch (error) {
    console.error('[POST /api/auth/verify] that bai:', error);
    return Response.json({ error: 'Không xác thực được mã' }, { status: 500 });
  }
}
