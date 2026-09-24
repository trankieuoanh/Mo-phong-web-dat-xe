'use client';

import type { ReactNode } from 'react';

interface PanelProps {
  title?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Panel({ title, leading, trailing, children, footer, className }: PanelProps) {
  const hasHeader = Boolean(title || leading || trailing);

  return (
    <section
      className={`flex min-h-0 flex-col overflow-hidden rounded-none bg-canvas text-ink desktop:rounded-xl ${className ?? ''}`}
    >
      {hasHeader ? (
        <header className="flex shrink-0 flex-wrap items-center gap-md border-b border-surface-pressed px-lg py-lg desktop:px-2xl">
          {leading}
          {title ? <h1 className="t-display-sm min-w-0 flex-1 break-words">{title}</h1> : null}
          {trailing ? <div className="ml-auto shrink-0">{trailing}</div> : null}
        </header>
      ) : null}

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-lg py-2xl desktop:px-2xl">
        {children}
      </div>

      {footer ? (
        <footer className="sticky bottom-0 z-10 shrink-0 border-t border-surface-pressed bg-canvas px-lg pt-lg pb-[max(var(--spacing-lg),env(safe-area-inset-bottom,0px))] desktop:px-2xl [&_button]:min-h-12 [&_a]:min-h-12">
          {footer}
        </footer>
      ) : null}
    </section>
  );
}
