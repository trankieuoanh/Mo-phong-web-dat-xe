'use client';

/**
 * screen_name: `food_item_detail` — step 2
 * Event: screen_view, change_quantity, add_to_cart, back.
 *
 * `add_to_cart` van mang step_index = 3 (hanh dong, khong phai man hinh).
 * "So nguoi xem mon" vs "so nguoi thuc su them vao gio" la hai moc funnel
 * khac nhau va can tach duoc — event-taxonomy.md muc 2.
 */

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { calcFoodTotals, getFoodItem } from '@gsm/shared';
import { BackButton } from '@/components/BackButton';
import { FlowGuard } from '@/components/FlowGuard';
import { Icon } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenShell } from '@/components/ScreenShell';
import { useApp } from '@/lib/app-context';
import { formatVnd } from '@/lib/format';
import { trackAddToCart, trackEvent, useScreenView } from '@/lib/track';

export default function FoodItemPage() {
  const params = useParams<{ itemId: string }>();
  const item = getFoodItem(params.itemId);

  // id khong ton tai (go tay URL) -> quay ve menu, khong ban event nao.
  return (
    <FlowGuard ready={Boolean(item)} fallback="/food">
      <FoodItemContent itemId={params.itemId} />
    </FlowGuard>
  );
}

function FoodItemContent({ itemId }: { itemId: string }) {
  useScreenView('food_item_detail');
  const router = useRouter();
  const { cart, addToCart } = useApp();
  const [quantity, setQuantity] = useState(1);

  const item = getFoodItem(itemId)!;

  function changeQuantity(next: number) {
    if (next < 1) return;
    setQuantity(next);
    trackEvent({
      eventName: 'change_quantity',
      screenName: 'food_item_detail',
      properties: { item_id: itemId, quantity: next },
    });
  }

  function handleAddToCart() {
    // Copy ca dong — xem ghi chu cung loi o app/food/page.tsx.
    const nextCart = cart.some((l) => l.itemId === itemId)
      ? cart.map((l) => (l.itemId === itemId ? { ...l, quantity: l.quantity + quantity } : l))
      : [...cart, { itemId, quantity }];
    const after = calcFoodTotals(nextCart, null, getFoodItem);

    trackAddToCart('food_item_detail', {
      item_id: itemId,
      item_name: item.name,
      price: item.price,
      quantity,
      // cart_size_after = tong SO LUONG mon, khong phai so dong.
      cart_size_after: after.itemCount,
      // cart_total_after = tien hang, CHUA gom phi giao va uu dai.
      cart_total_after: after.cartTotal,
    });

    addToCart(itemId, quantity);
    router.push('/food/cart');
  }

  return (
    <ScreenShell
      variant="wide"
      section="Đặt đồ ăn"
      tabs={['Đặt món', 'Đang diễn ra', 'Đơn đã lưu']}
      maxWidth="max-w-[880px]"
      title={item.name}
      leading={<BackButton from="food_item_detail" to="food_menu" href="/food" />}
      footer={
        <PrimaryButton onClick={handleAddToCart}>
          Thêm vào giỏ · {formatVnd(item.price * quantity)}
        </PrimaryButton>
      }
    >
      {/* Hai cot tren desktop: khung anh trai, thong tin phai. */}
      <div className="grid gap-2xl md:grid-cols-2">
        <div className="grid aspect-[4/3] w-full place-items-center rounded-xl bg-canvas-soft">
          <span className="t-display-xl text-primary-dark">{item.name.charAt(0)}</span>
        </div>

        <div className="flex flex-col">
          <h2 className="t-display-md">{item.name}</h2>
          <p className="t-body-sm mt-xxs text-body">{item.restaurant}</p>
          <p className="t-body-sm mt-md text-body">{item.description}</p>
          <p className="t-display-sm mt-lg">{formatVnd(item.price)}</p>

          <div className="mt-2xl flex items-center gap-lg">
            <span className="t-body-sm text-body">Số lượng</span>
            <div className="flex items-center gap-md">
              <QtyButton label="Giảm số lượng" icon="minus" onClick={() => changeQuantity(quantity - 1)} />
              <span className="t-body-md-strong w-6 text-center">{quantity}</span>
              <QtyButton label="Tăng số lượng" icon="plus" onClick={() => changeQuantity(quantity + 1)} />
            </div>
          </div>
        </div>
      </div>
    </ScreenShell>
  );
}

function QtyButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: 'plus' | 'minus';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-11 place-items-center rounded-full bg-canvas-soft text-ink transition-colors hover:bg-surface-pressed"
    >
      <Icon name={icon} size={20} />
    </button>
  );
}
