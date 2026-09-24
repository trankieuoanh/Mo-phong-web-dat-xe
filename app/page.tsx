'use client';

/**
 * Man Home — screen_name: `home`, step_index: 0 (ca hai luong).
 * Event: screen_view, select_flow. Xem event-taxonomy.md muc 3.
 *
 * Home GIO LA MAN DAT XE: hai card "Dat xe" / "Dat do an" da chuyen thanh tab
 * o `SideRail`, va ride la luong mac dinh. Man nay van mang `screen_name: home`
 * va `flow: 'none'` de mau so funnel ("so nguoi vao Home") khong doi.
 *
 * DUNG MOT PHAN TU BAM DUOC: o tim diem den. No ban `select_flow` roi day sang
 * `/ride/address` — KHONG tu chon dia chi tai day, vi `select_address` phai ban
 * o step 1. Moi thu con lai la `Decor`: bam duoc ma khong ghi lai la mot khoang
 * mu trong du lieu (ride-flow-design.md muc 8).
 */

import { useRouter } from 'next/navigation';
import { DEFAULT_PICKUP } from '@gsm/shared';
import { Icon } from '@/components/Icon';
import { MapCanvas } from '@/components/MapCanvas';
import { ScreenShell } from '@/components/ScreenShell';
import { useApp } from '@/lib/app-context';
import { trackSelectFlow, useScreenView } from '@/lib/track';

export default function HomePage() {
  useScreenView('home');
  const router = useRouter();
  const { ride } = useApp();

  // Cung cach lay diem don voi `/ride/address`, de di tiep sang man do thi ban
  // do khong nhay khung. Luu y: sau F5 tren chinh man nay, lan render dau van la
  // DEFAULT_PICKUP (newRideDraft) roi moi hydrate ra diem don da luu — neu nguoi
  // dung tung doi diem don thi ban do refit mot lan. Chap nhan duoc: doi map sang
  // chi ve sau khi `hydrated` se de lai mot o trong nhap nhay o moi lan vao.
  const pickup = ride.pickup ?? DEFAULT_PICKUP;

  function startRide() {
    // `flow` va `stepIndex` do trackSelectFlow ep — xem track.ts.
    trackSelectFlow('home', 'ride');
    router.push('/ride/address');
  }

  return (
    <ScreenShell
      variant="split"
      section="Di chuyển"
      tabs={['Đặt xe', 'Đang diễn ra']}
      aside={<MapCanvas pickup={pickup} label={pickup.label} fill />}
      // Tieu de phai KHAC han `/ride/address` ("Bạn muốn đi đến đâu?"): hai man
      // gio dung chung section, tabs va ban do, chi tieu de phan biet duoc.
      title="Xin chào, hôm nay bạn đi đâu?"
      // Khong co `leading`: Home la man dau, khong co nut Back.
      trailing={
        <Decor className="t-body-sm-strong inline-flex items-center gap-xxs text-body">
          Hà Nội
          <Icon name="chevron-down" size={16} />
        </Decor>
      }
    >
      <button
        type="button"
        onClick={startRide}
        className="t-body-md-strong flex w-full items-center gap-md rounded-xl bg-canvas-soft px-lg py-lg text-left text-body transition-colors hover:bg-surface-pressed"
      >
        <Icon name="search" />
        Bạn muốn đi đâu?
        <Icon name="chevron-right" size={16} className="ml-auto text-primary-dark" />
      </button>

      <div className="mt-2xl flex flex-wrap items-center gap-md">
        <Decor className="t-body-sm-strong inline-flex items-center gap-sm rounded-pill bg-canvas-soft px-lg py-sm text-primary-dark">
          <Icon name="target" size={18} /> Sử dụng vị trí hiện tại
        </Decor>
        <Decor className="t-body-sm-strong inline-flex items-center gap-sm rounded-pill bg-canvas-soft px-lg py-sm text-body">
          <Icon name="heart" size={16} /> Địa chỉ đã lưu
        </Decor>
        <Decor className="t-body-sm-strong inline-flex items-center gap-sm rounded-pill bg-canvas-soft px-lg py-sm text-body">
          <Icon name="map" size={16} /> Tìm trên bản đồ
        </Decor>
      </div>

      <div className="mt-2xl flex items-center gap-md rounded-xl bg-canvas-soft p-lg">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-canvas text-primary-dark">
          <Icon name="bolt" />
        </span>
        <div>
          <p className="t-body-md-strong text-ink">Xe máy và ô tô điện</p>
          <p className="t-body-sm text-body">Đón trong vài phút, giá hiện rõ trước khi đặt</p>
        </div>
      </div>
    </ScreenShell>
  );
}

/**
 * Thanh phan chi de trang tri — ride-flow-design.md muc 8.
 * KHONG bam duoc, KHONG ban event.
 */
function Decor({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span aria-hidden="true" className={className}>
      {children}
    </span>
  );
}
