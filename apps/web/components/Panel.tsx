'use client';

/**
 * Card trang chua noi dung mot man — token `card-content` (tailwind-theme.md muc 4).
 *
 * Ba khu co dinh: header / body cuon duoc / footer chua CTA.
 * Footer dinh day PANEL, khong phai day man hinh — day la khac biet chinh so
 * voi ban mobile cu (screen-map.md muc 6).
 */

import type { ReactNode } from 'react';

interface PanelProps {
  title?: string;
  /** Nut Back o dau header. */
  leading?: ReactNode;
  /** Khoi phu cuoi header. */
  trailing?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Panel({ title, leading, trailing, children, footer, className }: PanelProps) {
  const hasHeader = Boolean(title || leading || trailing);

  return (
    <section
      className={`flex min-h-0 flex-col overflow-hidden rounded-xl bg-canvas text-ink ${className ?? ''}`}
    >
      {hasHeader ? (
        <header className="flex shrink-0 items-center gap-md border-b border-surface-pressed px-2xl py-lg">
          {leading}
          {title ? <h1 className="t-display-sm">{title}</h1> : null}
          {trailing ? <div className="ml-auto shrink-0">{trailing}</div> : null}
        </header>
      ) : null}

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2xl py-2xl">{children}</div>

      {footer ? (
        <footer className="shrink-0 border-t border-surface-pressed px-2xl py-lg">{footer}</footer>
      ) : null}
    </section>
  );
}
