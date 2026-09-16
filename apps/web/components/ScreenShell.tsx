'use client';

/**
 * Khung chung cua moi man: nav-bar + container 480px.
 *
 * Mobile-first — day la mo phong app dien thoai, khong phai web desktop
 * (screen-map.md muc 6). Container canh giua tren man rong.
 */

import type { ReactNode } from 'react';

interface ScreenShellProps {
  title: string;
  /** Nut Back o goc trai nav-bar. */
  leading?: ReactNode;
  /** Khoi phu o goc phai nav-bar (selector tinh/thanh, nut "Dat ho"...). */
  trailing?: ReactNode;
  children: ReactNode;
  /** Thanh nut hanh dong dinh day man hinh. */
  footer?: ReactNode;
}

export function ScreenShell({ title, leading, trailing, children, footer }: ScreenShellProps) {
  return (
    // Nen man la `canvas-softer`, KHONG phai `canvas`: card tom tat dung
    // `card-content` (nen trang) nen neu nen man cung trang thi card tang hinh.
    // nav-bar va footer giu `bg-canvas` dung theo bang tailwind-theme.md muc 4.
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-canvas-softer">
      {/* nav-bar — tailwind-theme.md muc 4 */}
      <header className="sticky top-0 z-10 flex items-center gap-md bg-canvas px-3xl py-lg text-ink">
        {leading}
        <h1 className="t-body-md-strong">{title}</h1>
        {trailing ? <div className="ml-auto shrink-0">{trailing}</div> : null}
      </header>

      <main className="flex-1 px-3xl pb-3xl">{children}</main>

      {footer ? (
        // shadow-level-2 chi dung o day — de tach thanh nut khoi noi dung cuon phia sau.
        <footer
          className="sticky bottom-0 bg-canvas px-3xl pt-lg shadow-level-2"
          style={{ paddingBottom: 'max(var(--spacing-lg), env(safe-area-inset-bottom))' }}
        >
          {footer}
        </footer>
      ) : null}
    </div>
  );
}
