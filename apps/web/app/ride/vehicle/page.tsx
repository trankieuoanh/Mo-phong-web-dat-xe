'use client';

/**
 * screen_name: `vehicle_selection` — step 3
 * Event: screen_view, select_vehicle, back.
 *
 * Giao dien theo ride-flow-design.md muc 3 "Man 3".
 *
 * THAY DOI HANH VI (muc 7 cua tai lieu do): bam mot hang xe se ban
 * `select_vehicle` roi O LAI MAN; nut "Tiep tuc" moi chuyen man va khong
 * ban event. Vi vay mot session co the co NHIEU `select_vehicle` — do la
 * du lieu tot (do duoc su phan van). Khi phan tich "hang xe duoc chon",
 * lay `select_vehicle` CUOI CUNG cua moi session.
 */

import { useRouter } from 'next/navigation';
import { VEHICLES, type Vehicle } from '@gsm/shared';
import { BackButton } from '@/components/BackButton';
import { FlowGuard } from '@/components/FlowGuard';
import { Icon, type IconName } from '@/components/Icon';
import { MapCanvas } from '@/components/MapCanvas';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenShell } from '@/components/ScreenShell';
import { useApp } from '@/lib/app-context';
import { formatVnd } from '@/lib/format';
import { trackEvent, useScreenView } from '@/lib/track';

const ICONS: Record<Vehicle['type'], IconName> = { bike: 'bike', car: 'car' };

export default function VehiclePage() {
  const { ride } = useApp();
  return (
    <FlowGuard ready={Boolean(ride.destination)} fallback="/ride/address">
      <VehicleContent />
    </FlowGuard>
  );
}

function VehicleContent() {
  useScreenView('vehicle_selection');
  const router = useRouter();
  const { ride, setRide } = useApp();

  function selectVehicle(id: string, type: Vehicle['type'], basePrice: number) {
    trackEvent({
      eventName: 'select_vehicle',
      screenName: 'vehicle_selection',
      properties: { vehicle_id: id, vehicle_type: type, base_price: basePrice },
    });
    setRide({ vehicleId: id });
  }

  // Ca hai nut deu dan sang man uu dai — khong ban event cho viec dieu huong,
  // `screen_view` cua `promo_selection` da la moc do.
  function goToPromo() {
    router.push('/ride/promo');
  }

  return (
    <ScreenShell
      variant="split"
      section="Di chuyển"
      tabs={['Đặt xe', 'Đang diễn ra']}
      aside={<MapCanvas variant="route" fill />}
      title="Chọn loại xe"
      leading={<BackButton from="vehicle_selection" to="pickup_confirm" href="/ride/pickup" />}
      trailing={
        <span
          aria-hidden="true"
          className="t-body-sm-strong rounded-pill bg-canvas-soft px-lg py-sm text-body"
        >
          Đặt hộ
        </span>
      }
      footer={
        <PrimaryButton onClick={goToPromo} disabled={!ride.vehicleId}>
          Tiếp tục
        </PrimaryButton>
      }
    >
      <ul className="flex flex-col gap-md">
        {VEHICLES.map((vehicle) => (
          <li key={vehicle.id}>
            <button
              type="button"
              onClick={() => selectVehicle(vehicle.id, vehicle.type, vehicle.basePrice)}
              className={`flex w-full items-center gap-lg rounded-md bg-canvas-soft p-lg text-left text-ink transition-colors hover:bg-surface-pressed ${
                vehicle.id === ride.vehicleId ? 'ring-2 ring-primary' : ''
              }`}
            >
              {/* O vuong chua phuong tien, giong o chon Taxi/San bay trong anh mau. */}
              <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-canvas text-primary-dark">
                <Icon name={ICONS[vehicle.type]} size={28} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="t-body-md-strong block">{vehicle.name}</span>
                <span className="t-body-sm mt-xxs block text-body">{vehicle.description}</span>
                <span className="t-caption mt-xxs block text-mute">
                  Đón trong {vehicle.etaMinutes} phút · {vehicle.seats} chỗ
                </span>
              </span>

              <span className="t-body-md-strong shrink-0">{formatVnd(vehicle.basePrice)}</span>
            </button>
          </li>
        ))}
      </ul>

      {/* card-soft-tinted — trang tri, ride-flow-design.md muc 8 */}
      <div aria-hidden="true" className="mt-lg flex items-center gap-lg rounded-xl bg-canvas-soft p-2xl">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-canvas text-primary-dark">
          <Icon name="bolt" size={22} />
        </span>
        <span>
          <span className="t-body-md-strong block">Boost</span>
          <span className="t-body-sm mt-xxs block text-body">Tăng phí để có xe nhanh hơn</span>
        </span>
      </div>

      <div aria-hidden="true" className="mt-lg flex flex-wrap items-center gap-md">
        <span className="t-body-sm-strong inline-flex items-center gap-sm rounded-pill bg-canvas-soft px-lg py-sm text-body">
          <Icon name="cash" size={16} /> Tiền mặt
        </span>
        <span className="t-body-sm-strong inline-flex items-center gap-sm rounded-pill bg-canvas-soft px-lg py-sm text-body">
          <Icon name="clock" size={16} /> Hẹn giờ
        </span>
        <span className="t-body-sm-strong inline-flex items-center gap-sm rounded-pill bg-canvas-soft px-lg py-sm text-body">
          <Icon name="bolt" size={16} /> GreenNow
        </span>
      </div>

      <div className="mt-lg">
        <PrimaryButton variant="subtle" onClick={goToPromo} className="inline-flex items-center justify-center gap-sm">
          <Icon name="ticket" size={20} /> Ưu đãi
        </PrimaryButton>
      </div>
    </ScreenShell>
  );
}
