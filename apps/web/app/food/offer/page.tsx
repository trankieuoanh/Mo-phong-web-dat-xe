'use client';

/**
 * screen_name: `food_offer_selection` — step 5
 * Event: screen_view, select_offer, skip_offer, back.
 *
 * Uu dai ap len TIEN HANG (cart_total), khong ap len phi giao — tru
 * `offer-freeship` von giam dung bang SHIPPING_FEE (mock-data.md muc 5, 6).
 */

import { useRouter } from 'next/navigation';
import { OFFERS, calcDiscount, calcFoodTotals, getFoodItem, isRuleAvailable } from '@gsm/shared';
import { BackButton } from '@/components/BackButton';
import { FlowGuard } from '@/components/FlowGuard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenShell } from '@/components/ScreenShell';
import { useApp } from '@/lib/app-context';
import { formatVnd } from '@/lib/format';
import { trackEvent, useScreenView } from '@/lib/track';

export default function FoodOfferPage() {
  const { cart } = useApp();
  return (
    <FlowGuard ready={cart.length > 0} fallback="/food">
      <FoodOfferContent />
    </FlowGuard>
  );
}

function FoodOfferContent() {
  useScreenView('food_offer_selection');
  const router = useRouter();
  const { cart, setOfferId } = useApp();

  const { cartTotal } = calcFoodTotals(cart, null, getFoodItem);

  function selectOffer(id: string, code: string, discountAmount: number) {
    trackEvent({
      eventName: 'select_offer',
      screenName: 'food_offer_selection',
      properties: { offer_id: id, offer_code: code, discount_amount: discountAmount },
    });
    setOfferId(id);
    router.push('/food/confirm');
  }

  function skipOffer() {
    trackEvent({ eventName: 'skip_offer', screenName: 'food_offer_selection' });
    setOfferId(null);
    router.push('/food/confirm');
  }

  return (
    <ScreenShell
      title="Chọn ưu đãi"
      leading={<BackButton from="food_offer_selection" to="food_cart" href="/food/cart" />}
      footer={
        <PrimaryButton variant="subtle" onClick={skipOffer}>
          Bỏ qua
        </PrimaryButton>
      }
    >
      <ul className="flex flex-col gap-md">
        {OFFERS.map((offer) => {
          const available = isRuleAvailable(offer, cartTotal);
          const discount = calcDiscount(offer, cartTotal);

          return (
            <li key={offer.id}>
              <button
                type="button"
                disabled={!available}
                onClick={() => selectOffer(offer.id, offer.code, discount)}
                className="w-full rounded-md bg-canvas-soft p-lg text-left text-ink active:bg-surface-pressed disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="t-body-md-strong block">{offer.title}</span>
                <span className="t-body-sm mt-xxs block text-body">{offer.description}</span>
                <span className="t-caption mt-xxs block text-mute">
                  {available
                    ? `Giảm ${formatVnd(discount)}`
                    : `Cần đơn tối thiểu ${formatVnd(offer.minOrder)}`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </ScreenShell>
  );
}
