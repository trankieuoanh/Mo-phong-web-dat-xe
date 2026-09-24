'use client';

/**
 * screen_name: `finding_driver` — step 6
 * Event: screen_view, driver_searching, driver_assigned, cancel_ride.
 *
 * Man hinh "Dang tim tai xe". Tu dong tim thay tai xe sau 2-3s (random).
 * Vo hieu hoa Back browser — giong app that.
 * Co nut "Huy don" (do).
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FlowGuard } from '@/components/FlowGuard';
import { Icon } from '@/components/Icon';
import { ScreenShell } from '@/components/ScreenShell';
import { useApp } from '@/lib/app-context';
import { routeOrFallback } from '@/lib/use-route';
import { trackEvent, useScreenView } from '@/lib/track';
import {
  DEFAULT_PICKUP,
  calcFare,
  calcRideTotals,
  getPromo,
  getRandomDriver,
  getVehicle,
} from '@/lib/shared';

export default function FindingDriverPage() {
  const { ride, hydrated } = useApp();
  const canEnter = Boolean(
    hydrated &&
      ride.destination &&
      ride.vehicleId &&
      ride.promoId !== undefined &&
      ride.driverStatus === 'searching',
  );

  return (
    <FlowGuard ready={canEnter} fallback="/ride/address">
      <FindingDriverContent />
    </FlowGuard>
  );
}

function FindingDriverContent() {
  useScreenView('finding_driver');
  const router = useRouter();
  const { ride, setRide, resetAll } = useApp();

  // Ban driver_searching khi mount (chi khi canEnter)
  useEffect(() => {
    trackEvent({ eventName: 'driver_searching', screenName: 'finding_driver' });
  }, []);

  // Vo hieu hoa Back browser — giong app that
  useEffect(() => {
    const blockPopstate = () => {
      history.pushState(null, '');
    };
    history.pushState(null, '');
    window.addEventListener('popstate', blockPopstate);
    return () => window.removeEventListener('popstate', blockPopstate);
  }, []);

  // Tu dong tim thay tai xe sau 2-3s
  useEffect(() => {
    const timer = setTimeout(() => {
      const driver = getRandomDriver();
      const etaMin = Math.floor(Math.random() * 6) + 3; // 3-8 phut

      setRide({
        driverStatus: 'assigned',
        driverInfo: {
          id: driver.id,
          name: driver.name,
          phone: driver.phone,
          plate: driver.plate,
          etaMin,
        },
      });

      // Ban driver_assigned o man finding_driver (step 6)
      trackEvent({
        eventName: 'driver_assigned',
        screenName: 'finding_driver',
        properties: {
          driver_id: driver.id,
          driver_name: driver.name,
          driver_phone: driver.phone,
          vehicle_plate: driver.plate,
          eta_min: etaMin,
        },
      });

      router.push('/ride/success');
    }, 2000 + Math.random() * 1000); // 2-3 giay random

    return () => clearTimeout(timer);
  }, [setRide, router]);

  function handleCancel() {
    // `canEnter` o tren da bao dam `destination` va `vehicleId`; `pickup` luon
    // co nho newRideDraft(). Khoi `if (!canEnter) return null` nam TRUOC ham nay.
    const destination = ride.destination!;
    const pickup = ride.pickup ?? DEFAULT_PICKUP;
    const vehicle = getVehicle(ride.vehicleId!);
    const promo = ride.promoId ? (getPromo(ride.promoId) ?? null) : null;

    // DUNG LAI y nguyen chuoi suy dien cua app/ride/confirm/page.tsx. `cancel_ride`
    // mirror toan bo field cua `confirm_ride` (event-taxonomy.md muc finding_driver),
    // nen hai su kien cua CUNG MOT chuyen bat buoc ra cung nhung con so — do la ly do
    // calcFare/calcRideTotals duoc tach ra khoi tung man.
    //
    // Truoc day cho nay ghi cung 0 cho ca ba so tien, va suy `vehicle_type` tu mot
    // object chi co `id` nen luon ra 'car' ke ca voi xe may. Khong man nao doc
    // `cancel_ride` nen loi khong co trieu chung — no chi lam moi chuyen huy dong gop
    // doanh thu 0d va noi 100% chuyen huy la o to.
    const route = routeOrFallback(pickup, destination, ride.route);
    const totals = calcRideTotals(vehicle ? calcFare(vehicle, route.distanceKm) : 0, promo);

    trackEvent({
      eventName: 'cancel_ride',
      screenName: 'finding_driver',
      properties: {
        cancel_reason: 'user_cancelled',
        cancel_stage: 'finding_driver',
        address_id: destination.id,
        address_label: destination.label,
        address_source: destination.source,
        pickup_id: pickup.id,
        pickup_label: pickup.label,
        distance_km: route.distanceKm,
        duration_min: route.durationMin,
        route_source: route.source,
        vehicle_id: ride.vehicleId ?? null,
        vehicle_type: vehicle?.type ?? null,
        promo_id: ride.promoId ?? null,
        base_price: totals.basePrice,
        discount_amount: totals.discountAmount,
        final_price: totals.finalPrice,
        payment_method: ride.paymentMethod ?? 'cash',
      },
    });
    resetAll();
    router.replace('/');
  }

  return (
    <ScreenShell
      variant="wide"
      section="Di chuyển"
      tabs={['Đặt xe', 'Đang diễn ra']}
      maxWidth="max-w-[480px]"
      title="Đang tìm tài xế"
      footer={
        <button
          type="button"
          onClick={handleCancel}
          className="t-body-md-strong inline-flex min-h-12 w-full items-center justify-center rounded-pill px-lg text-center text-body hover:underline"
        >
          Hủy đơn
        </button>
      }
    >
      <div className="flex flex-col items-center py-3xl">
        <div className="relative">
          <div className="flex size-24 items-center justify-center rounded-full bg-canvas-soft">
            <Icon name="car" size={32} className="text-primary-dark" />
          </div>
          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
        <h2 className="t-display-md mt-lg max-w-full break-words text-center">Đang tìm tài xế...</h2>
        <p className="t-body-md mt-xs max-w-full break-words text-center text-body">
          Chúng tôi đang tìm tài xế phù hợp cho chuyến đi của bạn
        </p>
        <p className="t-body-sm mt-md max-w-full break-words text-center text-mute">Thời gian trung bình: 1-2 phút</p>
      </div>
    </ScreenShell>
  );
}