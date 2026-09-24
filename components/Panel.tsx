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
      {/* Le trong hep lai duoi `md`: 24px moi ben tren man 375px an mat 13% be
          ngang, va the mon vi the bi bop lai con mot cot chu. */}
      {hasHeader ? (
        <header className="flex shrink-0 items-center gap-md border-b border-surface-pressed px-lg py-lg md:px-2xl">
          {leading}
          {title ? <h1 className="t-display-sm">{title}</h1> : null}
          {trailing ? <div className="ml-auto shrink-0">{trailing}</div> : null}
        </header>
      ) : null}

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-lg py-2xl md:px-2xl">
        {children}
      </div>

      {/*
        `sticky bottom-0` — thanh CTA luon trong tam mat.

        O bo cuc `split`, panel cao bang mot man hinh va tu cuon ben trong, nen
        footer von da nam day panel: sticky khong doi gi.

        O bo cuc `wide` thi khac han, va day la cho tung hong: panel cao bang noi
        dung (luoi 29 mon ~3500px) va CA TRANG cuon, nen footer nam duoi tan day
        tai lieu. Nguoi dung them mon o dau luoi thi nut "Xem gio hang" cach do
        hang nghin pixel — khong nhin thay, tuc coi nhu khong ton tai.

        `bg-canvas` la bat buoc khi sticky: khong co no thi noi dung cuon ben
        duoi se lo ra xuyen qua thanh nut.
      */}
      {footer ? (
        <footer className="sticky bottom-0 z-10 shrink-0 border-t border-surface-pressed bg-canvas px-lg py-lg md:px-2xl">
          {footer}
        </footer>
      ) : null}
    </section>
  );
}
