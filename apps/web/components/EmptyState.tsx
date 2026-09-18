'use client';

/**
 * Trang thai rong / loi, co hanh dong di kem.
 *
 * Ban cu cua man menu chi co MOT dong chu can giua khi khong tim thay mon, va
 * khong co gi ca khi goi API that bai. Mot mat phang trong khong noi cho nguoi
 * dung biet ho nen lam gi tiep — nut o duoi day moi la phan viec chinh cua
 * component nay, khong phai cai icon.
 */

import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/Icon';

interface EmptyStateProps {
  icon: IconName;
  title: string;
  /** Mot cau giai thich. Bo qua duoc khi tieu de da du. */
  description?: string;
  /** Thuong la mot <PrimaryButton fullWidth={false}>. */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center px-lg py-3xl text-center ${className ?? ''}`}>
      <span className="grid size-14 place-items-center rounded-full bg-canvas-soft text-primary-dark">
        <Icon name={icon} size={26} />
      </span>
      <p className="t-body-md-strong mt-lg">{title}</p>
      {description ? <p className="t-body-sm mt-xxs text-body">{description}</p> : null}
      {action ? <div className="mt-lg">{action}</div> : null}
    </div>
  );
}
