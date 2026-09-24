'use client';

/**
 * Chip nguoi dung goc phai top bar — theo sample_ui/homepage.png.
 *
 * TRANG TRI HOAN TOAN. Du an nay khong co authentication — day la quyet dinh
 * co chu y, khong phai thieu sot (api-endpoints.md muc "Ve viec khong co
 * authentication"): app chay local de demo, `user_id` la gia tri mock.
 *
 * Vi vay khong co "Dang nhap"/"Dang xuat": mot man dang nhap gia chi them mot
 * duong di lac ma khong do them duoc gi. Dropdown mo ra de trong khung hinh
 * giong web that, khong muc nao lam gi ca.
 *
 * `user_id` that hien o day de demo cho mentor de: no chinh la khoa ma man
 * /history dung de tra lich su.
 */

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { useApp } from '@/lib/app-context';

/** Ten nguoi dung gia lap — khong lay tu dau ca, chi de khung hinh giong that. */
const DISPLAY_NAME = 'Trần Thị Kiều Oanh';
const INITIALS = 'Tr';

export function UserMenu() {
  const { userId } = useApp();
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
          {INITIALS}
        </span>
        <span className="t-body-md hidden lg:inline">{DISPLAY_NAME}</span>
        <Icon name="chevron-down" size={18} className="text-body" />
      </button>

      {open ? (
        // shadow-level-2 — lop noi tren noi dung, xem tailwind-theme.md muc 5.
        <div
          aria-hidden="true"
          className="shadow-level-2 absolute top-full right-0 z-20 mt-sm w-72 overflow-hidden rounded-xl bg-canvas p-lg"
        >
          <p className="t-body-md-strong">{DISPLAY_NAME}</p>
          <p className="t-caption mt-xxs text-mute">Người dùng mô phỏng</p>

          <p className="t-caption mt-md text-mute">user_id</p>
          <p className="t-caption break-all text-body">{userId || '—'}</p>

          <p className="t-caption mt-md text-mute">
            Bản mô phỏng không có đăng nhập — xem api-endpoints.md.
          </p>
        </div>
      ) : null}
    </div>
  );
}
