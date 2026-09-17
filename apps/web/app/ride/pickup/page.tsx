'use client';

/**
 * screen_name: `pickup_confirm` — step 2
 * Event: screen_view, confirm_pickup, change_address, back.
 *
 * Giao dien theo ride-flow-design.md muc 3 "Man 2".
 *
 * O tim diem don nam NGAY TRONG man nay, khong phai mot route rieng:
 * them mot man la danh so lai toan bo `step_index` va lam du lieu cu khong
 * ghep duoc voi du lieu moi (ride-flow-design.md muc 9).
 */

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DEFAULT_PICKUP, isPickupChanged, type Place } from '@gsm/shared';
import { BackButton } from '@/components/BackButton';
import { FlowGuard } from '@/components/FlowGuard';
import { Icon } from '@/components/Icon';
import { MapCanvas } from '@/components/MapCanvas';
import { PlacePicker } from '@/components/PlacePicker';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenShell } from '@/components/ScreenShell';
import { useApp } from '@/lib/app-context';
import { useRoute } from '@/lib/use-route';
import { trackEvent, useScreenView } from '@/lib/track';

export default function PickupPage() {
  const { ride } = useApp();
  return (
    <FlowGuard ready={Boolean(ride.destination)} fallback="/">
      <PickupContent />
    </FlowGuard>
  );
}

function PickupContent() {
  useScreenView('pickup_confirm');
  const router = useRouter();
  const { ride, setRide } = useApp();
  const [note, setNote] = useState(ride.driverNote ?? '');
  const [pickingPickup, setPickingPickup] = useState(false);

  // FlowGuard da bao dam `destination` ton tai; `pickup` luon co nho newRideDraft().
  const destination = ride.destination!;
  const pickup = ride.pickup ?? DEFAULT_PICKUP;

  // Man dau tien biet du CA HAI diem, nen tuyen duong duoc lay o day va cat vao
  // draft. Man chon xe va man xac nhan chi DOC lai — hai lan fetch co the ra hai
  // quang duong hoi khac nhau, va khi do gia tren man hinh khong khop gia trong
  // event (xem ghi chu o RideDraft.route).
  const { route } = useRoute(pickup, destination);

  useEffect(() => {
    if (route) setRide({ route });
  }, [route, setRide]);

  function choosePickup(place: Place) {
    // CHUA ban event — `confirm_pickup` o nut duoi moi la moc do, va nho vay
    // moi session co dung MOT `confirm_pickup` du nguoi dung doi qua doi lai.
    setRide({ pickup: place });
    setPickingPickup(false);
  }

  function confirmPickup() {
    const driverNote = note.trim();
    trackEvent({
      eventName: 'confirm_pickup',
      screenName: 'pickup_confirm',
      properties: {
        address_id: destination.id,
        pickup_id: pickup.id,
        pickup_label: pickup.label,
        pickup_source: pickup.source,
        // driver_note la chuoi RONG khi khong nhap, khong phai null —
        // de pandas dem `(df.driver_note != '').mean()` ra ngay ti le dung.
        driver_note: driverNote,
      },
    });
    setRide({ driverNote });
    router.push('/ride/vehicle');
  }

  function changeAddress() {
    // address_id o day la diem den DANG BI BO, khong phai dia chi moi.
    trackEvent({
      eventName: 'change_address',
      screenName: 'pickup_confirm',
      properties: { address_id: destination.id },
    });
    router.push('/ride/address');
  }

  return (
    <ScreenShell
      variant="split"
      section="Di chuyển"
      tabs={['Đặt xe', 'Đang diễn ra']}
      aside={<MapCanvas pickup={pickup} destination={destination} route={route} fill />}
      title="Xác nhận điểm đón"
      leading={<BackButton from="pickup_confirm" to="address_selection" href="/ride/address" />}
      footer={<PrimaryButton onClick={confirmPickup}>Chọn điểm đón này</PrimaryButton>}
    >
      {pickingPickup ? (
        <>
          <div className="mb-lg flex items-center justify-between gap-md">
            <p className="t-body-md-strong">Chọn điểm đón</p>
            <button
              type="button"
              onClick={() => setPickingPickup(false)}
              className="t-body-sm-strong inline-flex items-center gap-xxs rounded-pill px-md py-xs text-body hover:bg-canvas-soft"
            >
              <Icon name="close" size={16} /> Huỷ
            </button>
          </div>
          <PlacePicker
            placeholder="Tìm điểm đón"
            presetHeading="Địa chỉ đã lưu"
            selectedId={pickup.id}
            onPick={choosePickup}
            origin={destination}
          />
        </>
      ) : (
        <>
          {/* card-soft-tinted — panel da la nen trang nen card dung `canvas-soft`. */}
          <div className="rounded-xl bg-canvas-soft p-2xl">
            <p className="t-caption text-mute">Điểm đón</p>
            <div className="mt-xxs flex items-baseline justify-between gap-md">
              <p className="t-display-sm">{pickup.label}</p>
              {!isPickupChanged(pickup) ? (
                <span aria-hidden="true" className="t-caption shrink-0 text-mute">
                  bán kính 10 m
                </span>
              ) : null}
            </div>
            <p className="t-body-sm mt-xxs text-body">{pickup.address}</p>

            <button
              type="button"
              onClick={() => setPickingPickup(true)}
              className="t-body-sm-strong mt-md inline-flex items-center gap-sm rounded-pill bg-canvas px-lg py-sm text-primary-dark transition-colors hover:bg-surface-pressed"
            >
              <Icon name="search" size={16} /> Đổi điểm đón
            </button>

            {/* Diem DEN — dia chi vua chon o man 1. */}
            <p className="t-caption mt-lg text-mute">Điểm đến</p>
            <p className="t-body-md-strong mt-xxs">{destination.label}</p>
            <p className="t-body-sm mt-xxs text-body">{destination.address}</p>

            {/* text-input — tailwind-theme.md muc 4 */}
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Thêm ghi chú cho bác tài (ví dụ: gần cổng)"
              aria-label="Ghi chú cho tài xế"
              className="t-body-md mt-lg w-full rounded-md bg-canvas p-lg text-ink outline-none placeholder:text-mute"
            />
          </div>

          <div className="mt-lg">
            <PrimaryButton variant="secondary" onClick={changeAddress}>
              Đổi điểm đến
            </PrimaryButton>
          </div>
        </>
      )}
    </ScreenShell>
  );
}
