'use client';

/**
 * Khung anh mon an. Nguon: food-flow-design.md muc 6, tailwind-theme.md muc 7.
 *
 * Du an KHONG dung anh that (mock-data.md muc 4) va khong di kem file anh nao.
 * Bo bien phap cu — mot o `bg-canvas-soft` voi chu cai dau — dung, nhung 29 mon
 * ra 29 o gan nhu giong het nhau, va do la thu lam ca luoi trong nhu ban nhap.
 *
 * Thay bang: nen chuyen sac giua HAI token da co (`canvas-soft` -> `surface-pressed`,
 * khong sinh gia tri moi — CLAUDE.md quy tac 4), mot glyph theo KIEU BEP, va chu
 * cai dau lam lop nen mo. Cung kieu bep thi cung glyph, nen luoi doc duoc theo
 * nhom ngay ca khi chua kip doc ten.
 *
 * Co `item.image` thi uu tien anh that. Dung the <img> thuong chu khong phai
 * next/image, cung lua chon da ghi o MapCanvas.tsx.
 */

import type { Cuisine, FoodItem } from '@/lib/shared';
import { Icon, type IconName } from '@/components/Icon';

/**
 * 9 kieu bep -> 6 glyph. Co mon trung glyph la CO Y: ve du 9 hinh khac nhau
 * tren luoi 24px se cho ra nhung hinh khong con phan biet duoc voi nhau o co
 * thuc te tren the mon.
 */
const CUISINE_ICONS: Record<Cuisine, IconName> = {
  vietnamese: 'bowl',
  japanese: 'bowl',
  korean: 'bowl',
  grill: 'grill',
  pizza: 'pizza',
  american: 'grill',
  seafood: 'fish',
  cafe: 'cup',
  dessert: 'cake',
};

interface FoodThumbProps {
  item: FoodItem;
  /** `tile` = o vuong nho trong hang gio hang. `cover` = khung 4:3 tren the mon. */
  variant?: 'cover' | 'tile';
  className?: string;
}

export function FoodThumb({ item, variant = 'cover', className }: FoodThumbProps) {
  const shape = variant === 'cover' ? 'aspect-[4/3] w-full' : 'size-14 shrink-0';
  const glyphSize = variant === 'cover' ? 40 : 22;

  if (item.image) {
    return (
      // Dung the <img> tho chu KHONG dung next/image, cung lua chon da ghi o
      // MapCanvas.tsx: anh nam san trong public/, khong qua loader nao.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.image}
        // Ten mon da nam ngay canh anh trong moi bo cuc dang dung, nen alt rong
        // la dung: doc lai lan nua chi lam trinh doc man hinh dai dong hon.
        alt=""
        className={`${shape} rounded-xl object-cover ${className ?? ''}`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`relative grid place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-canvas-soft to-surface-pressed ${shape} ${className ?? ''}`}
    >
      {/* Chu cai dau lam nen: du de hai mon cung kieu bep khong giong het nhau,
          du mo de khong tranh cho voi ten mon ngay ben duoi. */}
      <span
        className={`absolute font-bold text-canvas ${
          variant === 'cover' ? 'text-[64px] leading-none' : 'text-[28px] leading-none'
        }`}
      >
        {item.name.charAt(0)}
      </span>
      <Icon name={CUISINE_ICONS[item.cuisine]} size={glyphSize} className="relative text-primary-dark" />
    </span>
  );
}
