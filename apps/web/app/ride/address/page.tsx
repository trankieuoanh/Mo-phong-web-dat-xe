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
 * o Viet Nam, khong chi 5 goi y. `address_source` phan biet hai nhanh do.
 */

import { useRouter } from 'next/navigation';
import type { Place } from '@gsm/shared';
import { BackButton } from '@/components/BackButton';
import { Icon } from '@/components/Icon';
import { MapCanvas } from '@/components/MapCanvas';
import { PlacePicker } from '@/components/PlacePicker';
import { ScreenShell } from '@/components/ScreenShell';
import { useApp } from '@/lib/app-context';
import { trackEvent, useScreenView } from '@/lib/track';

export default function AddressPage() {
  useScreenView('address_selection');
  const router = useRouter();
  const { ride, setRide } = useApp();

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
    setRide({ destination: place });
    router.push('/ride/pickup');
  }

  return (
    <ScreenShell
      variant="split"
      section="Di chuyển"
      tabs={['Đặt xe', 'Đang diễn ra']}
      aside={<MapCanvas variant="pickup" fill />}
      title="Bạn muốn đi đến đâu?"
      leading={<BackButton from="address_selection" to="home" href="/" />}
      trailing={
        <Decor className="t-body-sm-strong inline-flex items-center gap-xxs text-body">
          Hà Nội
          <Icon name="chevron-down" size={16} />
        </Decor>
      }
    >
      <PlacePicker
        placeholder="Tìm điểm đến"
        presetHeading="Địa chỉ đã lưu"
        selectedId={ride.destination?.id}
        onPick={selectAddress}
        leading={
          <Decor className="t-body-sm-strong inline-flex items-center gap-sm rounded-pill bg-canvas-soft px-lg py-sm text-primary-dark">
            <Icon name="target" size={18} /> Sử dụng vị trí hiện tại
          </Decor>
        }
      />

      <div className="mt-2xl flex flex-wrap items-center gap-md">
        <Decor className="t-body-sm-strong inline-flex items-center gap-sm rounded-pill bg-canvas-soft px-lg py-sm text-body">
          <Icon name="heart" size={16} /> Địa chỉ đã lưu
        </Decor>
        <Decor className="t-body-sm-strong inline-flex items-center gap-sm rounded-pill bg-canvas-soft px-lg py-sm text-body">
          <Icon name="map" size={16} /> Tìm trên bản đồ
        </Decor>
      </div>

      <div className="mt-lg flex items-center justify-between">
        <span className="t-body-sm text-body">Hiển thị địa chỉ sau sáp nhập tỉnh</span>
        <Decor className="inline-flex h-6 w-11 items-center justify-end rounded-pill bg-surface-pressed p-xxs">
          <span className="block size-4 rounded-full bg-canvas" />
        </Decor>
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
