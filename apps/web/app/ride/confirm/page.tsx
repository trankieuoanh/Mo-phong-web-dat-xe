'use client';

/**
 * screen_name: `ride_confirm` — step 5
 * Event: screen_view, confirm_ride, back.
 *
 * `confirm_ride` la EVENT KET THUC FUNNEL RIDE — session co event nay = hoan thanh.
 * Session khong co no = bo do, diem bo do = max(step_index).
 *
 * Giao dien theo ride-flow-design.md muc 3 "Man 5": dung LAI khung cua man 3
 * (ban do + sheet) de nguoi dung thay van la mot man, chi khac noi dung.
 */

import { useRouter } from 'next/navigation';
import { FIXED_PICKUP, calcRideTotals, getAddress, getPromo, getVehicle } from '@gsm/shared';
import { BackButton } from '@/components/BackButton';
import { FlowGuard } from '@/components/FlowGuard';
import { MapCanvas } from '@/components/MapCanvas';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenShell } from '@/components/ScreenShell';
import { useApp, type PaymentMethod } from '@/lib/app-context';
import { formatVnd } from '@/lib/format';
import { trackEvent, useScreenView } from '@/lib/track';

const PAYMENTS: { id: PaymentMethod; label: string }[] = [
  { id: 'cash', label: '💵 Tiền mặt' },
  { id: 'qr', label: '📱 QR' },
];

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
  const { ride, setRide } = useApp();

  const address = getAddress(ride.addressId!);
  const vehicle = getVehicle(ride.vehicleId!);
  const promo = ride.promoId ? (getPromo(ride.promoId) ?? null) : null;
  const paymentMethod = ride.paymentMethod ?? 'cash';

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
        payment_method: paymentMethod,
      },
    });
    // KHONG await truoc khi dieu huong — trackEvent tra void, keepalive lo phan con lai.
    router.push('/ride/success');
  }

  return (
    <ScreenShell
      title="Xác nhận chuyến đi"
      leading={<BackButton from="ride_confirm" to="promo_selection" href="/ride/promo" />}
      footer={<PrimaryButton onClick={confirmRide}>Đặt xe</PrimaryButton>}
    >
      <div className="mb-lg">
        <MapCanvas variant="route" />
      </div>

      {/* card-content — tailwind-theme.md muc 4 */}
      <div className="rounded-xl bg-canvas p-2xl">
        <Row label="Điểm đón" value={FIXED_PICKUP.label} />
        <Row label="Điểm đến" value={address?.label ?? '—'} />
        <Row label="Loại xe" value={vehicle?.name ?? '—'} />
        <Row label="Giá chuyến" value={formatVnd(totals.basePrice)} />

        <div className="mt-md">
          {promo ? (
            <span className="t-body-sm-strong inline-block rounded-pill bg-primary-dark px-lg py-sm text-on-primary">
              {promo.title} · −{formatVnd(totals.discountAmount)}
            </span>
          ) : (
            <span className="t-body-sm-strong inline-block rounded-pill bg-canvas-soft px-lg py-sm text-body">
              Không áp dụng ưu đãi
            </span>
          )}
        </div>

        <p className="t-caption mt-lg text-mute">Phương thức thanh toán</p>
        <div className="mt-xs flex gap-sm">
          {PAYMENTS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setRide({ paymentMethod: id })}
              className={`t-body-sm-strong rounded-pill bg-canvas-soft px-lg py-sm text-ink active:bg-surface-pressed ${
                id === paymentMethod ? 'ring-2 ring-primary' : ''
              }`}
            >
              {label}
            </button>
          ))}
        </div>

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
