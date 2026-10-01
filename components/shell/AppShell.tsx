'use client';

import type { ReactNode } from 'react';
import { SideRail } from './SideRail';
import { TopBar } from './TopBar';

interface AppShellProps {
  section: string;
  tabs?: string[];
  fill?: boolean;
  children: ReactNode;
}

export function AppShell({ section, tabs, fill = false, children }: AppShellProps) {
  return (
    <div
      className={`flex min-h-dvh bg-canvas-softer ${fill ? 'xl:h-dvh xl:overflow-hidden' : ''}`}
    >
      <SideRail />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar section={section} tabs={tabs} />
        <main className="flex min-h-0 flex-1 flex-col desktop:p-2xl">{children}</main>
      </div>
    </div>
  );
}
