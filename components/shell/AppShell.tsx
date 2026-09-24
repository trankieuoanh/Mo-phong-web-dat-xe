'use client';

/**
 * Khung desktop dung chung: rail trai + top bar + vung noi dung.
 *
 * Desktop-first — sample_ui/ cho thay Green SM tren web la app 2 cot co rail
 * doc, khong phai mot cot 480px. Xem screen-map.md muc 6.
 *
 * Duoi 1024px, rail an di va noi dung tro ve mot cot — khong co thanh cuon ngang.
 */

import type { ReactNode } from 'react';
import { SideRail } from './SideRail';
import { TopBar } from './TopBar';

interface AppShellProps {
  section: string;
  tabs?: string[];
  /**
   * true = khoa chieu cao bang dung mot man hinh (`h-dvh` + `overflow-hidden`).
   *
   * Bat buoc cho bo cuc `split`: `min-h-dvh` chi dat chieu cao TOI THIEU, nen
   * panel se gian dai ra theo noi dung va `overflow-y-auto` ben trong khong bao
   * gio kich hoat — ket qua la ca trang cuon, con ban do cot phai bi keo dai
   * theo. Khoa chieu cao thi panel tu cuon va ban do ghim dung mot khung hinh.
   *
   * Voi bo cuc `wide` thi de false: luoi mon an va bang /history cuon ca trang
   * la dung hon.
   *
   * Chi khoa tu `lg` tro len. Duoi do hai cot xep chong nhau, khoa chieu cao se
   * cat cut khoi ben duoi.
   */
  fill?: boolean;
  children: ReactNode;
}

export function AppShell({ section, tabs, fill = false, children }: AppShellProps) {
  return (
    <div
      className={`flex min-h-dvh bg-canvas-softer ${fill ? 'lg:h-dvh lg:overflow-hidden' : ''}`}
    >
      {/* Rail chiem cho that tren desktop; duoi lg thi bien mat hoan toan. */}
      <div className="hidden lg:block">
        <SideRail />
      </div>

      {/* min-w-0 la bat buoc: thieu no, mot bang rong trong /history se day
          ca layout tran ra va sinh thanh cuon ngang. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar section={section} tabs={tabs} />
        <main className="flex min-h-0 flex-1 flex-col p-2xl">{children}</main>
      </div>
    </div>
  );
}
