'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { GsmLogo } from '@/components/GsmLogo';
import { Icon, type IconName } from '@/components/Icon';
import type { Flow } from '@/lib/shared';
import { trackSelectFlow, type FlowEntryScreen } from '@/lib/track';
import { activeFlowOf, selectFlowScreenFor } from './flow-nav';

const COLLAPSED_KEY = 'gsm_rail_collapsed';

interface RailItem {
  icon: IconName;
  label: string;
  flow?: Flow;
  href?: string;
}

const ITEMS: RailItem[] = [
  { icon: 'car', label: 'Đặt xe', flow: 'ride', href: '/ride/address' },
  { icon: 'bag', label: 'Đặt đồ ăn', flow: 'food', href: '/food' },
  { icon: 'clock', label: 'Hoạt động', href: '/history' },
  { icon: 'users', label: 'Tài khoản phụ', href: '/account' },
  { icon: 'headset', label: 'Trung tâm hỗ trợ', href: '/support' },
  { icon: 'doc', label: 'Điều khoản & Chính sách', href: '/terms' },
];

export function SideRail() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let storedCollapsed = false;
    try {
      storedCollapsed = localStorage.getItem(COLLAPSED_KEY) === '1';
    } catch {
      storedCollapsed = false;
    }
    setCollapsed(storedCollapsed);
  }, []);

  function toggle() {
    setCollapsed((previous) => {
      const next = !previous;
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        return next;
      }
      return next;
    });
  }

  const activeFlow = activeFlowOf(pathname);

  function chooseFlow(screenName: FlowEntryScreen, flow: Flow, href: string) {
    trackSelectFlow(screenName, flow);
    router.push(href);
  }

  const rowBase = collapsed
    ? 'grid size-11 place-items-center rounded-xl border-l-2 border-transparent transition-colors'
    : 'flex w-full items-center gap-md rounded-xl border-l-2 border-transparent px-md py-md transition-colors';

  return (
    <nav
      aria-label="Điều hướng chính"
      className={`sticky top-0 hidden h-dvh shrink-0 flex-col gap-xxs border-r border-surface-pressed bg-canvas p-lg transition-[width] desktop:flex ${
        collapsed ? 'w-[72px] items-center' : 'w-[264px]'
      }`}
    >
      <span className={`mb-lg flex items-center text-primary-dark ${collapsed ? '' : 'px-md'}`}>
        {collapsed ? <GsmLogo size={28} /> : <GsmLogo variant="full" size={30} />}
      </span>

      {ITEMS.map((item) => {
        const isPlainLink = item.flow === undefined && item.href !== undefined;
        const active =
          (item.flow !== undefined && item.flow === activeFlow) ||
          (isPlainLink && pathname === item.href);
        const tone = active
          ? 'border-primary bg-canvas-soft text-primary-dark'
          : 'text-body';
        const body = (
          <>
            <Icon name={item.icon} />
            {collapsed ? null : <span className="t-body-md-strong truncate">{item.label}</span>}
          </>
        );

        if (isPlainLink) {
          return (
            <Link
              key={item.label}
              href={item.href!}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className={`${rowBase} ${tone} hover:bg-canvas-soft`}
            >
              {body}
            </Link>
          );
        }

        const selectScreen = item.flow
          ? selectFlowScreenFor(pathname, item.flow, item.href!)
          : null;

        if (selectScreen) {
          return (
            <button
              key={item.label}
              type="button"
              title={item.label}
              aria-label={item.label}
              onClick={() => chooseFlow(selectScreen, item.flow!, item.href!)}
              className={`${rowBase} ${tone} hover:bg-canvas-soft`}
            >
              {body}
            </button>
          );
        }

        if (item.flow && active) {
          return (
            <span
              key={item.label}
              aria-current="page"
              title={item.label}
              className={`${rowBase} ${tone}`}
            >
              {body}
            </span>
          );
        }

        return (
          <span
            key={item.label}
            aria-hidden="true"
            title={item.label}
            className={`${rowBase} ${tone}`}
          >
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
