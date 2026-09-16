'use client';

/**
 * screen_name: `address_selection` — step 1
 * Event: screen_view, select_address, back. Xem event-taxonomy.md muc 3.
 *
 * Khong can FlowGuard: day la buoc dau cua luong ride.
 *
 * Giao dien theo ride-flow-design.md muc 3 "Man 1": chon DIEM DEN.
 * Diem don la hang so FIXED_PICKUP, duoc xac nhan o man sau.
 * `address_id` trong event tro vao diem DEN — dia chi duy nhat bien thien.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ADDRESSES, type Address } from '@gsm/shared';
import { BackButton } from '@/components/BackButton';
import { ScreenShell } from '@/components/ScreenShell';
import { useApp } from '@/lib/app-context';
import { trackEvent, useScreenView } from '@/lib/track';

// Khong dung thu vien icon (CLAUDE.md quy tac 8) — ky tu la du cho ban mo phong.
const ICONS: Record<Address['icon'], string> = {
  home: '🏠',
  work: '🏢',
  school: '🎓',
  plane: '✈️',
  shop: '🛍️',
};

export default function AddressPage() {
  useScreenView('address_selection');
  const router = useRouter();
  const { ride, setRide } = useApp();
  const [query, setQuery] = useState('');

  // Chi loc danh sach, KHONG ban event: ket qua cuoi cung da nam trong
  // `select_address`, con go phim thi khong phai mot buoc funnel.
  const keyword = query.trim().toLowerCase();
  const items = keyword
    ? ADDRESSES.filter(
        (a) =>
          a.label.toLowerCase().includes(keyword) || a.address.toLowerCase().includes(keyword),
      )
    : ADDRESSES;

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
      title="Bạn muốn đi đến đâu?"
      leading={<BackButton from="address_selection" to="home" href="/" />}
      trailing={<Decor className="t-body-sm-strong">Hà Nội 🇻🇳</Decor>}
    >
      <Decor className="t-body-sm-strong mb-lg inline-flex items-center gap-sm rounded-pill bg-canvas-soft px-lg py-sm">
        <span aria-hidden="true">📍</span> Sử dụng vị trí hiện tại
      </Decor>

      {/* text-input — tailwind-theme.md muc 4 */}
      <div className="mb-lg flex items-center gap-md rounded-md bg-canvas-soft p-lg">
        <span aria-hidden="true">🔍</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm điểm đến"
          aria-label="Tìm điểm đến"
          className="t-body-md w-full bg-transparent text-ink outline-none placeholder:text-mute"
        />
      </div>

      {items.length === 0 ? (
        <p className="t-body-sm py-2xl text-center text-body">
          Không tìm thấy điểm đến phù hợp
        </p>
      ) : (
        <ul className="flex flex-col gap-md">
          {items.map((address) => (
            <li key={address.id}>
              <button
                type="button"
                onClick={() => selectAddress(address.id, address.label)}
                className={`flex w-full items-center gap-lg rounded-md bg-canvas-soft p-lg text-left text-ink active:bg-surface-pressed ${
                  address.id === ride.addressId ? 'ring-2 ring-primary' : ''
                }`}
              >
                {/* icon-button-circular — tailwind-theme.md muc 4 */}
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-canvas"
                  aria-hidden="true"
                >
                  {ICONS[address.icon]}
                </span>

                <span className="flex-1">
                  <span className="t-body-md-strong block">{address.label}</span>
                  <span className="t-caption block text-mute">{address.distanceKm} km</span>
                  <span className="t-body-sm mt-xxs block text-body">{address.address}</span>
                </span>

                <Decor className="t-caption shrink-0 text-mute">♡</Decor>
                <Decor className="t-caption shrink-0 text-mute">⋯</Decor>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2xl flex flex-wrap items-center gap-md">
        <Decor className="t-body-sm-strong rounded-pill bg-canvas-soft px-lg py-sm">
          ❤️ Địa chỉ đã lưu
        </Decor>
        <Decor className="t-body-sm-strong rounded-pill bg-canvas-soft px-lg py-sm">
          🗺️ Tìm trên bản đồ
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
