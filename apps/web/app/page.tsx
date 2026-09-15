'use client';

/**
 * Man Home — screen_name: `home`, step_index: 0 (ca hai luong).
 * Event: screen_view, select_flow. Xem event-taxonomy.md muc 3.
 */

import { useRouter } from 'next/navigation';
import type { Flow } from '@gsm/shared';
import { trackEvent, useScreenView } from '@/lib/track';

const FLOWS: { flow: Flow; label: string; caption: string; href: string }[] = [
  { flow: 'ride', label: 'Đặt xe', caption: 'Xe máy và ô tô điện', href: '/ride/address' },
  { flow: 'food', label: 'Đặt đồ ăn', caption: 'Món ngon quanh bạn', href: '/food' },
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

      <div className="flex flex-col gap-lg">
        {FLOWS.map(({ flow, label, caption, href }) => (
          <button
            key={flow}
            type="button"
            onClick={() => chooseFlow(flow, href)}
            className="rounded-xl bg-canvas-soft p-2xl text-left text-ink active:bg-surface-pressed"
          >
            <span className="t-display-sm block">{label}</span>
            <span className="t-body-sm mt-xxs block text-body">{caption}</span>
          </button>
        ))}
      </div>

      {/* TODO(Tuan 1): hoan thien giao dien theo DESIGN.md — icon, khung anh, khoang cach.
          Phan tracking o tren da dung, khong sua khi lam UI. */}
    </div>
  );
}
