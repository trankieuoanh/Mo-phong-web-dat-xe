'use client';

/**
 * screen_name: `pickup_confirm` — step 2
 * Event: screen_view, confirm_pickup, change_address, back.
 */

import { useRouter } from 'next/navigation';
import { FIXED_DESTINATION, getAddress } from '@gsm/shared';
import { BackButton } from '@/components/BackButton';
import { FlowGuard } from '@/components/FlowGuard';
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
  const { ride } = useApp();

  const addressId = ride.addressId!;
  const address = getAddress(addressId);

  function confirmPickup() {
    trackEvent({
      eventName: 'confirm_pickup',
      screenName: 'pickup_confirm',
      properties: { address_id: addressId },
    });
    router.push('/ride/vehicle');
  }

  function changeAddress() {
    // address_id o day la dia chi DANG BI BO, khong phai dia chi moi.
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
      footer={<PrimaryButton onClick={confirmPickup}>Xác nhận điểm đón</PrimaryButton>}
    >
      <div className="rounded-xl bg-canvas-soft p-2xl">
        <p className="t-caption text-mute">Điểm đón</p>
        <p className="t-body-md-strong mt-xxs">{address?.label ?? 'Không rõ'}</p>
        <p className="t-body-sm mt-xxs text-body">{address?.address}</p>

        <p className="t-caption mt-lg text-mute">Điểm đến</p>
        <p className="t-body-sm mt-xxs text-body">{FIXED_DESTINATION}</p>
      </div>

      <div className="mt-lg">
        <PrimaryButton variant="secondary" onClick={changeAddress}>
          Đổi địa chỉ
        </PrimaryButton>
      </div>

      {/* TODO(Tuan 2): khung ban do gia lap theo DESIGN.md.
          Diem den la chuoi co dinh, KHONG ghi event cho no (mock-data.md muc 1). */}
    </ScreenShell>
  );
}
