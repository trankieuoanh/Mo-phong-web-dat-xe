'use client';

/**
 * screen_name: `food_menu` — step 1
 * Event: screen_view, select_item, add_to_cart (them nhanh), back.
 *
 * Luu y `add_to_cart` mang step_index = 3 DU BAN O DAY — no la hanh dong,
 * khong phai man hinh. Dung helper trackAddToCart de khong go nham.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  FOOD_CATEGORIES,
  FOOD_ITEMS,
  calcFoodTotals,
  getFoodItem,
  type FoodCategory,
} from '@gsm/shared';
import { BackButton } from '@/components/BackButton';
import { Icon } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenShell } from '@/components/ScreenShell';
import { useApp } from '@/lib/app-context';
import { formatVnd } from '@/lib/format';
import { trackAddToCart, trackEvent, useScreenView } from '@/lib/track';

export default function FoodMenuPage() {
  useScreenView('food_menu');
  const router = useRouter();
  const { cart, addToCart } = useApp();
  const [category, setCategory] = useState<FoodCategory | 'all'>('all');

  const items = category === 'all' ? FOOD_ITEMS : FOOD_ITEMS.filter((i) => i.category === category);
  const totals = calcFoodTotals(cart, null, getFoodItem);

  function selectItem(id: string, name: string, price: number) {
    trackEvent({
      eventName: 'select_item',
      screenName: 'food_menu',
      properties: { item_id: id, item_name: name, price },
    });
    router.push(`/food/item/${id}`);
  }

  function quickAdd(id: string, name: string, price: number) {
    // Phai copy CA DONG, khong chi copy mang: [...cart] van giu nguyen tham chieu
    // toi object CartLine dang nam trong state, mutate no se lam addToCart ben duoi
    // cong them mot lan nua (so luong tang 2 thay vi 1).
    const nextCart = cart.some((l) => l.itemId === id)
      ? cart.map((l) => (l.itemId === id ? { ...l, quantity: l.quantity + 1 } : l))
      : [...cart, { itemId: id, quantity: 1 }];
    const after = calcFoodTotals(nextCart, null, getFoodItem);

    trackAddToCart('food_menu', {
      item_id: id,
      item_name: name,
      price,
      quantity: 1,
      cart_size_after: after.itemCount,
      cart_total_after: after.cartTotal,
    });
    addToCart(id, 1);
  }

  return (
    <ScreenShell
      variant="wide"
      section="Đặt đồ ăn"
      tabs={['Đặt món', 'Đang diễn ra', 'Đơn đã lưu']}
      title="Đặt đồ ăn"
      leading={<BackButton from="food_menu" to="home" href="/" />}
      footer={
        totals.itemCount > 0 ? (
          <PrimaryButton onClick={() => router.push('/food/cart')}>
            Xem giỏ hàng ({totals.itemCount}) · {formatVnd(totals.cartTotal)}
          </PrimaryButton>
        ) : undefined
      }
    >
      {/* category-button — tailwind-theme.md muc 4 */}
      <div className="mb-lg flex gap-sm overflow-x-auto pb-xxs">
        <CategoryChip active={category === 'all'} onClick={() => setCategory('all')}>
          Tất cả
        </CategoryChip>
        {FOOD_CATEGORIES.map((c) => (
          <CategoryChip
            key={c.id}
            active={category === c.id}
            onClick={() => setCategory(c.id)}
          >
            {c.label}
          </CategoryChip>
        ))}
      </div>

      {/* Luoi nhieu cot — tan dung chieu rong cua web desktop.
          Ban mobile cu la mot cot doc (screen-map.md muc 6). */}
      <ul className="grid gap-md sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-col overflow-hidden rounded-xl bg-canvas-soft transition-colors hover:bg-surface-pressed"
          >
            <button
              type="button"
              onClick={() => selectItem(item.id, item.name, item.price)}
              className="flex flex-1 flex-col p-lg text-left"
            >
              {/* Khung anh 4:3 voi ky tu dau ten mon — khong dung anh that
                  (mock-data.md muc 4, tailwind-theme.md muc 7). */}
              <span className="grid aspect-[4/3] w-full place-items-center rounded-xl bg-canvas">
                <span className="t-display-lg text-primary-dark">{item.name.charAt(0)}</span>
              </span>

              <span className="t-body-md-strong mt-lg block">{item.name}</span>
              <span className="t-body-sm mt-xxs block text-body">{item.restaurant}</span>
            </button>

            <div className="flex items-center justify-between gap-md px-lg pb-lg">
              <span className="t-body-md-strong">{formatVnd(item.price)}</span>
              <button
                type="button"
                aria-label={`Thêm ${item.name} vào giỏ`}
                onClick={() => quickAdd(item.id, item.name, item.price)}
                className="grid size-11 shrink-0 place-items-center rounded-full bg-canvas text-primary-dark transition-colors hover:bg-primary-dark hover:text-on-primary"
              >
                <Icon name="plus" size={20} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </ScreenShell>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`t-body-sm-strong shrink-0 rounded-pill bg-canvas-soft px-lg py-sm text-ink transition-colors hover:bg-surface-pressed ${
        active ? 'ring-2 ring-primary' : ''
      }`}
    >
      {children}
    </button>
  );
}
