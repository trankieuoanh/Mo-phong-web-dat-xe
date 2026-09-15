'use client';

/**
 * screen_name: `vehicle_selection` — step 3
 * Event: screen_view, select_vehicle, back.
 */

import { useRouter } from 'next/navigation';
import { VEHICLES } from '@gsm/shared';
import { BackButton } from '@/components/BackButton';
import { FlowGuard } from '@/components/FlowGuard';
import { ScreenShell } from '@/components/ScreenShell';
import { useApp } from '@/lib/app-context';
import { formatVnd } from '@/lib/format';
import { trackEvent, useScreenView } from '@/lib/track';

export default function VehiclePage() {
  const { ride } = useApp();
  return (
    <FlowGuard ready={Boolean(ride.addressId)} fallback="/ride/address">
      <VehicleContent />
    </FlowGuard>
  );
}

function VehicleContent() {
  useScreenView('vehicle_selection');
  const router = useRouter();
  const { setRide } = useApp();

  function selectVehicle(id: string, type: 'bike' | 'car', basePrice: number) {
    trackEvent({
      eventName: 'select_vehicle',
      screenName: 'vehicle_selection',
      properties: { vehicle_id: id, vehicle_type: type, base_price: basePrice },
    });
    setRide({ vehicleId: id });
    router.push('/ride/promo');
  }

  return (
    <ScreenShell
      title="Chọn loại xe"
      leading={<BackButton from="vehicle_selection" to="pickup_confirm" href="/ride/pickup" />}
    >
      <ul className="flex flex-col gap-md">
        {VEHICLES.map((vehicle) => (
          <li key={vehicle.id}>
            <button
              type="button"
              onClick={() => selectVehicle(vehicle.id, vehicle.type, vehicle.basePrice)}
              className="flex w-full items-center justify-between gap-lg rounded-md bg-canvas-soft p-lg text-left text-ink active:bg-surface-pressed"
            >
              <span>
                <span className="t-body-md-strong block">{vehicle.name}</span>
                <span className="t-body-sm mt-xxs block text-body">{vehicle.description}</span>
                <span className="t-caption mt-xxs block text-mute">
                  {vehicle.etaMinutes} phút · {vehicle.seats} chỗ
                </span>
              </span>
              <span className="t-body-md-strong shrink-0">{formatVnd(vehicle.basePrice)}</span>
            </button>
          </li>
        ))}
      </ul>

      {/* TODO(Tuan 2): trang thai duoc chon (ring-2 ring-primary), icon xe. */}
    </ScreenShell>
  );
}
