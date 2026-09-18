'use client';

/**
 * Thanh tren cung — theo sample_ui/main_screen.png.
 *
 * `section` la ten MUC ("Di chuyen", "Giao hang"), khong phai ten man.
 * `tabs` thuan tuy trang tri: tab dau duoc to dam + gach chan, cac tab con lai mo.
 * Khong tab nao bam duoc — chung khong co man tuong ung trong SCREENS.
 *
 * NGOAI LE CO Y — cap tab LUONG ben duoi `lg`. `SideRail` la `hidden lg:block`,
 * nen duoi 1024px truoc day KHONG CO CACH NAO doi luong: ca app that su chi con
 * mot nua. Cap tab nay chay dung luat cua rail, doc tu CUNG mot ham
 * `selectFlowScreenFor` o ./flow-nav.ts — bam duoc o ba man dau luong va o bon
 * man ngoai funnel, tinh khi dang o giua mot luong. Ca hai truong hop bam duoc
 * deu ban `select_flow`, dung nguyen tac "bam duoc thi phai do duoc".
 */

import { usePathname, useRouter } from 'next/navigation';
import { FLOW_TABS, activeFlowOf, selectFlowScreenFor } from './flow-nav';
import { trackSelectFlow } from '@/lib/track';
import { CartButton } from './CartButton';
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
    <header className="sticky top-0 z-10 flex shrink-0 items-center gap-lg border-b border-surface-pressed bg-canvas px-lg lg:gap-3xl lg:px-3xl">
      {/* Mot class `t-*` duy nhat, khong co bien the `lg:`: cac class typography
          nam trong `@layer components` chu khong phai utility cua Tailwind, nen
          `lg:t-display-lg` se khong sinh ra CSS nao — mot class im lang khong
          chay con te hon khong co class. */}
      <h2 className="t-display-lg shrink-0 py-lg">{section}</h2>

      {/* Tab luong — CHI hien khi rail bi an. Tren desktop rail da lam viec nay. */}
      <div className="flex items-center gap-sm lg:hidden">
        {FLOW_TABS.map((tab) => {
          const active = tab.flow === activeFlow;
          // Cung mot luat voi SideRail, doc tu cung mot ham — truoc day hai noi
          // tu suy ra rieng va da cung sai mot kieu o man ngoai funnel.
          const selectScreen = selectFlowScreenFor(pathname, tab.flow, tab.href);

          if (selectScreen === null) {
            return (
              <span
                key={tab.flow}
                aria-current={active ? 'page' : undefined}
                className={`t-body-sm-strong rounded-pill px-lg py-sm ${
                  active ? 'bg-canvas-soft text-primary-dark' : 'text-mute'
                }`}
              >
                {tab.label}
              </span>
            );
          }

          return (
            <button
              key={tab.flow}
              type="button"
              onClick={() => {
                // Ban DONG BO truoc push — xem ghi chu o trackSelectFlow.
                trackSelectFlow(selectScreen, tab.flow);
                router.push(tab.href);
              }}
              className="t-body-sm-strong rounded-pill px-lg py-sm text-body transition-colors hover:bg-canvas-soft"
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {tabs.length > 0 ? (
        <div aria-hidden="true" className="hidden items-center gap-2xl self-stretch lg:flex">
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

      {/* `ml-auto` day ca hai khoi ve phai; UserMenu tu no khong co ml-auto. */}
      <div className="ml-auto flex items-center gap-sm">
        <CartButton />
        <UserMenu />
      </div>
    </header>
  );
}
