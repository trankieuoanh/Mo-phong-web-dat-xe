'use client';

/**
 * Mot quan an THAT tu OpenStreetMap. Dung o ca dai "Gan ban" lan danh sach ket
 * qua tim theo ten.
 *
 * NUA SO QUAN THAT KHONG CO TAG NAO (do tren mau 120 quan Ha Noi), nen moi dong
 * phu deu duoc phep vang va card phai doc duoc khi chi con moi cai ten. Tuyet
 * doi khong loc bo quan thieu tag — danh sach "gan ban" rong mot cach kho hieu
 * con te hon mot dong thieu ghi chu (api-endpoints.md muc 3b-bis).
 */

import { CUISINE_LABELS, cuisinesOf, roundKm, type Restaurant } from '@/lib/shared';
import { Icon } from '@/components/Icon';

interface RestaurantCardProps {
  restaurant: Restaurant;
  /** Khoang cach tu diem giao, km. Tinh tai cho chu khong luu vao restaurant. */
  distanceKm: number;
  selected: boolean;
  onSelect: () => void;
  /** `strip` = the co dinh trong dai cuon ngang. `row` = hang tran chieu ngang. */
  variant?: 'strip' | 'row';
}

/**
 * Nhan kieu bep de hien thi, suy tu tag `cuisine` THAT cua quan.
 * `undefined` khi quan khong khai bao hoac khai bao gia tri ta khong nhan ra.
 */
function cuisineLabelOf(restaurant: Restaurant): string | undefined {
  const kinds = cuisinesOf(restaurant.cuisine);
  return kinds.length ? kinds.map((kind) => CUISINE_LABELS[kind]).join(', ') : undefined;
}

export function RestaurantCard({
  restaurant,
  distanceKm,
  selected,
  onSelect,
  variant = 'strip',
}: RestaurantCardProps) {
  const cuisine = cuisineLabelOf(restaurant);

  // Ghep bang filter(Boolean) chu khong phai chuoi template: quan thieu tag se
  // khong de lai dau " · " mo coi o cuoi dong.
  const meta = [`${roundKm(distanceKm)} km`, cuisine, restaurant.openingHours]
    .filter((part): part is string => Boolean(part))
    .join(' · ');

  const shape =
    variant === 'strip'
      ? 'w-[calc(100vw-4rem)] max-w-[240px] shrink-0 snap-start flex-col sm:w-[240px]'
      : 'w-full min-w-0 flex-row items-center';

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex min-w-0 gap-lg rounded-xl bg-canvas-soft p-lg text-left text-ink transition-colors hover:bg-surface-pressed active:bg-surface-pressed ${shape} ${
        selected ? 'ring-2 ring-primary' : ''
      }`}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-canvas text-primary-dark">
        <Icon name="shop" size={22} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="t-body-md-strong block truncate">{restaurant.label}</span>
        {/* `meta` khong bao gio rong: khoang cach luon tinh duoc. */}
        <span className="t-caption mt-xxs block truncate text-body">{meta}</span>
      </span>

      {/* Bong tich — Pattern C. Chi `ring-2 ring-primary` thoi thi trang thai da
          chon gan nhu khong thay duoc tren nen `canvas-soft`. */}
      <span
        aria-hidden="true"
        className={`grid size-6 shrink-0 place-items-center self-start rounded-full ${
          selected ? 'bg-primary-dark text-on-primary' : 'bg-canvas'
        }`}
      >
        {selected ? <Icon name="check" size={14} /> : null}
      </span>
    </button>
  );
}
