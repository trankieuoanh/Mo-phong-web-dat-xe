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
import { Icon } from '@/components/Icon';
import { ScreenShell } from '@/components/ScreenShell';
import { useApp } from '@/lib/app-context';
import { trackEvent, useScreenView } from '@/lib/track';
import { getRandomDriver } from '@gsm/shared';

export default function FindingDriverPage() {
  useScreenView('finding_driver');
  const router = useRouter();
  const { ride, setRide, resetAll, hydrated } = useApp();

  // FlowGuard: can vao khi da confirm_ride (driverStatus = 'searching')
  const canEnter = hydrated && ride.destination && ride.vehicleId && ride.promoId !== undefined && ride.driverStatus === 'searching';

  // Ban driver_searching khi mount (chi khi canEnter)
  useEffect(() => {
    if (!canEnter) return;
    trackEvent({ eventName: 'driver_searching', screenName: 'finding_driver' });
  }, [canEnter]);

  // Vo hieu hoa Back browser — giong app that
  useEffect(() => {
    if (!canEnter) return;
    const blockPopstate = () => {
      history.pushState(null, '');
    };
    history.pushState(null, '');
    window.addEventListener('popstate', blockPopstate);
    return () => window.removeEventListener('popstate', blockPopstate);
  }, [canEnter]);

  // Tu dong tim thay tai xe sau 2-3s
  useEffect(() => {
    if (!canEnter) return;
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
  }, [canEnter, setRide, router]);

  // Redirect neu chua du dieu kien (FlowGuard logic)
  if (!canEnter) {
    return null;
  }

  function handleCancel() {
    // Mirror confirm_ride properties + cancel_reason + cancel_stage
    const pickup = ride.pickup!;
    const destination = ride.destination!;
    const vehicle = ride.vehicleId ? { id: ride.vehicleId } : null;

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
        distance_km: ride.route?.distanceKm ?? 0,
        duration_min: ride.route?.durationMin ?? 0,
        route_source: ride.route?.source ?? 'straight',
        vehicle_id: ride.vehicleId ?? null,
        vehicle_type: vehicle ? 'car' : null,
        promo_id: ride.promoId ?? null,
        base_price: 0,
        discount_amount: 0,
        final_price: 0,
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
          className="t-body-md-strong text-center text-error hover:underline w-full"
        >
          Hủy đơn
        </button>
      }
    >
      <div className="flex flex-col items-center py-4xl">
        <div className="relative">
          <div className="size-24 rounded-full bg-primary-soft flex items-center justify-center">
            <Icon name="car" size={32} className="text-primary" />
          </div>
          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
        <h2 className="t-display-md mt-lg text-center">Đang tìm tài xế...</h2>
        <p className="t-body-md mt-xs text-center text-body">
          Chúng tôi đang tìm tài xế phù hợp cho chuyến đi của bạn
        </p>
        <p className="t-body-sm mt-md text-center text-mute">Thời gian trung bình: 1-2 phút</p>
      </div>
    </ScreenShell>
  );
}