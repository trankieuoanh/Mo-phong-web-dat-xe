'use client';

/**
 * Menu doc ben trai — theo sample_ui/homepage.png (mo rong, co nhan chu) va
 * sample_ui/main_screen.png (da thu gon, chi icon).
 *
 * HAI TRANG THAI, nut "Thu gon menu" o day chuyen qua lai. Lua chon nho vao
 * localStorage nen F5 khong mat.
 *
 * QUY TAC BAM DUOC (quan trong cho chat luong du lieu):
 *
 * - O man `/` (home): muc "Dat xe" va "Dat do an" ban `select_flow` y het hai
 *   card giua man — cung helper, cung `properties.flow_chosen`. Khong co event moi.
 * - O MOI man trong luong: hai muc do la TRANG TRI, khong bam duoc. Mot nut bam
 *   duoc ma khong ghi lai la mot khoang mu trong du lieu; con nhay luong giua
 *   chung bang sidebar se tao session lai khong phan tich duoc.
 * - Muc "Hoat dong" bam duoc o moi noi. Roi luong giua chung la BO DO THAT va
 *   duoc ghi nhan dung bang max(step_index) — du lieu trung thuc, khong phai loi.
 */

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Flow } from '@gsm/shared';
import { GsmLogo } from '@/components/GsmLogo';
import { Icon, type IconName } from '@/components/Icon';
import { trackEvent } from '@/lib/track';

const COLLAPSED_KEY = 'gsm_rail_collapsed';

interface RailItem {
  icon: IconName;
  label: string;
  /** Luong se ban `select_flow` khi bam o man home. */
  flow?: Flow;
  /** Duong dan. Muc co `flow` dung href de dieu huong sau khi ban event. */
  href?: string;
}

/**
 * Nhan theo DU AN NAY, khong copy nguyen anh mau: Green SM that co dich vu
 * "Giao hang" (giao kien hang), con o day luong thu hai la dat do an.
 */
const ITEMS: RailItem[] = [
  { icon: 'bag', label: 'Đặt đồ ăn', flow: 'food', href: '/food' },
  { icon: 'car', label: 'Đặt xe', flow: 'ride', href: '/ride/address' },
  { icon: 'clock', label: 'Hoạt động', href: '/history' },
  { icon: 'users', label: 'Tài khoản phụ' },
  { icon: 'headset', label: 'Trung tâm hỗ trợ' },
  { icon: 'doc', label: 'Điều khoản & Chính sách' },
];

export function SideRail() {
  const pathname = usePathname();
  const router = useRouter();

  // Mac dinh MO RONG. Doc localStorage trong useEffect, KHONG luc render —
  // cung bay hydration mismatch da ghi o dau lib/session.ts.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === '1');
    } catch {
      // Storage bi chan (cua so an danh) — giu mac dinh mo rong.
    }
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        // Khong ghi duoc thi thoi, trang thai trong phien nay van dung.
      }
      return next;
    });
  }

  const isHome = pathname === '/';

  function chooseFlow(flow: Flow, href: string) {
    // `flow` truyen tay vi man home co flow 'none' — event-taxonomy.md muc 3.
    trackEvent({
      eventName: 'select_flow',
      screenName: 'home',
      flow,
      properties: { flow_chosen: flow },
    });
    router.push(href);
  }

  // Khi thu gon, o icon la hinh vuong 44px; khi mo rong, hang trai het be ngang.
  const rowBase = collapsed
    ? 'grid size-11 place-items-center rounded-xl transition-colors'
    : 'flex w-full items-center gap-md rounded-xl px-md py-md transition-colors';

  return (
    <nav
      aria-label="Điều hướng chính"
      className={`sticky top-0 flex h-dvh shrink-0 flex-col gap-xxs border-r border-surface-pressed bg-canvas p-lg transition-[width] ${
        collapsed ? 'w-[72px] items-center' : 'w-[264px]'
      }`}
    >
      <span className={`mb-lg flex items-center text-primary-dark ${collapsed ? '' : 'px-md'}`}>
        {collapsed ? <GsmLogo size={28} /> : <GsmLogo variant="full" size={30} />}
      </span>

      {ITEMS.map((item) => {
        const active =
          (item.flow === 'ride' && pathname.startsWith('/ride')) ||
          (item.flow === 'food' && pathname.startsWith('/food')) ||
          (item.href === '/history' && pathname === '/history');

        const tone = active ? 'bg-canvas-soft text-primary-dark' : 'text-body';

        // Nhan chu — an khi thu gon, nhung `title` van giu de van dung duoc.
        const body = (
          <>
            <Icon name={item.icon} />
            {collapsed ? null : <span className="t-body-md-strong truncate">{item.label}</span>}
          </>
        );

        // Muc "Hoat dong" — link that o moi man.
        if (item.href === '/history') {
          return (
            <Link
              key={item.label}
              href={item.href}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className={`${rowBase} ${tone} hover:bg-canvas-soft`}
            >
              {body}
            </Link>
          );
        }

        // Hai muc luong — chi song o man home.
        if (item.flow && isHome) {
          return (
            <button
              key={item.label}
              type="button"
              title={item.label}
              aria-label={item.label}
              onClick={() => chooseFlow(item.flow!, item.href!)}
              className={`${rowBase} ${tone} hover:bg-canvas-soft`}
            >
              {body}
            </button>
          );
        }

        // Con lai: trang tri thuan tuy.
        return (
          <span key={item.label} aria-hidden="true" title={item.label} className={`${rowBase} ${tone}`}>
            {body}
          </span>
        );
      })}

      <button
        type="button"
        onClick={toggle}
        title={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
        aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
        aria-expanded={!collapsed}
        className={`${rowBase} mt-auto text-mute hover:bg-canvas-soft`}
      >
        <Icon name="collapse" className={collapsed ? 'rotate-180' : ''} />
        {collapsed ? null : <span className="t-body-sm">Thu gọn menu</span>}
      </button>
    </nav>
  );
}
