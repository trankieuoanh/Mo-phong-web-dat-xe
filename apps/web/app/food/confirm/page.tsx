'use client';

/**
 * screen_name: `food_confirm` — step 6
 * Event: screen_view, place_order, back.
 *
 * `place_order` la EVENT KET THUC FUNNEL FOOD.
 */

import { useRouter } from 'next/navigation';
import { calcFoodTotals, getFoodItem, getOffer } from '@gsm/shared';
import { BackButton } from '@/components/BackButton';
import { FlowGuard } from '@/components/FlowGuard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenShell } from '@/components/ScreenShell';
import { useApp } from '@/lib/app-context';
import { formatVnd } from '@/lib/format';
import { trackEvent, useScreenView } from '@/lib/track';

export default function FoodConfirmPage() {
  const { cart, offerId } = useApp();
  return (
    <FlowGuard ready={cart.length > 0 && offerId !== undefined} fallback="/food">
      <FoodConfirmContent />
    </FlowGuard>
  );
}

function FoodConfirmContent() {
  useScreenView('food_confirm');
  const router = useRouter();
  const { cart, offerId } = useApp();

  const offer = offerId ? (getOffer(offerId) ?? null) : null;
  // Cung mot ham voi luc ghi event — `final_total` trong event LUON khop
  // con so hien tren man hinh.
  const totals = calcFoodTotals(cart, offer, getFoodItem);

  function placeOrder() {
    trackEvent({
      eventName: 'place_order',
      screenName: 'food_confirm',
      properties: {
        item_count: totals.itemCount,
        cart_total: totals.cartTotal,
        shipping_fee: totals.shippingFee,
        offer_id: offerId ?? null,
        discount_amount: totals.discountAmount,
        final_total: totals.finalTotal,
      },
    });
    router.push('/food/success');
  }

  return (
    <ScreenShell
      variant="wide"
      section="Đặt đồ ăn"
      tabs={['Đặt món', 'Đang diễn ra', 'Đơn đã lưu']}
      maxWidth="max-w-[600px]"
      title="Xác nhận đơn hàng"
      leading={<BackButton from="food_confirm" to="food_offer_selection" href="/food/offer" />}
      footer={<PrimaryButton onClick={placeOrder}>Đặt đơn</PrimaryButton>}
    >
      <ul className="rounded-xl bg-canvas-soft p-2xl">
        {cart.map((line) => {
          const item = getFoodItem(line.itemId);
          if (!item) return null;
          return (
            <li key={line.itemId} className="flex items-center justify-between py-xs">
              <span className="t-body-sm text-body">
                {item.name} × {line.quantity}
              </span>
              <span className="t-body-md-strong">{formatVnd(item.price * line.quantity)}</span>
            </li>
          );
        })}
      </ul>

      <div className="mt-lg rounded-xl bg-canvas-soft p-2xl">
        <Row label="Tiền hàng" value={formatVnd(totals.cartTotal)} />
        <Row label="Phí giao hàng" value={formatVnd(totals.shippingFee)} />
        <Row
          label="Ưu đãi"
          value={offer ? `− ${formatVnd(totals.discountAmount)}` : 'Không áp dụng'}
        />

        <div className="mt-lg flex items-center justify-between border-t border-canvas pt-lg">
          <span className="t-body-md-strong">Tổng cộng</span>
          <span className="t-display-sm">{formatVnd(totals.finalTotal)}</span>
        </div>
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
