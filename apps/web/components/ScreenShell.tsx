'use client';

/**
 * Khung chung cua moi man luong.
 *
 * Desktop-first (screen-map.md muc 6): AppShell (rail + top bar) boc mot trong
 * hai bo cuc:
 *
 *  - `split` — panel trai 480px + cot `aside` (ban do) chiem phan con lai.
 *    Dung cho 4 man ride co ban do: address, pickup, vehicle, confirm.
 *  - `wide`  — mot cot canh giua. Dung cho home, promo, success va ca luong food.
 *
 * Nam prop cu (title / leading / trailing / children / footer) GIU NGUYEN Y NGHIA
 * nen 12 page khong phai viet lai — chung chi them variant/section/aside.
 *
 * Nut CTA gio dinh day PANEL chu khong dinh day man hinh: tren desktop khong con
 * `env(safe-area-inset-bottom)` nao de tranh, va thanh nut trai het chieu ngang
 * 1600px trong rat sai.
 */

import type { ReactNode } from 'react';
import { Panel } from '@/components/Panel';
import { AppShell } from '@/components/shell/AppShell';

interface ScreenShellProps {
  /** Tieu de PANEL (khong phai tieu de muc o top bar). */
  title: string;
  /** Nut Back o dau header panel. */
  leading?: ReactNode;
  /** Khoi phu cuoi header panel. */
  trailing?: ReactNode;
  children: ReactNode;
  /** Thanh nut hanh dong, dinh day panel. */
  footer?: ReactNode;
  /** Mac dinh 'wide'. */
  variant?: 'split' | 'wide';
  /** Cot phai khi variant='split' — thuong la <MapCanvas fill />. */
  aside?: ReactNode;
  /** Tieu de muc o top bar. */
  section?: string;
  /** Tab trang tri canh tieu de muc. */
  tabs?: string[];
  /** Be ngang toi da cua panel khi variant='wide'. */
  maxWidth?: string;
}

export function ScreenShell({
  title,
  leading,
  trailing,
  children,
  footer,
  variant = 'wide',
  aside,
  section = 'Di chuyển',
  tabs,
  maxWidth = 'max-w-[1120px]',
}: ScreenShellProps) {
  const panel = (
    <Panel title={title} leading={leading} trailing={trailing} footer={footer}>
      {children}
    </Panel>
  );

  if (variant === 'split') {
    return (
      // `fill` khoa chieu cao bang mot man hinh: panel tu cuon ben trong thay vi
      // keo dai ca trang, nho vay ban do ben phai luon ghim dung mot khung hinh.
      // Duoi `lg` thi bo khoa — hai khoi xep chong nhau va cuon ca trang.
      <AppShell section={section} tabs={tabs} fill>
        <div className="flex min-h-0 flex-1 flex-col gap-2xl lg:flex-row">
          <div className="flex min-h-0 w-full flex-col lg:w-[480px] lg:shrink-0">{panel}</div>
          {aside ? (
            <div className="min-h-[360px] flex-1 overflow-hidden rounded-xl lg:min-h-0">{aside}</div>
          ) : null}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell section={section} tabs={tabs}>
      <div className={`mx-auto flex min-h-0 w-full flex-1 flex-col ${maxWidth}`}>{panel}</div>
    </AppShell>
  );
}
