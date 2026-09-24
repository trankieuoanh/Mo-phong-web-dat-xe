'use client';

/**
 * O tim dia chi + danh sach ket qua. Dung o ca `address_selection` (diem den)
 * va `pickup_confirm` (diem don), nen hai cho khong the lech nhau ve hanh vi.
 *
 * KHONG ban event nao — component cha quyet dinh ban gi khi `onPick` chay.
 *
 * SUY BIEN EM khi Photon rot / apps/api khong tra loi / mat mang: hien mot dong
 * canh bao NHUNG VAN liet ke dia chi goi y, de luong di tiep duoc. Cung tinh
 * than voi `trackEvent().catch(() => {})` — ha tang loi khong duoc ket nguoi dung.
 *
 * Nhanh do chi chay khi `status === 'error'`, nen no phu thuoc vao viec
 * `usePlaceSearch` CO han cho: mot request treo mai se ket o 'loading' va khong
 * bao gio roi xuong day. Xem REQUEST_TIMEOUT_MS trong lib/use-place-search.ts.
 */

import { useState } from 'react';
import { PRESET_PLACES, getAddress, haversineKm, roundKm, type Address, type Place } from '@gsm/shared';
import { Icon, type IconName } from '@/components/Icon';
import { MIN_QUERY_LENGTH, usePlaceSearch } from '@/lib/use-place-search';

const PRESET_ICONS: Record<Address['icon'], IconName> = {
  home: 'home',
  work: 'work',
  school: 'school',
  plane: 'plane',
  shop: 'shop',
};

/**
 * Icon cua mot dong. Dia chi goi y co `icon` rieng trong ADDRESSES; ket qua tim
 * duoc thi khong tra bang nao ra ca (mock-data.md muc 1) nen dung ghim chung.
 */
function iconFor(place: Place): IconName {
  const preset = getAddress(place.id);
  return preset ? PRESET_ICONS[preset.icon] : 'pin';
}

/**
 * Khoang cach duong chim bay tu diem don toi mot dia chi.
 *
 * Tinh tai cho thay vi doc mot truong hardcode: `Address.distanceKm` cu la
 * khoang cach toi diem don CU, nen tu khi diem don doi duoc no bao dam co luc
 * hien sai. Cach nay dung cho ca dia chi goi y lan dia chi tu tim.
 */
function distanceFor(place: Place, origin?: Place): string | null {
  if (!origin || origin.id === place.id) return null;
  return `${roundKm(haversineKm(origin, place))} km`;
}

interface PlacePickerProps {
  placeholder: string;
  /** Tieu de cho khoi goi y khi o tim con trong. */
  presetHeading: string;
  /** Dia chi dang duoc chon — de to vien. */
  selectedId?: string;
  onPick: (place: Place) => void;
  /** Hien them dong "Su dung vi tri hien tai" o dau (chi man diem den). */
  leading?: React.ReactNode;
  /** Diem goc de tinh khoang cach goi y. Khong truyen thi khong hien km. */
  origin?: Place;
}

export function PlacePicker({
  placeholder,
  presetHeading,
  selectedId,
  onPick,
  leading,
  origin,
}: PlacePickerProps) {
  const [query, setQuery] = useState('');
  const { results, status, error } = usePlaceSearch(query);

  // Dung DUNG nguong ma hook goi API, khong chep tay mot so khac: lech nhau thi
  // co mot khoang go phim ban request di ma khong bao gio ve ket qua ra.
  const searching = query.trim().length >= MIN_QUERY_LENGTH;

  return (
    <div>
      {/* text-input — tailwind-theme.md muc 4 */}
      <div className="flex items-center gap-md rounded-md bg-canvas-soft p-lg">
        <Icon name="search" size={20} className="text-body" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="t-body-md w-full bg-transparent text-ink outline-none placeholder:text-mute"
        />
        {query ? (
          <button
            type="button"
            aria-label="Xoá ô tìm"
            onClick={() => setQuery('')}
            className="grid size-6 shrink-0 place-items-center rounded-full text-body hover:bg-surface-pressed"
          >
            <Icon name="close" size={14} />
          </button>
        ) : null}
      </div>

      {leading ? <div className="mt-lg">{leading}</div> : null}

      {status === 'error' ? (
        <p className="t-caption mt-lg rounded-md bg-canvas-soft p-md text-body">
          Không tìm được địa chỉ lúc này — bạn vẫn chọn được từ danh sách bên dưới.
          <span className="mt-xxs block text-mute">{error}</span>
        </p>
      ) : null}

      {/* Dang tim: skeleton dung bang so dong sap ve, de danh sach khong giat. */}
      {searching && status === 'loading' ? (
        <ul className="mt-lg flex flex-col gap-md">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="h-[76px] animate-pulse rounded-md bg-canvas-soft" />
          ))}
        </ul>
      ) : null}

      {searching && status === 'ready' ? (
        results.length > 0 ? (
          <ul className="mt-lg flex flex-col gap-md">
            {results.map((place) => (
              <PlaceRow
                key={place.id}
                place={place}
                selected={place.id === selectedId}
                onPick={onPick}
                origin={origin}
              />
            ))}
          </ul>
        ) : (
          <p className="t-body-sm py-2xl text-center text-body">
            Không tìm thấy địa chỉ phù hợp
          </p>
        )
      ) : null}

      {/* Goi y: hien khi chua go, va hien ca khi tim loi de con duong di tiep. */}
      {!searching || status === 'error' ? (
        <>
          <p className="t-caption mt-lg mb-xs text-mute">{presetHeading}</p>
          <ul className="flex flex-col gap-md">
            {PRESET_PLACES.map((place) => (
              <PlaceRow
                key={place.id}
                place={place}
                selected={place.id === selectedId}
                onPick={onPick}
                origin={origin}
              />
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function PlaceRow({
  place,
  selected,
  onPick,
  origin,
}: {
  place: Place;
  selected: boolean;
  onPick: (place: Place) => void;
  origin?: Place;
}) {
  const distance = distanceFor(place, origin);

  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(place)}
        className={`flex w-full items-center gap-lg rounded-md bg-canvas-soft p-lg text-left text-ink transition-colors hover:bg-surface-pressed ${
          selected ? 'ring-2 ring-primary' : ''
        }`}
      >
        {/* icon-button-circular — tailwind-theme.md muc 4 */}
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-canvas text-primary-dark">
          <Icon name={iconFor(place)} size={20} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="t-body-md-strong block truncate">{place.label}</span>
          {distance ? <span className="t-caption block text-mute">{distance}</span> : null}
          <span className="t-body-sm mt-xxs block truncate text-body">{place.address}</span>
        </span>
      </button>
    </li>
  );
}
