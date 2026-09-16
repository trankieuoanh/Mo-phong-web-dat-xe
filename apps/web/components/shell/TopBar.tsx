'use client';

/**
 * Thanh tren cung — theo sample_ui/main_screen.png.
 *
 * `section` la ten MUC ("Di chuyen", "Giao hang"), khong phai ten man.
 * `tabs` thuan tuy trang tri: tab dau duoc to dam + gach chan, cac tab con lai mo.
 * Khong tab nao bam duoc — chung khong co man tuong ung trong SCREENS.
 */

import { UserMenu } from './UserMenu';

interface TopBarProps {
  section: string;
  tabs?: string[];
}

export function TopBar({ section, tabs = [] }: TopBarProps) {
  return (
    <header className="sticky top-0 z-10 flex shrink-0 items-center gap-3xl border-b border-surface-pressed bg-canvas px-3xl">
      <h2 className="t-display-lg shrink-0 py-lg">{section}</h2>

      {tabs.length > 0 ? (
        <div aria-hidden="true" className="flex items-center gap-2xl self-stretch">
          {tabs.map((tab, i) => (
            <span
              key={tab}
              className={`t-body-md-strong flex items-center border-b-2 py-lg ${
                i === 0 ? 'border-primary text-ink' : 'border-transparent text-body'
              }`}
            >
              {tab}
            </span>
          ))}
        </div>
      ) : null}

      <UserMenu />
    </header>
  );
}
