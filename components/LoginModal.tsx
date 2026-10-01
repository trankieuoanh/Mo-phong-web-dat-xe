'use client';

/**
 * Hop thoai dang nhap — hien khi nguoi dung bam "Dat xe" / "Dat don" ma chua dang
 * nhap (`requireLogin` trong lib/app-context.tsx). Nam TREN man hinh xac nhan:
 * khong dieu huong, nen draft, ban do va `previous_screen` giu nguyen.
 *
 * NGOAI FUNNEL: khong ban event (CLAUDE.md quy tac 9).
 */

import { useEffect } from 'react';
import { GsmLogo } from '@/components/GsmLogo';
import { Icon } from '@/components/Icon';
import { LoginForm } from '@/components/LoginForm';

interface LoginModalProps {
  onClose: () => void;
  onSuccess: (phone: string) => void;
}

export function LoginModal({ onClose, onSuccess }: LoginModalProps) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-lg"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Đăng nhập"
        className="shadow-level-2 relative w-full max-w-[420px] rounded-xl bg-canvas p-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="absolute top-lg right-lg grid size-10 place-items-center rounded-full text-body hover:bg-canvas-soft"
        >
          <Icon name="close" size={20} />
        </button>
        <GsmLogo variant="full" size={32} className="text-primary-dark" />
        <div className="mt-2xl">
          <LoginForm onSuccess={onSuccess} />
        </div>
      </div>
    </div>
  );
}
