'use client';

/**
 * Chip nguoi dung goc phai top bar — theo sample_ui/homepage.png.
 *
 * Da dang nhap: hien so dien thoai (chinh la `user_id` cua moi event, va la khoa ma
 * man /history dung de tra lich su) + nut "Dang xuat".
 * Khach: nut "Dang nhap" mo LoginModal — khong ep dang nhap truoc khi dat.
 */

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useApp } from '@/lib/app-context';
import { formatVnPhone } from '@/lib/shared';

export function UserMenu() {
  const { userId, isAuthed, signOut, requireLogin } = useApp();
  const displayPhone = userId.startsWith('+84') ? formatVnPhone(userId) : '—';
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Dong menu khi bam ra ngoai.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  if (!isAuthed) {
    return (
      <div className="ml-auto shrink-0">
        <PrimaryButton
          variant="secondary"
          fullWidth={false}
          className="min-h-11 py-sm"
          onClick={() => requireLogin(() => {})}
        >
          Đăng nhập
        </PrimaryButton>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative ml-auto shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-md rounded-pill py-xs pr-md pl-xs text-ink hover:bg-canvas-soft"
      >
        <span className="t-body-sm-strong grid size-9 place-items-center rounded-full bg-canvas-soft text-primary-dark">
          <Icon name="phone" size={18} />
        </span>
        <span className="t-body-md hidden lg:inline">{displayPhone}</span>
        <Icon name="chevron-down" size={18} className="text-body" />
      </button>

      {open ? (
        // shadow-level-2 — lop noi tren noi dung, xem tailwind-theme.md muc 5.
        <div
          role="menu"
          className="shadow-level-2 absolute top-full right-0 z-20 mt-sm w-72 overflow-hidden rounded-xl bg-canvas p-lg"
        >
          <p className="t-body-md-strong">{displayPhone}</p>
          <p className="t-caption mt-xxs text-mute">Tài khoản đăng nhập bằng số điện thoại</p>

          <p className="t-caption mt-md text-mute">user_id</p>
          <p className="t-caption break-all text-body">{userId || '—'}</p>

          <PrimaryButton
            variant="secondary"
            role="menuitem"
            className="mt-lg"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
          >
            Đăng xuất
          </PrimaryButton>
        </div>
      ) : null}
    </div>
  );
}
