'use client';

/**
 * Man Home — screen_name: `home`, step_index: 0 (ca hai luong).
 * Event: screen_view, select_flow. Xem event-taxonomy.md muc 3.
 */

import { useRouter } from 'next/navigation';
import type { Flow } from '@gsm/shared';
import { trackEvent, useScreenView } from '@/lib/track';

const FLOWS: { flow: Flow; label: string; caption: string; href: string; glyph: string }[] = [
  {
    flow: 'ride',
    label: 'Đặt xe',
    caption: 'Xe máy và ô tô điện',
    href: '/ride/address',
    glyph: '🛵',
  },
  { flow: 'food', label: 'Đặt đồ ăn', caption: 'Món ngon quanh bạn', href: '/food', glyph: '🍜' },
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
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-canvas px-3xl py-3xl">
      <header className="mb-3xl">
        <p className="t-body-sm text-body">Xin chào 👋</p>
        <h1 className="t-display-md text-ink">Hôm nay bạn muốn gì?</h1>
      </header>

      {/* card-to-card 32px — DESIGN.md muc "Whitespace Philosophy". */}
      <div className="flex flex-col gap-3xl">
        {FLOWS.map(({ flow, label, caption, href, glyph }) => (
          <button
            key={flow}
            type="button"
            onClick={() => chooseFlow(flow, href)}
            className="flex items-center gap-lg rounded-xl bg-canvas-soft p-2xl text-left text-ink active:bg-surface-pressed"
          >
            {/* Khung anh 4:3 dat ky tu thay cho anh that — cung thu phap voi
                app/food/page.tsx (tailwind-theme.md muc 7). */}
            <span className="grid aspect-[4/3] w-24 shrink-0 place-items-center rounded-xl bg-canvas">
              <span className="t-display-lg" aria-hidden="true">
                {glyph}
              </span>
            </span>

            <span className="flex-1">
              <span className="t-display-sm block">{label}</span>
              <span className="t-body-sm mt-xxs block text-body">{caption}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
