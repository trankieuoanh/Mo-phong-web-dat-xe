'use client';

/**
 * Man Home — screen_name: `home`, step_index: 0 (ca hai luong).
 * Event: screen_view, select_flow. Xem event-taxonomy.md muc 3.
 *
 * Luu y: `SideRail` cung ban `select_flow` khi bam o dung man nay — cung helper,
 * cung `properties`. Mot session vi the co the co nhieu `select_flow` neu nguoi
 * dung phan van, y het `select_vehicle` (ride-flow-design.md muc 7).
 */

import { useRouter } from 'next/navigation';
import type { Flow } from '@gsm/shared';
import { Icon, type IconName } from '@/components/Icon';
import { AppShell } from '@/components/shell/AppShell';
import { trackEvent, useScreenView } from '@/lib/track';

const FLOWS: {
  flow: Flow;
  label: string;
  caption: string;
  href: string;
  icon: IconName;
  cta: string;
}[] = [
  {
    flow: 'ride',
    label: 'Đặt xe',
    caption: 'Xe máy và ô tô điện, đón trong vài phút',
    href: '/ride/address',
    icon: 'car',
    cta: 'Đặt chuyến mới',
  },
  {
    flow: 'food',
    label: 'Đặt đồ ăn',
    caption: 'Món ngon quanh bạn, giao tận nơi',
    href: '/food',
    icon: 'bag',
    cta: 'Xem thực đơn',
  },
];

export default function HomePage() {
  useScreenView('home');
  const router = useRouter();

  function chooseFlow(flow: Flow, href: string) {
    // `flow` truyen tay: man home co flow 'none', nhung select_flow phai ghi
    // dung gia tri duoc chon de dem duoc ti le giua 2 luong (event-taxonomy.md muc 3).
    trackEvent({
      eventName: 'select_flow',
      screenName: 'home',
      flow,
      properties: { flow_chosen: flow },
    });
    router.push(href);
  }

  return (
    <AppShell section="Trang chủ" tabs={['Tổng quan']}>
      <div className="mx-auto w-full max-w-[1120px]">
        <header className="mb-2xl flex items-center gap-md">
          <span className="grid size-12 place-items-center rounded-full bg-canvas-soft text-primary-dark">
            <Icon name="wave" />
          </span>
          <div>
            <p className="t-body-sm text-body">Xin chào</p>
            <h1 className="t-display-md text-ink">Hôm nay bạn muốn gì?</h1>
          </div>
        </header>

        {/* card-to-card 32px — DESIGN.md muc "Whitespace Philosophy". */}
        <div className="grid gap-3xl md:grid-cols-2">
          {FLOWS.map(({ flow, label, caption, href, icon, cta }) => (
            <button
              key={flow}
              type="button"
              onClick={() => chooseFlow(flow, href)}
              className="group flex flex-col items-start rounded-xl bg-canvas p-3xl text-left text-ink transition-colors hover:bg-canvas-soft"
            >
              {/* Khung anh 4:3 dat icon thay cho anh that —
                  cung thu phap voi app/food/page.tsx (tailwind-theme.md muc 7). */}
              <span className="grid aspect-[4/3] w-full place-items-center rounded-xl bg-canvas-soft text-primary-dark group-hover:bg-canvas">
                <Icon name={icon} size={72} />
              </span>

              <span className="t-display-sm mt-2xl block">{label}</span>
              <span className="t-body-sm mt-xxs block text-body">{caption}</span>

              <span className="t-body-sm-strong mt-lg inline-flex items-center gap-sm text-primary-dark">
                {cta}
                <Icon name="chevron-right" size={16} />
              </span>
            </button>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
