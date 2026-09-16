'use client';

/**
 * screen_name: `food_cart` — step 4
 * Event: screen_view, change_quantity, remove_from_cart, proceed_to_offer, back.
 */

import { useRouter } from 'next/navigation';
import { SHIPPING_FEE, calcFoodTotals, getFoodItem } from '@gsm/shared';
import { BackButton } from '@/components/BackButton';
import { FlowGuard } from '@/components/FlowGuard';
import { Icon } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenShell } from '@/components/ScreenShell';
import { useApp } from '@/lib/app-context';
import { formatVnd } from '@/lib/format';
import { trackEvent, useScreenView } from '@/lib/track';

export default function FoodCartPage() {
  const { cart } = useApp();
  return (
    <FlowGuard ready={cart.length > 0} fallback="/food">
      <FoodCartContent />
    </FlowGuard>
  );
}

function FoodCartContent() {
  useScreenView('food_cart');
  const router = useRouter();
  const { cart, setCartQuantity, removeFromCart } = useApp();

  const totals = calcFoodTotals(cart, null, getFoodItem);

  function changeQuantity(itemId: string, next: number) {
    if (next < 1) return;
    const nextCart = cart.map((l) => (l.itemId === itemId ? { ...l, quantity: next } : l));
    const after = calcFoodTotals(nextCart, null, getFoodItem);

    trackEvent({
      eventName: 'change_quantity',
      screenName: 'food_cart',
      properties: { item_id: itemId, quantity: next, cart_total_after: after.cartTotal },
    });
    setCartQuantity(itemId, next);
  }

  function remove(itemId: string) {
    const line = cart.find((l) => l.itemId === itemId);
    const item = getFoodItem(itemId);
    const nextCart = cart.filter((l) => l.itemId !== itemId);
    const after = calcFoodTotals(nextCart, null, getFoodItem);

    trackEvent({
      eventName: 'remove_from_cart',
      screenName: 'food_cart',
      properties: {
        item_id: itemId,
        item_name: item?.name,
        quantity_removed: line?.quantity ?? 0,
        cart_size_after: after.itemCount,
        cart_total_after: after.cartTotal,
      },
    });
    removeFromCart(itemId);
  }

  function proceed() {
    trackEvent({
      eventName: 'proceed_to_offer',
      screenName: 'food_cart',
      properties: { cart_size: totals.itemCount, cart_total: totals.cartTotal },
    });
    router.push('/food/offer');
  }

  return (
    <ScreenShell
      variant="wide"
      section="Đặt đồ ăn"
      tabs={['Đặt món', 'Đang diễn ra', 'Đơn đã lưu']}
      maxWidth="max-w-[760px]"
      title="Giỏ hàng"
      leading={<BackButton from="food_cart" to="food_menu" href="/food" />}
      footer={<PrimaryButton onClick={proceed}>Tiếp tục</PrimaryButton>}
    >
      <ul className="flex flex-col gap-md">
        {cart.map((line) => {
          const item = getFoodItem(line.itemId);
          if (!item) return null;

          return (
            <li
              key={line.itemId}
              className="flex items-center gap-lg rounded-md bg-canvas-soft p-lg"
            >
              <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-canvas">
                <span className="t-display-sm text-primary-dark">{item.name.charAt(0)}</span>
              </span>

              <div className="min-w-0 flex-1">
                <span className="t-body-md-strong block truncate">{item.name}</span>
                <span className="t-body-md-strong mt-xxs block">
                  {formatVnd(item.price * line.quantity)}
                </span>
              </div>

              <div className="flex items-center gap-sm">
                <QtyButton
                  label="Giảm số lượng"
                  icon="minus"
                  onClick={() => changeQuantity(line.itemId, line.quantity - 1)}
                />
                <span className="t-body-md-strong w-5 text-center">{line.quantity}</span>
                <QtyButton
                  label="Tăng số lượng"
                  icon="plus"
                  onClick={() => changeQuantity(line.itemId, line.quantity + 1)}
                />
              </div>

              <button
                type="button"
                aria-label={`Xoá ${item.name}`}
                onClick={() => remove(line.itemId)}
                className="grid size-11 shrink-0 place-items-center rounded-full text-mute transition-colors hover:bg-canvas hover:text-ink"
              >
                <Icon name="trash" size={20} />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-2xl rounded-xl bg-canvas-soft p-2xl">
        <Row label="Tiền hàng" value={formatVnd(totals.cartTotal)} />
        <Row label="Phí giao hàng" value={formatVnd(SHIPPING_FEE)} />
      </div>
    </ScreenShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-xs">
      <span className="t-body-sm text-body">{label}</span>
      <span className="t-body-md-strong">{value}</span>
    </div>
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
      className="grid size-11 place-items-center rounded-full bg-canvas text-ink transition-colors hover:bg-surface-pressed"
    >
      <Icon name={icon} size={20} />
    </button>
  );
}
