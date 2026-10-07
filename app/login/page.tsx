'use client';

/**
 * /login — NGOAI FUNNEL. Khong `useScreenView`, khong `trackEvent`
 * (CLAUDE.md quy tac 9): mot buoc dang nhap ban event se lam ban moi ti le
 * conversion. Khong co trong SCREENS.
 *
 * Khong con la cong bat buoc: khach duyet tu do, dang nhap chi duoc hoi khi bam
 * "Dat xe" / "Dat don" (LoginModal). Trang nay con de vao truc tiep qua URL.
 * Form hai buoc nam o components/LoginForm.tsx.
 */

import { useRouter } from 'next/navigation';
import { GsmLogo } from '@/components/GsmLogo';
import { LoginForm } from '@/components/LoginForm';
import { useApp } from '@/lib/app-context';

/** Chi chap nhan duong dan noi bo — chan open redirect qua `?next=`. */
function readNext(): string {
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useApp();

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas-softer p-lg">
      <div className="shadow-level-2 w-full max-w-[420px] rounded-xl bg-canvas p-2xl">
        <GsmLogo variant="full" size={32} className="text-primary-dark" />
        <div className="mt-2xl">
          <LoginForm
            onSuccess={(phone) => {
              signIn(phone);
              router.replace(readNext());
            }}
          />
        </div>
      </div>
    </main>
  );
}
