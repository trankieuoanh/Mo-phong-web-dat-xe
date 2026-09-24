'use client';

/**
 * screen_name: `food_success` — step 7
 * Event: screen_view, back_to_home.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { calcFoodTotals, getFoodItem, getOffer } from '@/lib/shared';
import { Icon } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenShell } from '@/components/ScreenShell';
import { Skeleton } from '@/components/Skeleton';
import { SummaryRow } from '@/components/SummaryRow';
import { useApp } from '@/lib/app-context';
import { formatVnd } from '@/lib/format';
import { trackEvent, useScreenView } from '@/lib/track';

interface OrderSummary {
  itemCount: number;
  total: string;
  /** Ma don. Suy tu session_id chu KHONG random: mot gia tri random sinh luc
      render se khac nhau giua server va client va gay hydration mismatch. */
  code: string;
}

export default function FoodSuccessPage() {
  useScreenView('food_success');
  const router = useRouter();
  const { cart, offerId, hydrated, sessionId, clearCart, resetAll } = useApp();

  // Chup tom tat truoc khi xoa gio — neu khong, man hinh trong rong ngay
  // sau khi clearCart() chay.
  const [summary, setSummary] = useState<OrderSummary | null>(null);

  useEffect(() => {
    if (!hydrated || summary) return;

    const offer = offerId ? (getOffer(offerId) ?? null) : null;
    const totals = calcFoodTotals(cart, offer, getFoodItem);
    setSummary({
      itemCount: totals.itemCount,
      total: formatVnd(totals.finalTotal),
      code: `GSM-${sessionId.replace(/-/g, '').slice(0, 6).toUpperCase()}`,
    });

    // Clear `cart` + `offerId` sau place_order — screen-map.md muc 3.
    clearCart();
  }, [hydrated, cart, offerId, sessionId, summary, clearCart]);

  function backToHome() {
    trackEvent({ eventName: 'back_to_home', screenName: 'food_success' });
    resetAll();
    router.replace('/');
  }

  return (
    <ScreenShell
      variant="wide"
      section="Đặt đồ ăn"
      tabs={['Đặt món', 'Đang diễn ra', 'Đơn đã lưu']}
      maxWidth="max-w-[760px]"
      // KHONG truyen `title` — xem ghi chu cung cho o app/ride/success/page.tsx.
      footer={
        <div className="w-full min-w-0 pb-[env(safe-area-inset-bottom,0px)] lg:pb-0">
          <PrimaryButton className="w-full min-w-0 whitespace-normal" onClick={backToHome}>
            Về trang chủ
          </PrimaryButton>
        </div>
      }
    >
      <div className="flex flex-col items-center py-3xl">
        {/* `primary-dark` chu KHONG phai `primary`: trang tren #00B4B8 chi dat
            2.6:1, duoi chuan AA (tailwind-theme.md muc 0b). */}
        <div className="grid size-20 place-items-center rounded-full bg-primary-dark text-on-primary">
          <Icon name="check" size={40} />
        </div>
        <h1 className="t-display-md mt-lg text-center">Đặt đơn thành công</h1>
        <p className="t-body-sm mt-xxs text-center text-body">
          Đơn của bạn đang được nhà hàng chuẩn bị
        </p>
      </div>

      <div className="rounded-xl bg-canvas-soft p-lg sm:p-2xl [&>*]:flex-wrap [&>*]:gap-sm [&>*>span]:min-w-0 [&>*>span:last-child]:text-right">
        {/* Trong luc `summary` con null thi day la SKELETON, khong phai chuoi
            '—' tran — mot dau gach ngang trong nhu du lieu that va bi bo trong. */}
        {summary ? (
          <>
            <SummaryRow label="Mã đơn" value={summary.code} />
            <SummaryRow label="Số món" value={`${summary.itemCount} món`} />
            <SummaryRow label="Dự kiến giao" value="25–35 phút" />
            <SummaryRow label="Tổng thanh toán" value={summary.total} emphasis />
          </>
        ) : (
          <div className="flex flex-col gap-sm">
            <Skeleton count={3} className="h-5 w-full" />
            <Skeleton className="h-8 w-1/2" />
          </div>
        )}
      </div>
    </ScreenShell>
  );
}
