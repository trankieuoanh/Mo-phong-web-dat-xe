'use client';

import type { ReactNode } from 'react';
import { Panel } from '@/components/Panel';
import { AppShell } from '@/components/shell/AppShell';

interface ScreenShellProps {
  title?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  variant?: 'split' | 'wide';
  aside?: ReactNode;
  section?: string;
  tabs?: string[];
  maxWidth?: string;
}

export function ScreenShell({
  title,
  leading,
  trailing,
  children,
  footer,
  variant = 'wide',
  aside,
  section = 'Di chuyển',
  tabs,
  maxWidth = 'max-w-[1120px]',
}: ScreenShellProps) {
  const panel = (
    <Panel title={title} leading={leading} trailing={trailing} footer={footer}>
      {children}
    </Panel>
  );

  if (variant === 'split') {
    return (
      <AppShell section={section} tabs={tabs} fill>
        <div className="flex min-h-0 flex-1 flex-col gap-2xl xl:flex-row">
          <div className="flex min-h-0 w-full flex-col xl:w-[480px] xl:shrink-0">{panel}</div>
          {aside ? (
            <div className="h-[360px] shrink-0 overflow-hidden rounded-xl xl:h-auto xl:min-h-0 xl:flex-1">
              {aside}
            </div>
          ) : null}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell section={section} tabs={tabs}>
      <div className={`mx-auto flex min-h-0 w-full flex-1 flex-col ${maxWidth}`}>{panel}</div>
    </AppShell>
  );
}
