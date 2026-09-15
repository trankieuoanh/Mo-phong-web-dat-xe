'use client';

/**
 * screen_name: `ride_confirm` — step 5
 * Event: screen_view, confirm_ride, back.
 *
 * `confirm_ride` la EVENT KET THUC FUNNEL RIDE — session co event nay = hoan thanh.
 * Session khong co no = bo do, diem bo do = max(step_index).
 */

import { useRouter } from 'next/navigation';
import { calcRideTotals, getAddress, getPromo, getVehicle } from '@gsm/shared';
import { BackButton } from '@/components/BackButton';
import { FlowGuard } from '@/components/FlowGuard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenShell } from '@/components/ScreenShell';
import { useApp } from '@/lib/app-context';
import { formatVnd } from '@/lib/format';
import { trackEvent, useScreenView } from '@/lib/track';

export default function RideConfirmPage() {
  const { ride } = useApp();
  return (
    <FlowGuard
      ready={Boolean(ride.addressId && ride.vehicleId && ride.promoId !== undefined)}
      fallback="/ride/address"
    >
      <RideConfirmContent />
    </FlowGuard>
  );
}

function RideConfirmContent() {
  useScreenView('ride_confirm');
  const router = useRouter();
  const { ride } = useApp();

  const address = getAddress(ride.addressId!);
  const vehicle = getVehicle(ride.vehicleId!);
  const promo = ride.promoId ? (getPromo(ride.promoId) ?? null) : null;

  // Cung mot ham voi luc ghi event — man hinh va du lieu KHONG THE lech nhau.
  const totals = calcRideTotals(vehicle?.basePrice ?? 0, promo);

  function confirmRide() {
    trackEvent({
      eventName: 'confirm_ride',
      screenName: 'ride_confirm',
      properties: {
        address_id: ride.addressId,
        vehicle_id: ride.vehicleId,
        vehicle_type: vehicle?.type,
        promo_id: ride.promoId ?? null,
        base_price: totals.basePrice,
        discount_amount: totals.discountAmount,
        final_price: totals.finalPrice,
      },
    });
    // KHONG await truoc khi dieu huong — trackEvent tra void, keepalive lo phan con lai.
    router.push('/ride/success');
  }

  return (
    <ScreenShell
      title="Xác nhận chuyến đi"
      leading={<BackButton from="ride_confirm" to="promo_selection" href="/ride/promo" />}
      footer={<PrimaryButton onClick={confirmRide}>Xác nhận đặt xe</PrimaryButton>}
    >
      <div className="rounded-xl bg-canvas p-2xl">
        <Row label="Điểm đón" value={address?.label ?? '—'} />
        <Row label="Loại xe" value={vehicle?.name ?? '—'} />
        <Row label="Giá chuyến" value={formatVnd(totals.basePrice)} />
        <Row
          label="Khuyến mãi"
          value={promo ? `− ${formatVnd(totals.discountAmount)}` : 'Không áp dụng'}
        />

        <div className="mt-lg flex items-center justify-between border-t border-surface-pressed pt-lg">
          <span className="t-body-md-strong">Tổng cộng</span>
          <span className="t-display-sm">{formatVnd(totals.finalPrice)}</span>
        </div>
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
