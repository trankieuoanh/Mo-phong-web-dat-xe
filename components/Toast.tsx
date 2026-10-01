'use client';

/**
 * Bao ngan khi mot hanh dong da xong — truoc het la "da them mon vao gio".
 *
 * VI SAO CAN: bam "+" tren the mon truoc day khong doi gi tren man hinh ca.
 * Nut "Xem gio hang" nam o day panel, ma man menu cuon ca trang, nen no o duoi
 * hang nghin pixel — nguoi dung bam xong khong thay gi va ket luan la app khong
 * co gio hang. Dung la ket luan hop ly voi nhung gi nhin thay duoc.
 *
 * KHONG ban event nao. Day la phan hoi giao dien, khong phai mot buoc funnel.
 */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Icon } from '@/components/Icon';

interface ToastValue {
  /** Hien mot bao ngan. Goi lan nua se thay the cai dang hien. */
  show: (message: string) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

/** Bao tu an sau bao lau. */
const VISIBLE_MS = 2600;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  /** Doi moi lan goi de mot bao moi lam moi bo dem, ke ca khi trung noi dung. */
  const [nonce, setNonce] = useState(0);

  const show = useCallback((next: string) => {
    setMessage(next);
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (message === null) return;
    const timer = setTimeout(() => setMessage(null), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [message, nonce]);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}

      {/*
        `aria-live="polite"` + `role="status"`: nguoi dung trinh doc man hinh
        cung phai biet mon da vao gio. Vung nay LUON nam trong cay DOM du dang
        rong — them vao sau khi da co noi dung thi nhieu trinh doc bo qua.
      */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex w-full justify-center px-lg pb-[max(var(--spacing-3xl),env(safe-area-inset-bottom,0px))]"
      >
        {message ? (
          <div className="shadow-level-2 flex min-w-0 max-w-[calc(100vw-var(--spacing-3xl))] items-center gap-md rounded-pill bg-ink px-2xl py-md text-on-dark">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-dark">
              <Icon name="check" size={14} />
            </span>
            <span className="t-body-sm-strong min-w-0 break-words">{message}</span>
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  const ctx = useContext(ToastContext);
  // Khong nem loi khi thieu Provider: mot bao ngan khong xuat hien la phien
  // toai, con mot man hinh trang vi thieu context thi la hong.
  return ctx ?? { show: () => {} };
}
