'use client';

/**
 * screen_name: `food_success` — step 7
 * Event: screen_view, back_to_home.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { calcFoodTotals, getFoodItem, getOffer, type Place } from '@/lib/shared';
import { MapCanvas } from '@/components/MapCanvas';
import { useRoute } from '@/lib/use-route';
import { simulationDurationMs, useVehicleSimulation } from '@/lib/use-vehicle-simulation';
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
  const { cart, offerId, food, hydrated, sessionId, clearCart, resetAll } = useApp();

  // Chup tom tat truoc khi xoa gio — neu khong, man hinh trong rong ngay
  // sau khi clearCart() chay.
  const [summary, setSummary] = useState<OrderSummary | null>(null);

  // Quan + dia chi giao de mo phong xe giao hang: chup TRUOC clearCart() (xoa ca `food`). Tuyen lay lai
  // bang useRoute — CUNG cap toa do voi man xac nhan nen trung cache module, KHONG goi them OSRM.
  const [delivery, setDelivery] = useState<{ restaurant: Place; destination: Place } | null>(null);
  const { route, status: routeStatus, retry: retryRoute } = useRoute(delivery?.restaurant, delivery?.destination);
  const sim = useVehicleSimulation(route?.geometry ?? null, route ? simulationDurationMs(route.durationMin) : 0);

  useEffect(() => {
    if (!hydrated || summary) return;

    const offer = offerId ? (getOffer(offerId) ?? null) : null;
    const totals = calcFoodTotals(cart, offer, getFoodItem);
    if (food.restaurantPlace && food.origin) {
      setDelivery({ restaurant: food.restaurantPlace, destination: food.origin });
    }
    setSummary({
      itemCount: totals.itemCount,
      total: formatVnd(totals.finalTotal),
      code: `GSM-${sessionId.replace(/-/g, '').slice(0, 6).toUpperCase()}`,
    });

    // Clear `cart` + `offerId` sau place_order — screen-map.md muc 3.
    clearCart();
  }, [hydrated, cart, offerId, food, sessionId, summary, clearCart]);

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

      {delivery ? (
        <div className="mb-lg">
          <p className="t-body-sm-strong mb-sm text-center" aria-live="polite">
            {route
              ? sim.status === 'arrived'
                ? 'Đơn hàng đã đến nơi'
                : `Đang giao hàng · còn khoảng ${Math.max(1, Math.ceil((1 - sim.progress) * route.durationMin))} phút`
              : routeStatus === 'error'
                ? 'Chưa có tuyến giao hàng'
                : 'Đang tính tuyến giao hàng…'}
          </p>
          <MapCanvas
            pickup={delivery.restaurant}
            destination={delivery.destination}
            route={route}
            routeStatus={routeStatus}
            onRetry={retryRoute}
            vehicle={sim.position}
            originKind="restaurant"
          />
          <p className="t-caption mt-xs text-center text-mute">Mô phỏng hành trình — không phải vị trí thật của người giao.</p>
        </div>
      ) : null}

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
