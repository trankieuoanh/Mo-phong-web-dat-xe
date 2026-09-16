'use client';

/**
 * Nut Back o goc nav-bar. Ban event `back` roi moi dieu huong.
 *
 * Luu y ve step_index: event `back` mang step_index cua man DANG DUNG khi bam,
 * khong lui ve man dich (event-taxonomy.md muc 1). Vi `screenName` truyen vao
 * la man hien tai nen trackEvent tra bang dung san — khong can lam gi them.
 */

import { useRouter } from 'next/navigation';
import type { ScreenName } from '@gsm/shared';
import { Icon } from '@/components/Icon';
import { trackEvent } from '@/lib/track';

interface BackButtonProps {
  /** Man dang dung. */
  from: ScreenName;
  /** Man se quay ve — di vao properties.to_screen. */
  to: ScreenName;
  /** Route cua man dich. */
  href: string;
  /**
   * Hinh hien thi. Mac dinh mui ten. Man `promo_selection` dung dau `×` cho giong
   * overlay trong spec — hinh khac nhung HANH VI va EVENT y het nut Back,
   * de `to_screen` van khop event-taxonomy.md.
   */
  icon?: 'back' | 'close';
}

export function BackButton({ from, to, href, icon = 'back' }: BackButtonProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      aria-label="Quay lại"
      // icon-button-circular — tailwind-theme.md muc 4
      className="grid size-9 shrink-0 place-items-center rounded-full bg-canvas-soft text-ink hover:bg-surface-pressed active:bg-surface-pressed"
      onClick={() => {
        trackEvent({ eventName: 'back', screenName: from, properties: { to_screen: to } });
        router.push(href);
      }}
    >
      <Icon name={icon === 'close' ? 'close' : 'arrow-left'} size={20} />
    </button>
  );
}
