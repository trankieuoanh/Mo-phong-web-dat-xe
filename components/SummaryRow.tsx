'use client';

/**
 * Mot dong "nhan — gia tri" trong the tong ket. Pattern D cua ride-flow-design.md.
 *
 * Truoc day ham nay duoc copy NGUYEN VAN o nam page: ride/confirm, ride/success,
 * food/cart, food/confirm, food/success. Nam ban giong het nhau la nam cho phai
 * sua khi doi mot con so padding.
 */

import type { ReactNode } from 'react';

interface SummaryRowProps {
  label: string;
  value: ReactNode;
  /** Dong tong cong: dam hon va co duong ke tren. */
  emphasis?: boolean;
}

export function SummaryRow({ label, value, emphasis = false }: SummaryRowProps) {
  if (emphasis) {
    return (
      // `border-canvas` = duong ke TRANG tren nen `canvas-soft`. Do la thu phap
      // chia o cua du an nay, khong phai loi thieu mau duong ke.
      <div className="mt-lg flex min-w-0 flex-wrap items-center justify-between gap-x-lg gap-y-xs border-t border-canvas pt-lg">
        <span className="t-body-md-strong min-w-0 break-words">{label}</span>
        <span className="t-display-sm min-w-0 max-w-full break-words text-right">{value}</span>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-lg gap-y-xs py-xs">
      <span className="t-body-sm min-w-0 break-words text-body">{label}</span>
      <span className="t-body-md-strong min-w-0 max-w-full break-words text-right">{value}</span>
    </div>
  );
}
