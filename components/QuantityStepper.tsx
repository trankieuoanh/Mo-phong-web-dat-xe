'use client';

/**
 * Nut tang/giam so luong. Token `icon-button-circular` (tailwind-theme.md muc 4).
 *
 * Truoc day component nay duoc viet LAI o hai cho — man chi tiet mon va man gio
 * hang — voi hai mau nen khac nhau (`bg-canvas-soft` va `bg-canvas`). Cung mot
 * nut, cung mot viec, hai ve ngoai: dung la kieu lech ma khong ai bao cao nhung
 * ai cung thay.
 *
 * `disabled` o cham duoi la THAT. Ban cu de nut tru luon bam duoc roi ham xu ly
 * lang le `return` — mot control trong nhu song ma khong lam gi la mot loi noi
 * doi nho, va no lap lai moi lan nguoi dung thu.
 */

import { Icon } from '@/components/Icon';

interface QuantityStepperProps {
  quantity: number;
  onChange: (next: number) => void;
  /** Mac dinh 1. Dat 0 o gio hang neu muon giam toi 0 la xoa dong. */
  min?: number;
  max?: number;
  /** Ten mon — vao aria-label de nguoi dung trinh doc man hinh biet dang sua mon nao. */
  label: string;
}

export function QuantityStepper({
  quantity,
  onChange,
  min = 1,
  max = 99,
  label,
}: QuantityStepperProps) {
  return (
    <div className="flex items-center gap-md">
      <Button
        icon="minus"
        ariaLabel={`Giảm số lượng ${label}`}
        disabled={quantity <= min}
        onClick={() => onChange(quantity - 1)}
      />
      {/* aria-live: so luong doi ma khong co dieu huong nao, nen neu khong bao
          thi nguoi dung trinh doc man hinh bam nut xong khong biet ket qua. */}
      <span className="t-body-md-strong w-6 text-center" aria-live="polite">
        {quantity}
      </span>
      <Button
        icon="plus"
        ariaLabel={`Tăng số lượng ${label}`}
        disabled={quantity >= max}
        onClick={() => onChange(quantity + 1)}
      />
    </div>
  );
}

function Button({
  icon,
  ariaLabel,
  disabled,
  onClick,
}: {
  icon: 'plus' | 'minus';
  ariaLabel: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className="grid size-9 place-items-center rounded-full bg-canvas-soft text-ink transition-colors enabled:hover:bg-surface-pressed enabled:active:bg-surface-pressed disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Icon name={icon} size={18} />
    </button>
  );
}
