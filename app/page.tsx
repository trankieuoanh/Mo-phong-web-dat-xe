'use client';

import { useRouter } from 'next/navigation';
import { GsmLogo } from '@/components/GsmLogo';
import { Icon, type IconName } from '@/components/Icon';
import type { Flow } from '@/lib/shared';
import { trackSelectFlow, useScreenView } from '@/lib/track';

interface Choice {
  flow: Flow;
  label: string;
  href: string;
  icon: IconName;
}

const CHOICES: Choice[] = [
  { flow: 'ride', label: 'Đặt xe', href: '/ride/address', icon: 'car' },
  { flow: 'food', label: 'Đặt đồ ăn', href: '/food', icon: 'bag' },
];

export default function HomePage() {
  useScreenView('home');
  const router = useRouter();

  function choose(choice: Choice) {
    trackSelectFlow('home', choice.flow);
    router.push(choice.href);
  }

  return (
    <main className="flex min-h-dvh flex-col bg-canvas-softer px-lg pt-[max(var(--spacing-3xl),env(safe-area-inset-top,0px))] pb-[max(var(--spacing-3xl),env(safe-area-inset-bottom,0px))]">
      <section className="mx-auto flex w-full max-w-[760px] flex-1 flex-col justify-center">
        <GsmLogo variant="full" size={40} className="text-primary-dark" />
        <h1 className="t-display-lg mt-2xl">Chọn dịch vụ của bạn</h1>
        <p className="t-body-md mt-sm text-body">Chọn một dịch vụ để bắt đầu</p>

        <div className="mt-3xl grid grid-cols-1 gap-lg sm:grid-cols-2">
          {CHOICES.map((choice) => (
            <button
              key={choice.flow}
              type="button"
              onClick={() => choose(choice)}
              className="flex w-full items-center gap-lg rounded-xl border border-surface-pressed bg-canvas p-2xl text-left text-ink transition-colors hover:bg-canvas-soft active:bg-surface-pressed"
            >
              <span className="grid size-14 shrink-0 place-items-center rounded-full bg-canvas-soft text-primary-dark">
                <Icon name={choice.icon} size={28} />
              </span>
              <span className="t-display-sm min-w-0 flex-1">{choice.label}</span>
              <Icon name="chevron-right" className="text-primary-dark" />
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
