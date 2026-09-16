'use client';

/**
 * screen_name: `ride_success` — step 6
 * Event: screen_view, back_to_home.
 *
 * Route that, khong phai toast/modal — de funnel co moc ket thuc ro rang.
 * Khong co man loi/that bai: app mo phong LUON thanh cong.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { calcRideTotals, getAddress, getPromo, getVehicle } from '@gsm/shared';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenShell } from '@/components/ScreenShell';
import { useApp } from '@/lib/app-context';
import { formatVnd } from '@/lib/format';
import { trackEvent, useScreenView } from '@/lib/track';

export default function RideSuccessPage() {
  useScreenView('ride_success');
  const router = useRouter();
  const { ride, hydrated, clearRide, resetAll } = useApp();

  // Chup lai tom tat TRUOC khi xoa draft — neu doc truc tiep tu `ride` thi
  // man hinh se trong rong ngay sau khi clearRide() chay.
  const [summary, setSummary] = useState<{
    destination: string;
    vehicle: string;
    total: string;
  } | null>(null);

  useEffect(() => {
    if (!hydrated || summary) return;

    const vehicle = getVehicle(ride.vehicleId ?? '');
    const promo = ride.promoId ? (getPromo(ride.promoId) ?? null) : null;
    const totals = calcRideTotals(vehicle?.basePrice ?? 0, promo);

    setSummary({
      destination: getAddress(ride.addressId ?? '')?.label ?? '—',
      vehicle: vehicle?.name ?? '—',
      total: formatVnd(totals.finalPrice),
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
      title="Đặt xe thành công"
      footer={<PrimaryButton onClick={backToHome}>Về trang chủ</PrimaryButton>}
    >
      <div className="flex flex-col items-center py-3xl">
        <div className="grid size-16 place-items-center rounded-full bg-primary text-on-primary">
          <span className="t-display-md" aria-hidden="true">
            ✓
          </span>
        </div>
        <h2 className="t-display-md mt-lg text-center">Đặt xe thành công</h2>
      </div>

      <div className="rounded-xl bg-canvas p-2xl">
        <Row label="Điểm đến" value={summary?.destination ?? '—'} />
        <Row label="Loại xe" value={summary?.vehicle ?? '—'} />
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
