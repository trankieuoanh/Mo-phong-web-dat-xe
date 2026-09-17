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
import { DEFAULT_PICKUP, calcFare, calcRideTotals, getPromo, getVehicle } from '@gsm/shared';
import { BackButton } from '@/components/BackButton';
import { FlowGuard } from '@/components/FlowGuard';
import { Icon, type IconName } from '@/components/Icon';
import { MapCanvas } from '@/components/MapCanvas';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenShell } from '@/components/ScreenShell';
import { useApp, type PaymentMethod } from '@/lib/app-context';
import { routeOrFallback } from '@/lib/use-route';
import { formatVnd } from '@/lib/format';
import { trackEvent, useScreenView } from '@/lib/track';

const PAYMENTS: { id: PaymentMethod; label: string; icon: IconName }[] = [
  { id: 'cash', label: 'Tiền mặt', icon: 'cash' },
  { id: 'qr', label: 'QR', icon: 'qr' },
];

export default function RideConfirmPage() {
  const { ride } = useApp();
  return (
    <FlowGuard
      ready={Boolean(ride.destination && ride.vehicleId && ride.promoId !== undefined)}
      fallback="/"
    >
      <RideConfirmContent />
    </FlowGuard>
  );
}

function RideConfirmContent() {
  useScreenView('ride_confirm');
  const router = useRouter();
  const { ride, setRide } = useApp();

  // FlowGuard da bao dam `destination`; `pickup` luon co nho newRideDraft().
  const destination = ride.destination!;
  const pickup = ride.pickup ?? DEFAULT_PICKUP;
  const vehicle = getVehicle(ride.vehicleId!);
  const promo = ride.promoId ? (getPromo(ride.promoId) ?? null) : null;
  const paymentMethod = ride.paymentMethod ?? 'cash';

  const route = routeOrFallback(pickup, destination, ride.route);

  // Cung mot ham voi luc ghi event — man hinh va du lieu KHONG THE lech nhau.
  const totals = calcRideTotals(vehicle ? calcFare(vehicle, route.distanceKm) : 0, promo);

  function confirmRide() {
    trackEvent({
      eventName: 'confirm_ride',
      screenName: 'ride_confirm',
      properties: {
        address_id: destination.id,
        // Lap lai NHAN o day du `select_address` da co: event nay phai TU MO TA
        // du mot chuyen di, vi man /history dung bang lich su tu rieng cac
        // document `confirm_ride`, khong join nguoc. Va voi dia chi tim duoc thi
        // KHONG CO BANG NAO tra id ra ten (event-taxonomy.md muc `ride_confirm`).
        address_label: destination.label,
        address_source: destination.source,
        pickup_id: pickup.id,
        pickup_label: pickup.label,
        distance_km: route.distanceKm,
        duration_min: route.durationMin,
        // 'osrm' | 'straight' — thieu khoa nay thi mot chuyen 8 km duong that va
        // mot chuyen 8 km duong chim bay trong giong het nhau trong du lieu.
        route_source: route.source,
        vehicle_id: ride.vehicleId,
        // `?? null` chu KHONG de undefined: JSON.stringify xoa han khoa co gia
        // tri undefined, nen document se thieu mot field ma event-taxonomy.md
        // ghi la bat buoc — va `column()` trong metrics.py tra Series rong ma
        // khong bao gi. FlowGuard chi bao dam `vehicleId` khac rong, khong bao
        // dam no tra cuu duoc (id cu trong sessionStorage sau khi doi mock-data).
        vehicle_type: vehicle?.type ?? null,
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
      variant="split"
      section="Di chuyển"
      tabs={['Đặt xe', 'Đang diễn ra']}
      aside={<MapCanvas pickup={pickup} destination={destination} route={route} fill />}
      title="Xác nhận chuyến đi"
      leading={<BackButton from="ride_confirm" to="promo_selection" href="/ride/promo" />}
      footer={<PrimaryButton onClick={confirmRide}>Đặt xe</PrimaryButton>}
    >
      {/* card-soft-tinted — panel da la nen trang nen card dung `canvas-soft`. */}
      <div className="rounded-xl bg-canvas-soft p-2xl">
        <Row label="Điểm đón" value={pickup.label} />
        <Row label="Điểm đến" value={destination.label} />
        <Row label="Loại xe" value={vehicle?.name ?? '—'} />
        <Row
          label="Quãng đường"
          value={`${route.distanceKm} km · ${route.durationMin} phút`}
        />
        <Row label="Giá chuyến" value={formatVnd(totals.basePrice)} />

        <div className="mt-md">
          {promo ? (
            <span className="t-body-sm-strong inline-block rounded-pill bg-primary-dark px-lg py-sm text-on-primary">
              {promo.title} · −{formatVnd(totals.discountAmount)}
            </span>
          ) : (
            <span className="t-body-sm-strong inline-block rounded-pill bg-canvas px-lg py-sm text-body">
              Không áp dụng ưu đãi
            </span>
          )}
        </div>

        <p className="t-caption mt-lg text-mute">Phương thức thanh toán</p>
        <div className="mt-xs flex gap-sm">
          {PAYMENTS.map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setRide({ paymentMethod: id })}
              className={`t-body-sm-strong inline-flex items-center gap-sm rounded-pill bg-canvas px-lg py-sm text-ink transition-colors hover:bg-surface-pressed ${
                id === paymentMethod ? 'ring-2 ring-primary' : ''
              }`}
            >
              <Icon name={icon} size={16} /> {label}
            </button>
          ))}
        </div>

        <div className="mt-lg flex items-center justify-between border-t border-canvas pt-lg">
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
