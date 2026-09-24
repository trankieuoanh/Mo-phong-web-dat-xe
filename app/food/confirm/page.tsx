'use client';

/**
 * screen_name: `food_confirm` — step 6
 * Event: screen_view, place_order, back.
 *
 * `place_order` la EVENT KET THUC FUNNEL FOOD.
 */

import { useRouter } from 'next/navigation';
import { DEFAULT_PICKUP, calcFoodTotals, getFoodItem, getOffer } from '@gsm/shared';
import { BackButton } from '@/components/BackButton';
import { FlowGuard } from '@/components/FlowGuard';
import { FoodThumb } from '@/components/FoodThumb';
import { Icon } from '@/components/Icon';
import { MapCanvas } from '@/components/MapCanvas';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenShell } from '@/components/ScreenShell';
import { SummaryRow } from '@/components/SummaryRow';
import { useApp } from '@/lib/app-context';
import { formatVnd } from '@/lib/format';
import { trackEvent, useScreenView } from '@/lib/track';

/**
 * Thoi gian giao du kien. HANG SO, va la thanh phan TRANG TRI (food-flow-design.md
 * muc 8): khong co tuyen duong nao duoc tinh cho luong food — quan chi co toa do
 * chu khong co gio nau, va bia ra mot con so "dong" tu khoang cach se trong nhu
 * du lieu that trong khi khong phai.
 */
const ETA_MINUTES = '25–35 phút';

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
  const { cart, offerId, food } = useApp();

  // Man nay co the mo lai o mot tab moi sau khi storage bi xoa — khi do khong
  // co `origin`, va DEFAULT_PICKUP la dia chi mac dinh cua ca app.
  const origin = food.origin ?? DEFAULT_PICKUP;

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
        // Event nay phai TU MO TA DU MOT DON HANG: /history dung lai don tu
        // rieng no, va truoc day bang lich su khong noi duoc don giao di dau.
        // Khong ghi lat/lon — toa do GPS la du lieu vi tri chinh xac, ma phan
        // tich chi can biet co doi dia chi hay khong.
        address_label: origin.label,
        address_source: origin.source,
      },
    });
    router.push('/food/success');
  }

  return (
    <ScreenShell
      variant="wide"
      section="Đặt đồ ăn"
      tabs={['Đặt món', 'Đang diễn ra', 'Đơn đã lưu']}
      maxWidth="max-w-[760px]"
      title="Xác nhận đơn hàng"
      leading={<BackButton from="food_confirm" to="food_offer_selection" href="/food/offer" />}
      footer={<PrimaryButton onClick={placeOrder}>Đặt đơn</PrimaryButton>}
    >
      {/* Giao toi dau — thong tin quan trong nhat cua man xac nhan, va ban cu
          khong he co. `fill={false}` la che do 4:3 cua MapCanvas, dung de nhung
          ban do vao panel `wide` (moi man food deu la `wide` — screen-map.md
          muc 6, nen KHONG duoc doi sang `split` de lay cot ban do). */}
      <div className="rounded-xl bg-canvas-soft p-2xl">
        <div className="flex items-center gap-lg">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-canvas text-primary-dark">
            <Icon name="pin" size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="t-caption block text-mute">Giao tới</span>
            <span className="t-body-md-strong block truncate">{origin.label}</span>
            <span className="t-caption block truncate text-body">{origin.address}</span>
          </span>
        </div>

        <div className="mt-lg overflow-hidden rounded-xl">
          <MapCanvas pickup={origin} label={origin.label} />
        </div>

        <div className="mt-lg flex flex-wrap items-center gap-sm">
          {food.restaurantName ? (
            <span
              aria-hidden="true"
              className="t-body-sm-strong inline-flex items-center gap-sm rounded-pill bg-canvas px-lg py-sm text-body"
            >
              <Icon name="shop" size={16} /> {food.restaurantName}
            </span>
          ) : null}
          <span
            aria-hidden="true"
            className="t-body-sm-strong inline-flex items-center gap-sm rounded-pill bg-canvas px-lg py-sm text-body"
          >
            <Icon name="clock" size={16} /> {ETA_MINUTES}
          </span>
        </div>
      </div>

      <ul className="mt-lg flex flex-col gap-md rounded-xl bg-canvas-soft p-2xl">
        {cart.map((line) => {
          const item = getFoodItem(line.itemId);
          if (!item) return null;
          return (
            <li key={line.itemId} className="flex items-center gap-lg">
              <FoodThumb item={item} variant="tile" className="size-11" />
              <span className="min-w-0 flex-1">
                <span className="t-body-md-strong block truncate">{item.name}</span>
                <span className="t-caption block text-body">
                  {formatVnd(item.price)} × {line.quantity}
                </span>
              </span>
              <span className="t-body-md-strong shrink-0">
                {formatVnd(item.price * line.quantity)}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-lg rounded-xl bg-canvas-soft p-2xl">
        <SummaryRow label="Tiền hàng" value={formatVnd(totals.cartTotal)} />
        <SummaryRow label="Phí giao hàng" value={formatVnd(totals.shippingFee)} />

        {/* Pattern E — chip uu dai. Day la cho DUY NHAT trong app cyan duoc dung
            lam nen mot trang thai tich cuc, va luong food dang thieu no. */}
        <div className="flex items-center justify-between py-xs">
          <span className="t-body-sm text-body">Ưu đãi</span>
          {offer ? (
            <span className="t-body-sm-strong inline-block rounded-pill bg-primary-dark px-lg py-sm text-on-primary">
              {offer.title} · −{formatVnd(totals.discountAmount)}
            </span>
          ) : (
            <span className="t-body-sm-strong inline-block rounded-pill bg-canvas px-lg py-sm text-body">
              Không áp dụng ưu đãi
            </span>
          )}
        </div>

        <SummaryRow label="Tổng cộng" value={formatVnd(totals.finalTotal)} emphasis />
      </div>
    </ScreenShell>
  );
}
