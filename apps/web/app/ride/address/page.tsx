'use client';

/**
 * screen_name: `address_selection` — step 1
 * Event: screen_view, select_address, back. Xem event-taxonomy.md muc 3.
 *
 * Khong can FlowGuard: day la buoc dau cua luong ride.
 */

import { useRouter } from 'next/navigation';
import { ADDRESSES } from '@gsm/shared';
import { BackButton } from '@/components/BackButton';
import { ScreenShell } from '@/components/ScreenShell';
import { useApp } from '@/lib/app-context';
import { trackEvent, useScreenView } from '@/lib/track';

export default function AddressPage() {
  useScreenView('address_selection');
  const router = useRouter();
  const { setRide } = useApp();

  function selectAddress(id: string, label: string) {
    trackEvent({
      eventName: 'select_address',
      screenName: 'address_selection',
      properties: { address_id: id, address_label: label },
    });
    setRide({ addressId: id });
    router.push('/ride/pickup');
  }

  return (
    <ScreenShell
      title="Bạn muốn đón ở đâu?"
      leading={<BackButton from="address_selection" to="home" href="/" />}
    >
      <ul className="flex flex-col gap-md">
        {ADDRESSES.map((address) => (
          <li key={address.id}>
            <button
              type="button"
              onClick={() => selectAddress(address.id, address.label)}
              className="w-full rounded-md bg-canvas-soft p-lg text-left text-ink active:bg-surface-pressed"
            >
              <span className="t-body-md-strong block">{address.label}</span>
              <span className="t-body-sm mt-xxs block text-body">{address.address}</span>
            </button>
          </li>
        ))}
      </ul>

      {/* TODO(Tuan 2): icon theo `address.icon`, trang thai duoc chon (ring-2 ring-primary). */}
    </ScreenShell>
  );
}
