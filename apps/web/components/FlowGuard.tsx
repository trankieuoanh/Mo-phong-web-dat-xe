'use client';

/**
 * Bao ve luong. Nguon: screen-map.md muc 1.
 *
 * Vao thang mot URL giua luong ma state rong (vi du mo /ride/confirm khi chua
 * chon xe) -> redirect ve buoc dau cua luong va KHONG BAN EVENT NAO.
 * Muc dich: tranh sinh session rac trong du lieu phan tich.
 *
 * Vi guard chay truoc khi children mount, useScreenView trong children khong
 * kip chay — do la dung y, khong phai tac dung phu.
 */

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useApp } from '@/lib/app-context';

interface FlowGuardProps {
  /** true = du dieu kien o lai man nay. */
  ready: boolean;
  /** Buoc dau cua luong: '/ride/address' hoac '/food'. */
  fallback: string;
  children: ReactNode;
}

export function FlowGuard({ ready, fallback, children }: FlowGuardProps) {
  const router = useRouter();
  const { hydrated } = useApp();

  useEffect(() => {
    // Phai doi hydrated: truoc khi doc xong sessionStorage thi state luon rong,
    // va guard se da moi nguoi dung ra khoi luong ngay sau khi F5.
    if (hydrated && !ready) router.replace(fallback);
  }, [hydrated, ready, fallback, router]);

  if (!hydrated || !ready) return null;
  return <>{children}</>;
}
