'use client';

/**
 * Nut gio hang + so luong, o thanh tren cung. CHI hien trong luong food.
 *
 * VI SAO TON TAI: truoc day ca app khong co mot bieu tuong gio hang nao, va loi
 * duy nhat vao `/food/cart` la nut o day panel man menu — ma man menu cuon ca
 * trang, nen nut do nam duoi hang nghin pixel the mon. Roi khoi `/food` la gio
 * hang khong con cach nao mo lai. Nguoi dung ket luan "app khong co gio hang",
 * va voi nhung gi nhin thay duoc thi ket luan do dung.
 *
 * KHONG BAN EVENT NAO. Day la dieu huong trong luong, khong phai mot buoc
 * funnel: `food_cart` da co `screen_view` cua chinh no, va them mot event o day
 * se dem trung.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { calcFoodTotals, getFoodItem } from '@gsm/shared';
import { Icon } from '@/components/Icon';
import { useApp } from '@/lib/app-context';

export function CartButton() {
  const pathname = usePathname();
  const { cart } = useApp();

  // Chi thuoc luong food. O luong ride mot cai gio hang la vo nghia.
  if (!pathname.startsWith('/food')) return null;

  // Dung CUNG phep tinh voi nut o day panel, de hai con so khong bao gio lech.
  const { itemCount } = calcFoodTotals(cart, null, getFoodItem);

  return (
    <Link
      href="/food/cart"
      aria-label={
        itemCount > 0 ? `Giỏ hàng, ${itemCount} món` : 'Giỏ hàng, chưa có món nào'
      }
      className="relative grid size-11 shrink-0 place-items-center rounded-full text-ink transition-colors hover:bg-canvas-soft"
    >
      <Icon name="bag" size={22} />

      {itemCount > 0 ? (
        <span className="t-caption absolute -right-xxs -top-xxs grid min-w-5 place-items-center rounded-pill bg-primary-dark px-xxs font-bold text-on-primary">
          {itemCount}
        </span>
      ) : null}
    </Link>
  );
}
