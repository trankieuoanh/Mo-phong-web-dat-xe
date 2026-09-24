'use client';

/**
 * screen_name: `ride_success` — step 7
 * Event: screen_view, back_to_home.
 *
 * Route that, khong phai toast/modal — de funnel co moc ket thuc ro rang.
 * Khong co man loi/that bai: app mo phong LUON thanh cong.
 * Hien thi thong tin tai xe tu ride.driverInfo.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DEFAULT_PICKUP, calcFare, calcRideTotals, getPromo, getVehicle } from '@/lib/shared';
import { Icon } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenShell } from '@/components/ScreenShell';
import { useApp } from '@/lib/app-context';
import { routeOrFallback } from '@/lib/use-route';
import { formatVnd } from '@/lib/format';
import { trackEvent, useScreenView } from '@/lib/track';

export default function RideSuccessPage() {
  useScreenView('ride_success');
  const router = useRouter();
  const { ride, hydrated, clearRide, resetAll } = useApp();

  // Chup lai tom tat TRUOC khi xoa draft — neu doc truc tiep tu `ride` thi
  // man hinh se trong rong ngay sau khi clearRide() chay.
  const [summary, setSummary] = useState<{
    pickup: string;
    destination: string;
    vehicle: string;
    distance: string;
    total: string;
    driverName?: string;
    driverPhone?: string;
    driverPlate?: string;
    driverEta?: number;
  } | null>(null);

  useEffect(() => {
    if (!hydrated || summary) return;

    const vehicle = getVehicle(ride.vehicleId ?? '');
    const promo = ride.promoId ? (getPromo(ride.promoId) ?? null) : null;

    // CUNG `routeOrFallback` voi vehicle/promo/confirm. Truoc day man nay suy
    // bien ve 0 km khi thieu `route`, trong khi ba man kia suy bien ve duong
    // thang — tong tien o day thanh ra THAP HON so vua ghi vao `confirm_ride`
    // (calcFare voi 0 km van tra dung gia mo cua, nen con so sai trong rat
    // hop ly). pricing.ts muc dau: hai cho BAT BUOC ra cung mot con so.
    //
    // Man nay khong co FlowGuard nen `destination` co the vang — khi do khong
    // co gi de tinh va moi dong hien '—'.
    const route = ride.destination
      ? routeOrFallback(ride.pickup ?? DEFAULT_PICKUP, ride.destination, ride.route)
      : null;
    const totals = calcRideTotals(vehicle && route ? calcFare(vehicle, route.distanceKm) : 0, promo);

    setSummary({
      pickup: ride.pickup?.label ?? '—',
      destination: ride.destination?.label ?? '—',
      vehicle: vehicle?.name ?? '—',
      distance: route ? `${route.distanceKm} km · ${route.durationMin} phút` : '—',
      total: route ? formatVnd(totals.finalPrice) : '—',
      driverName: ride.driverInfo?.name,
      driverPhone: ride.driverInfo?.phone,
      driverPlate: ride.driverInfo?.plate,
      driverEta: ride.driverInfo?.etaMin,
    });

    // Clear `ride` sau confirm_ride — screen-map.md muc 3.
    clearRide();
  }, [hydrated, ride, summary, clearRide]);

  function backToHome() {
    trackEvent({ eventName: 'back_to_home', screenName: 'ride_success' });
    // Session moi: 1 session = dung 1 lan di qua funnel.
    resetAll();
    // `replace` chu khong `push` — de Back khong quay nguoc vao man success
    // cua session da dong.
    router.replace('/');
  }

  return (
    <ScreenShell
      variant="wide"
      section="Di chuyển"
      tabs={['Đặt xe', 'Đang diễn ra']}
      maxWidth="max-w-[600px]"
      // KHONG truyen `title`: tieu de that nam trong than panel, canh icon tich.
      // Truyen ca hai thi cau "Dat xe thanh cong" hien HAI LAN lien nhau —
      // Panel chi dung header khi co title/leading/trailing (Panel.tsx).
      footer={<PrimaryButton onClick={backToHome}>Về trang chủ</PrimaryButton>}
    >
      <div className="flex flex-col items-center py-3xl">
        {/* `primary-dark` chu KHONG phai `primary`: trang tren #00B4B8 chi dat
            2.6:1, duoi chuan AA (tailwind-theme.md muc 0b). */}
        <div className="grid size-20 place-items-center rounded-full bg-primary-dark text-on-primary">
          <Icon name="check" size={40} />
        </div>
        <h1 className="t-display-md mt-lg text-center">Đặt xe thành công</h1>
        <p className="t-body-sm mt-xxs text-center text-body">
          Tài xế sẽ liên hệ với bạn trong ít phút
        </p>
      </div>

      <div className="rounded-xl bg-canvas-soft p-2xl space-y-lg">
        {summary?.driverName && (
          <div className="flex items-center gap-md p-md rounded-lg bg-primary-soft border border-primary">
            <div className="size-12 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <Icon name="users" size={20} className="text-on-primary" />
            </div>
            <div className="flex-1">
              <h3 className="t-body-md-strong">{summary.driverName}</h3>
              <div className="flex items-center gap-md mt-xs text-sm text-body">
                <span className="flex items-center gap-xs">
                  <Icon name="users" size={14} /> {summary.driverPlate}
                </span>
                <span className="flex items-center gap-xs">
                  <Icon name="phone" size={14} /> {summary.driverPhone}
                </span>
              </div>
              {summary.driverEta && (
                <p className="t-body-sm mt-xs text-primary flex items-center gap-xs">
                  <Icon name="clock" size={14} /> Còn {summary.driverEta} phút đến đón
                </p>
              )}
            </div>
          </div>
        )}

        <Row label="Điểm đón" value={summary?.pickup ?? '—'} />
        <Row label="Điểm đến" value={summary?.destination ?? '—'} />
        <Row label="Loại xe" value={summary?.vehicle ?? '—'} />
        <Row label="Quãng đường" value={summary?.distance ?? '—'} />
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
