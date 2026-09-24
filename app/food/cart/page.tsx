'use client';

/**
 * screen_name: `food_cart` — step 4
 * Event: screen_view, change_quantity, remove_from_cart, proceed_to_offer, back.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SHIPPING_FEE, calcFoodTotals, getFoodItem } from '@gsm/shared';
import { BackButton } from '@/components/BackButton';
import { EmptyState } from '@/components/EmptyState';
import { FlowGuard } from '@/components/FlowGuard';
import { FoodThumb } from '@/components/FoodThumb';
import { Icon } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { QuantityStepper } from '@/components/QuantityStepper';
import { ScreenShell } from '@/components/ScreenShell';
import { SummaryRow } from '@/components/SummaryRow';
import { useApp } from '@/lib/app-context';
import { formatVnd } from '@/lib/format';
import { trackEvent, useScreenView } from '@/lib/track';

/**
 * Guard chi chan LUC VAO man, khong chan lien tuc — va su phan biet nay la mot
 * quyet dinh ve SO LIEU, khong phai ve giao dien:
 *
 *   - Vao thang `/food/cart` voi gio rong (go tay URL) -> quay ve `/food`.
 *     `useScreenView` nam BEN TRONG `FoodCartContent` nen khong he chay, tuc
 *     khong co `screen_view` nao duoc ban. Giu nguyen hanh vi cu.
 *   - Xoa het mon KHI DANG dung o day -> hien trang thai rong, KHONG day nguoi
 *     dung di. Luc nay `screen_view` cua `food_cart` da ban tu khi mount roi,
 *     nen o lai khong tao them event nao.
 *
 * Bo han guard se lam moi lan go tay URL cung dem mot `screen_view` o buoc 4 va
 * lam sai ti le chuyen doi cua ca luong food.
 */
export default function FoodCartPage() {
  const { cart } = useApp();
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (cart.length > 0) setEntered(true);
  }, [cart.length]);

  return (
    <FlowGuard ready={cart.length > 0 || entered} fallback="/food">
      <FoodCartContent />
    </FlowGuard>
  );
}

function FoodCartContent() {
  useScreenView('food_cart');
  const router = useRouter();
  const { cart, setCartQuantity, removeFromCart } = useApp();

  const totals = calcFoodTotals(cart, null, getFoodItem);
  /** Xoa het mon khi dang o day — xem ghi chu o FoodCartPage ben tren. */
  const empty = cart.length === 0;

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
      footer={empty ? undefined : <PrimaryButton onClick={proceed}>Tiếp tục</PrimaryButton>}
    >
      {empty ? (
        <EmptyState
          icon="bag"
          title="Giỏ hàng đang trống"
          description="Chọn vài món từ thực đơn để tiếp tục đặt đơn."
          action={
            <PrimaryButton fullWidth={false} onClick={() => router.push('/food')}>
              Xem thực đơn
            </PrimaryButton>
          }
        />
      ) : (
        <>
          <ul className="flex flex-col gap-md">
            {cart.map((line) => {
              const item = getFoodItem(line.itemId);
              if (!item) return null;

              return (
                <li
                  key={line.itemId}
                  className="flex items-center gap-lg rounded-xl bg-canvas-soft p-lg"
                >
                  <FoodThumb item={item} variant="tile" />

                  <div className="min-w-0 flex-1">
                    <span className="t-body-md-strong block truncate">{item.name}</span>
                    {/* Don gia — khong co no thi mot dong "70.000d" voi so luong
                        2 buoc nguoi dung tu chia nham. */}
                    <span className="t-caption block text-body">
                      {formatVnd(item.price)} × {line.quantity}
                    </span>
                    <span className="t-body-md-strong mt-xxs block">
                      {formatVnd(item.price * line.quantity)}
                    </span>
                  </div>

                  <QuantityStepper
                    quantity={line.quantity}
                    onChange={(next) => changeQuantity(line.itemId, next)}
                    label={item.name}
                  />

                  <button
                    type="button"
                    aria-label={`Xoá ${item.name}`}
                    onClick={() => remove(line.itemId)}
                    className="grid size-9 shrink-0 place-items-center rounded-full text-mute transition-colors hover:bg-canvas hover:text-ink"
                  >
                    <Icon name="trash" size={20} />
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-2xl rounded-xl bg-canvas-soft p-2xl">
            <SummaryRow label="Tiền hàng" value={formatVnd(totals.cartTotal)} />
            <SummaryRow label="Phí giao hàng" value={formatVnd(SHIPPING_FEE)} />
            {/* Hang tong cong: ban cu dung lai o phi giao hang, tuc gio hang
                khong noi cho nguoi dung biet ho sap tra bao nhieu — trong khi
                moi buoc cua luong ride deu hien gia dang chay. */}
            <SummaryRow
              label="Tổng cộng"
              value={formatVnd(totals.cartTotal + SHIPPING_FEE)}
              emphasis
            />
          </div>
        </>
      )}
    </ScreenShell>
  );
}
