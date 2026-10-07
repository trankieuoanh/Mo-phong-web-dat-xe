/**
 * POST /api/auth/send-code — gui ma 6 so toi so dien thoai. Xem api-endpoints.md.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { otpCookie, sendCode } from '@/lib/server/services/otp.service';
import { validateSendCode } from '@/lib/server/validators/auth.validator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Body không phải JSON hợp lệ' }, { status: 400 });
  }

  const input = validateSendCode(body);
  if (!input.ok) return Response.json({ error: input.error }, { status: 400 });

  try {
    const result = await sendCode(input.value.phone);
    if (!result.ok && 'notConfigured' in result) {
      console.error('[POST /api/auth/send-code] SMS_PROVIDER=mock tren production nhung thieu SMS_MOCK_EXPOSE_CODE=true — dat bien nay roi redeploy');
      return Response.json({ error: 'Chưa cấu hình gửi mã xác thực (SMS)' }, { status: 503 });
    }
    if (!result.ok) {
      const seconds = Math.ceil(result.retryAfterMs / 1000);
      return Response.json(
        { error: `Vui lòng đợi ${seconds} giây trước khi gửi lại mã`, retry_after: seconds },
        { status: 429, headers: { 'Retry-After': String(seconds) } },
      );
    }
    const response = NextResponse.json({
      ok: true,
      phone: input.value.phone,
      dev_code: result.devCode,
    });
    response.cookies.set(otpCookie(result.challenge));
    return response;
  } catch (error) {
    console.error('[POST /api/auth/send-code] that bai:', error);
    return Response.json({ error: 'Không gửi được mã xác thực' }, { status: 500 });
  }
}
