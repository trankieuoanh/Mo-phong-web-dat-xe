'use client';

/**
 * Nut hanh dong chinh cua moi buoc. Token `button-primary` — tailwind-theme.md muc 4.
 *
 * Nen dung `primary-dark` chu khong phai `primary`: #00B4B8 + chu trang chi cho
 * ti le tuong phan ~2.6:1, duoi nguong WCAG AA. #048589 cho ~4.2:1.
 * Xem tailwind-theme.md muc 0b — day la lua chon 1 (mac dinh khi build).
 */

import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'subtle';

// `enabled:hover:` chu khong phai `hover:` — day la web desktop nen co con tro
// chuot, nhung nut dang disable khong duoc doi mau khi ro chuot qua.
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary-dark text-on-primary enabled:hover:bg-primary',
  secondary: 'bg-canvas text-ink border border-surface-pressed enabled:hover:bg-canvas-soft',
  subtle: 'bg-canvas-soft text-ink enabled:hover:bg-surface-pressed',
};

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
}

export function PrimaryButton({
  variant = 'primary',
  fullWidth = true,
  className = '',
  ...props
}: PrimaryButtonProps) {
  return (
    <button
      {...props}
      className={[
        't-button-md rounded-pill px-2xl py-md',
        // Toi thieu 48px chieu cao tren desktop — screen-map.md muc 6.
        'min-h-[48px] transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}
