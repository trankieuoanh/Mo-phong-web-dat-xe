'use client';

import { usePathname, useRouter } from 'next/navigation';
import { trackSelectFlow } from '@/lib/track';
import { CartButton } from './CartButton';
import { FLOW_TABS, activeFlowOf, selectFlowScreenFor } from './flow-nav';
import { MobileMenu } from './MobileMenu';
import { UserMenu } from './UserMenu';

interface TopBarProps {
  section: string;
  tabs?: string[];
}

export function TopBar({ section, tabs = [] }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const activeFlow = activeFlowOf(pathname);

  return (
    <header className="sticky top-0 z-20 shrink-0 border-b border-surface-pressed bg-canvas pt-[max(var(--spacing-lg),env(safe-area-inset-top,0px))] desktop:pt-0">
      <div className="flex min-h-12 items-center gap-md px-lg desktop:hidden">
        <h2 className="t-display-sm min-w-0 flex-1 truncate">{section}</h2>
        <div className="flex shrink-0 items-center gap-xs">
          <CartButton />
          <MobileMenu />
        </div>
      </div>

      <div
        role="group"
        aria-label="Chọn luồng"
        className="mx-lg mb-lg grid grid-cols-2 gap-xxs rounded-pill bg-canvas-soft p-xxs desktop:hidden"
      >
        {FLOW_TABS.map((tab) => {
          const active = tab.flow === activeFlow;
          const selectScreen = selectFlowScreenFor(pathname, tab.flow, tab.href);
          const disabled = selectScreen === null;
          const tone = active
            ? 'bg-canvas text-primary-dark'
            : disabled
              ? 'bg-canvas text-mute opacity-50'
              : 'bg-canvas text-ink hover:bg-surface-pressed';

          return (
            <button
              key={tab.flow}
              type="button"
              disabled={disabled}
              aria-current={active ? 'page' : undefined}
              onClick={() => {
                if (!selectScreen) return;
                trackSelectFlow(selectScreen, tab.flow);
                router.push(tab.href);
              }}
              className={`t-body-md-strong min-h-11 rounded-pill px-md transition-colors disabled:cursor-not-allowed ${tone}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="hidden items-center gap-lg px-lg desktop:flex xl:gap-3xl xl:px-3xl">
        <h2 className="t-display-lg shrink-0 py-lg">{section}</h2>

        {tabs.length > 0 ? (
          <div aria-hidden="true" className="flex items-center gap-2xl self-stretch">
            {tabs.map((tab, index) => (
              <span
                key={tab}
                className={`t-body-md-strong flex items-center border-b-2 py-lg ${
                  index === 0 ? 'border-primary text-ink' : 'border-transparent text-body'
                }`}
              >
                {tab}
              </span>
            ))}
          </div>
        ) : null}

        <div className="ml-auto flex items-center gap-sm">
          <CartButton />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
