'use client';

/**
 * screen_name: `address_selection` — step 1
 * Event: screen_view, select_address, back. Xem event-taxonomy.md muc 3.
 *
 * Khong can FlowGuard: day la buoc dau cua luong ride.
 *
 * Giao dien theo ride-flow-design.md muc 3 "Man 1": chon DIEM DEN.
 * Diem don duoc xac nhan (va doi duoc) o man sau.
 *
 * O tim noi vao `GET /api/places` — nguoi dung chon duoc bat ky dia chi nao
 * o Viet Nam, khong chi 5 goi y. `address_source` phan biet BA nhanh: `preset`
 * (5 goi y), `search` (tu go tim), `map` (tu bam mot diem tren ban do).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DEFAULT_PICKUP, type LatLon, type Place } from '@/lib/shared';
import { PrimaryButton } from '@/components/PrimaryButton';
import { reversePlace } from '@/lib/reverse-place';
import { BackButton } from '@/components/BackButton';
import { Icon } from '@/components/Icon';
import { MapCanvas } from '@/components/MapCanvas';
import { PlacePicker } from '@/components/PlacePicker';
import { ScreenShell } from '@/components/ScreenShell';
import { useApp } from '@/lib/app-context';
import { trackEvent, useFlowEntryView } from '@/lib/track';

export default function AddressPage() {
  useFlowEntryView('address_selection');
  const router = useRouter();
  const { ride, setRide } = useApp();

  // Man nay chua biet diem den, nen ban do chi ghim diem don.
  const pickup = ride.pickup ?? DEFAULT_PICKUP;

  /** Bat che do bam chon diem den tren ban do. */
  const [picking, setPicking] = useState(false);
  /** Diem vua bam, DA tra xong nhan. `null` = chua bam gi. */
  const [picked, setPicked] = useState<Place | null>(null);
  const [resolving, setResolving] = useState(false);

  async function pickOnMap(point: LatLon) {
    setResolving(true);
    // Tra nhan TRUOC khi bat cho xac nhan: `select_address` mang `address_label`,
    // nen khong duoc ban khi nhan con dang tra. Day la ly do chon vi tri la HAI
    // buoc (bam roi xac nhan) chu khong phai mot.
    const place = await reversePlace(point.lat, point.lon);
    setPicked(place);
    setResolving(false);
  }

  function selectAddress(place: Place) {
    trackEvent({
      eventName: 'select_address',
      screenName: 'address_selection',
      properties: {
        address_id: place.id,
        address_label: place.label,
        // 'preset' | 'search' — ghi thanh khoa rieng chu KHONG doan qua tien to
        // id: tien to la chi tiet cai dat, doi nha cung cap dia chi la moi script
        // pandas cu sai im lang (event-taxonomy.md muc 3).
        address_source: place.source,
      },
    });
    // Xoa `route` cu CUNG LUC voi viec dat diem den moi. Tuyen duong da cat
    // trong draft thuoc ve diem den TRUOC do; giu lai thi sau `change_address`
    // nguoi dung co the bam Back cua trinh duyet ve /ride/vehicle va thay gia
    // tinh theo quang duong cu — `confirm_ride` se ghi `distance_km` khong khop
    // `address_label` trong cung mot document. Man /ride/pickup se lay tuyen moi.
    setRide({ destination: place, route: undefined });
    router.push('/ride/pickup');
  }

  return (
    <ScreenShell
      variant="split"
      section="Di chuyển"
      tabs={['Đặt xe', 'Đang diễn ra']}
      aside={
        <MapCanvas
          pickup={pickup}
          // Diem vua bam hien luon thanh ghim diem den — dung lop ghim san co,
          // khong ve them lop nao.
          destination={picked ?? undefined}
          label={picking ? 'Bấm lên bản đồ để chọn điểm đến' : pickup.label}
          fill
          onPick={picking ? pickOnMap : undefined}
        />
      }
      title="Bạn muốn đi đến đâu?"
      leading={<BackButton from="address_selection" to="home" href="/" />}
      trailing={
        <Decor className="t-body-sm-strong inline-flex items-center gap-xxs text-body">
          Hà Nội
          <Icon name="chevron-down" size={16} />
        </Decor>
      }
    >
      <div className={picking ? 'flex flex-col' : undefined}>
        <div className={picking ? 'order-1 hidden desktop:order-1 desktop:block' : undefined}>
          <PlacePicker
            placeholder="Tìm điểm đến"
            presetHeading="Địa chỉ đã lưu"
            selectedId={ride.destination?.id}
            onPick={selectAddress}
            origin={pickup}
            leading={
              <Decor className="t-body-sm-strong inline-flex items-center gap-sm rounded-pill bg-canvas-soft px-lg py-sm text-primary-dark">
                <Icon name="target" size={18} /> Sử dụng vị trí hiện tại
              </Decor>
            }
          />
        </div>

        <div className="order-2 mt-2xl flex flex-wrap items-center gap-md">
          <Decor
            className={`t-body-sm-strong items-center gap-sm rounded-pill bg-canvas-soft px-lg py-sm text-body ${
              picking ? 'hidden desktop:inline-flex' : 'inline-flex'
            }`}
          >
            <Icon name="heart" size={16} /> Địa chỉ đã lưu
          </Decor>
          {/* Chip nay truoc la <Decor>. Gio bam duoc that — bat/tat che do chon
              tren ban do. KHONG ban event: bat che do chua phai mot lua chon,
              `select_address` chi ban khi nguoi dung xac nhan diem da bam. */}
          <button
            type="button"
            onClick={() => {
              setPicking((on) => !on);
              setPicked(null);
            }}
            aria-pressed={picking}
            className={`t-body-sm-strong inline-flex min-h-12 items-center gap-sm rounded-pill px-lg transition-colors ${
              picking
                ? 'bg-primary-dark text-on-primary'
                : 'bg-canvas-soft text-body hover:bg-surface-pressed'
            }`}
          >
            <Icon name="map" size={16} /> Tìm trên bản đồ
          </button>
        </div>

        {picking ? (
          <div className="order-1 mt-lg rounded-xl bg-canvas-soft p-lg desktop:order-3">
            {picked ? (
              <>
                <p className="t-body-md-strong break-words text-ink">{picked.label}</p>
                <p className="t-body-sm mt-xxs break-words text-body">{picked.address}</p>
                <div className="mt-lg">
                  <PrimaryButton
                    fullWidth={false}
                    onClick={() => selectAddress(picked)}
                    className="w-full desktop:w-auto"
                  >
                    Chọn điểm đến này
                  </PrimaryButton>
                </div>
              </>
            ) : (
              <p className="t-body-sm break-words text-body">
                {resolving
                  ? 'Đang tra địa chỉ…'
                  : 'Bấm một điểm trên bản đồ để chọn làm điểm đến.'}
              </p>
            )}
          </div>
        ) : null}

        <div
          className={`order-3 mt-lg items-center justify-between desktop:order-4 ${
            picking ? 'hidden desktop:flex' : 'flex'
          }`}
        >
          <span className="t-body-sm text-body">Hiển thị địa chỉ sau sáp nhập tỉnh</span>
          <Decor className="inline-flex h-6 w-11 items-center justify-end rounded-pill bg-surface-pressed p-xxs">
            <span className="block size-4 rounded-full bg-canvas" />
          </Decor>
        </div>
      </div>
    </ScreenShell>
  );
}

/**
 * Thanh phan chi de trang tri — ride-flow-design.md muc 8.
 * KHONG bam duoc, KHONG ban event: mot nut bam duoc ma khong ghi lai
 * la mot khoang mu trong du lieu.
 */
function Decor({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span aria-hidden="true" className={className}>
      {children}
    </span>
  );
}
