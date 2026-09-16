'use client';

/**
 * screen_name: `pickup_confirm` — step 2
 * Event: screen_view, confirm_pickup, change_address, back.
 *
 * Giao dien theo ride-flow-design.md muc 3 "Man 2".
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FIXED_PICKUP, getAddress } from '@gsm/shared';
import { BackButton } from '@/components/BackButton';
import { FlowGuard } from '@/components/FlowGuard';
import { MapCanvas } from '@/components/MapCanvas';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenShell } from '@/components/ScreenShell';
import { useApp } from '@/lib/app-context';
import { trackEvent, useScreenView } from '@/lib/track';

export default function PickupPage() {
  const { ride } = useApp();
  return (
    <FlowGuard ready={Boolean(ride.addressId)} fallback="/ride/address">
      <PickupContent />
    </FlowGuard>
  );
}

function PickupContent() {
  useScreenView('pickup_confirm');
  const router = useRouter();
  const { ride, setRide } = useApp();
  const [note, setNote] = useState(ride.driverNote ?? '');

  const addressId = ride.addressId!;
  const address = getAddress(addressId);

  function confirmPickup() {
    const driverNote = note.trim();
    trackEvent({
      eventName: 'confirm_pickup',
      screenName: 'pickup_confirm',
      // driver_note la chuoi RONG khi khong nhap, khong phai null —
      // de pandas dem `(df.driver_note != '').mean()` ra ngay ti le dung.
      properties: { address_id: addressId, driver_note: driverNote },
    });
    setRide({ driverNote });
    router.push('/ride/vehicle');
  }

  function changeAddress() {
    // address_id o day la diem den DANG BI BO, khong phai dia chi moi.
    trackEvent({
      eventName: 'change_address',
      screenName: 'pickup_confirm',
      properties: { address_id: addressId },
    });
    router.push('/ride/address');
  }

  return (
    <ScreenShell
      title="Xác nhận điểm đón"
      leading={<BackButton from="pickup_confirm" to="address_selection" href="/ride/address" />}
      footer={<PrimaryButton onClick={confirmPickup}>Chọn điểm đón này</PrimaryButton>}
    >
      <div className="relative mb-lg">
        <MapCanvas variant="pickup" />
        {/* Nut re-center — trang tri, khong co toa do that de re-center ve. */}
        <span
          aria-hidden="true"
          className="shadow-level-2 absolute right-lg bottom-lg grid size-11 place-items-center rounded-full bg-canvas text-ink"
        >
          ◎
        </span>
      </div>

      {/* card-content — tailwind-theme.md muc 4 */}
      <div className="rounded-xl bg-canvas p-2xl">
        {/* Diem DON — hang so, khong doi theo lua chon cua nguoi dung. */}
        <div className="flex items-baseline justify-between gap-md">
          <p className="t-display-sm">{FIXED_PICKUP.label}</p>
          <span aria-hidden="true" className="t-caption shrink-0 text-mute">
            bán kính 10 m
          </span>
        </div>
        <p className="t-body-sm mt-xxs text-body">{FIXED_PICKUP.address}</p>

        {/* Diem DEN — dia chi vua chon o man 1. */}
        <p className="t-caption mt-lg text-mute">Điểm đến</p>
        <p className="t-body-md-strong mt-xxs">{address?.label ?? 'Không rõ'}</p>
        <p className="t-body-sm mt-xxs text-body">{address?.address}</p>

        {/* text-input — tailwind-theme.md muc 4 */}
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Thêm ghi chú cho bác tài (ví dụ: gần cổng)"
          aria-label="Ghi chú cho tài xế"
          className="t-body-md mt-lg w-full rounded-md bg-canvas-soft p-lg text-ink outline-none placeholder:text-mute"
        />
      </div>

      <div className="mt-lg">
        <PrimaryButton variant="secondary" onClick={changeAddress}>
          Đổi điểm đến
        </PrimaryButton>
      </div>

      {/* Diem DON la hang so, KHONG ghi event cho no (mock-data.md muc 1). */}
    </ScreenShell>
  );
}
