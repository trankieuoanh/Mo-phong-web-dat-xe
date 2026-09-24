'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/Icon';

interface MenuItem {
  href: string;
  label: string;
  icon: IconName;
}

const ITEMS: MenuItem[] = [
  { href: '/history', label: 'Hoạt động', icon: 'clock' },
  { href: '/account', label: 'Tài khoản phụ', icon: 'users' },
  { href: '/support', label: 'Trung tâm hỗ trợ', icon: 'headset' },
  { href: '/terms', label: 'Điều khoản & Chính sách', icon: 'doc' },
];

export function MobileMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-controls="mobile-more-menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className="t-body-sm-strong flex min-h-11 items-center gap-xs rounded-pill bg-canvas-soft px-md text-ink transition-colors hover:bg-surface-pressed"
      >
        <Icon name="dots" size={20} />
        Menu
      </button>

      {open ? (
        <div
          id="mobile-more-menu"
          role="menu"
          aria-label="Menu phụ"
          className="shadow-level-2 absolute top-full right-0 z-30 mt-sm w-64 overflow-hidden rounded-xl border border-surface-pressed bg-canvas p-sm"
        >
          {ITEMS.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                aria-current={active ? 'page' : undefined}
                onClick={() => setOpen(false)}
                className={`t-body-md-strong flex min-h-12 items-center gap-md rounded-pill px-md transition-colors ${
                  active
                    ? 'bg-canvas-soft text-primary-dark'
                    : 'text-ink hover:bg-canvas-soft'
                }`}
              >
                <Icon name={item.icon} size={20} />
                <span className="min-w-0 flex-1">{item.label}</span>
                {active ? <Icon name="check" size={18} /> : null}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
