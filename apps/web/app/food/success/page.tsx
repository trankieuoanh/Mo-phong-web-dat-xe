'use client';

/**
 * screen_name: `food_success` — step 7
 * Event: screen_view, back_to_home.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { calcFoodTotals, getFoodItem, getOffer } from '@gsm/shared';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenShell } from '@/components/ScreenShell';
import { useApp } from '@/lib/app-context';
import { formatVnd } from '@/lib/format';
import { trackEvent, useScreenView } from '@/lib/track';

export default function FoodSuccessPage() {
  useScreenView('food_success');
  const router = useRouter();
  const { cart, offerId, hydrated, clearCart, resetAll } = useApp();

  // Chup tom tat truoc khi xoa gio — neu khong, man hinh trong rong ngay
  // sau khi clearCart() chay.
  const [summary, setSummary] = useState<{ itemCount: number; total: string } | null>(null);

  useEffect(() => {
    if (!hydrated || summary) return;

    const offer = offerId ? (getOffer(offerId) ?? null) : null;
    const totals = calcFoodTotals(cart, offer, getFoodItem);
    setSummary({ itemCount: totals.itemCount, total: formatVnd(totals.finalTotal) });

    // Clear `cart` + `offerId` sau place_order — screen-map.md muc 3.
    clearCart();
  }, [hydrated, cart, offerId, summary, clearCart]);

  function backToHome() {
    trackEvent({ eventName: 'back_to_home', screenName: 'food_success' });
    resetAll();
    router.replace('/');
  }

  return (
    <ScreenShell
      title="Đặt đơn thành công"
      footer={<PrimaryButton onClick={backToHome}>Về trang chủ</PrimaryButton>}
    >
      <div className="flex flex-col items-center py-3xl">
        <div className="grid size-16 place-items-center rounded-full bg-primary text-on-primary">
          <span className="t-display-md" aria-hidden="true">
            ✓
          </span>
        </div>
        <h2 className="t-display-md mt-lg text-center">Đặt đơn thành công</h2>
      </div>

      <div className="rounded-xl bg-canvas-soft p-2xl">
        <Row label="Số món" value={summary ? `${summary.itemCount} món` : '—'} />
        <Row label="Tổng thanh toán" value={summary?.total ?? '—'} />
      </div>
    </ScreenShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-xs">
      <span className="t-body-sm text-body">{label}</span>
      <span className="t-body-md-strong">{value}</span>
    </div>
  );
}
