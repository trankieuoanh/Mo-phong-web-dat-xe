'use client';

/**
 * Form dang nhap hai buoc: nhap SDT -> nhap ma 6 so. Dung chung cho trang /login
 * va `LoginModal` (hien khi bam "Dat xe" / "Dat don" ma chua dang nhap).
 *
 * NGOAI FUNNEL: khong `useScreenView`, khong `trackEvent` (CLAUDE.md quy tac 9) —
 * mot buoc dang nhap ban event se lam ban moi ti le conversion.
 *
 * Khi SMS_PROVIDER=mock server tra kem `dev_code` va form nay hien no ra.
 */

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { PrimaryButton } from '@/components/PrimaryButton';
import { formatVnPhone, normalizeVnPhone } from '@/lib/shared';

const RESEND_SECONDS = 60;

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { res, data };
}

interface LoginFormProps {
  /** Goi SAU KHI cookie da duoc server dat — event ke tiep da co the ghi bang SDT. */
  onSuccess: (phone: string) => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phoneInput, setPhoneInput] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus();
  }, [step]);

  async function requestCode(target: string) {
    setBusy(true);
    setError('');
    try {
      const { res, data } = await postJson('/api/auth/send-code', { phone: target });
      if (res.status === 429) {
        setCooldown(Number(data.retry_after) || RESEND_SECONDS);
        setError(String(data.error));
        // Ma cu van con hieu luc — van cho nhap.
        setPhone(target);
        setStep('code');
        return;
      }
      if (!res.ok) {
        setError(String(data.error ?? 'Không gửi được mã, thử lại sau'));
        return;
      }
      setPhone(target);
      setDevCode(typeof data.dev_code === 'string' ? data.dev_code : null);
      setCode('');
      setCooldown(RESEND_SECONDS);
      setStep('code');
    } catch {
      setError('Mất kết nối, thử lại sau');
    } finally {
      setBusy(false);
    }
  }

  function onSubmitPhone(e: FormEvent) {
    e.preventDefault();
    const normalized = normalizeVnPhone(phoneInput);
    if (!normalized) {
      setError('Số điện thoại không hợp lệ (vd. 0912 345 678)');
      return;
    }
    void requestCode(normalized);
  }

  async function onSubmitCode(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError('Mã xác thực gồm 6 chữ số');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { res, data } = await postJson('/api/auth/verify', { phone, code });
      if (!res.ok) {
        setError(String(data.error ?? 'Mã xác thực không đúng'));
        return;
      }
      onSuccess(phone);
    } catch {
      setError('Mất kết nối, thử lại sau');
    } finally {
      setBusy(false);
    }
  }

  if (step === 'phone') {
    return (
      <form onSubmit={onSubmitPhone} className="flex flex-col gap-lg">
        <div>
          <h1 className="t-display-sm text-ink">Đăng nhập</h1>
          <p className="t-body-md mt-xs text-body">
            Nhập số điện thoại để nhận mã xác thực gồm 6 chữ số.
          </p>
        </div>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          autoFocus
          value={phoneInput}
          onChange={(e) => {
            setPhoneInput(e.target.value);
            setError('');
          }}
          placeholder="0912 345 678"
          aria-label="Số điện thoại"
          className="t-body-md w-full rounded-md bg-canvas-soft p-lg text-ink outline-none placeholder:text-mute"
        />
        {error ? <p className="t-caption text-body">{error}</p> : null}
        <PrimaryButton type="submit" disabled={busy || phoneInput.trim() === ''}>
          {busy ? 'Đang gửi…' : 'Gửi mã'}
        </PrimaryButton>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmitCode} className="flex flex-col gap-lg">
      <div>
        <h1 className="t-display-sm text-ink">Nhập mã xác thực</h1>
        <p className="t-body-md mt-xs text-body">
          Mã đã được gửi tới <span className="t-body-md-strong">{formatVnPhone(phone)}</span>
        </p>
      </div>

      {devCode ? (
        <p className="t-body-sm rounded-md bg-canvas-soft p-md text-body">
          Chế độ SMS giả lập — mã của bạn:{' '}
          <span className="t-body-sm-strong text-primary-dark">{devCode}</span>
        </p>
      ) : null}

      <input
        ref={codeRef}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(e) => {
          setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
          setError('');
        }}
        placeholder="••••••"
        aria-label="Mã xác thực 6 chữ số"
        className="t-display-sm w-full rounded-md bg-canvas-soft p-lg text-center text-ink outline-none placeholder:text-mute"
      />
      {error ? <p className="t-caption text-body">{error}</p> : null}

      <PrimaryButton type="submit" disabled={busy || code.length !== 6}>
        {busy ? 'Đang kiểm tra…' : 'Xác nhận'}
      </PrimaryButton>

      <div className="flex items-center justify-between">
        <button
          type="button"
          className="t-body-sm text-body hover:text-ink"
          onClick={() => {
            setStep('phone');
            setError('');
            setDevCode(null);
          }}
        >
          Đổi số điện thoại
        </button>
        <button
          type="button"
          disabled={busy || cooldown > 0}
          className="t-body-sm-strong text-primary-dark disabled:text-mute"
          onClick={() => void requestCode(phone)}
        >
          {cooldown > 0 ? `Gửi lại mã (${cooldown}s)` : 'Gửi lại mã'}
        </button>
      </div>
    </form>
  );
}
