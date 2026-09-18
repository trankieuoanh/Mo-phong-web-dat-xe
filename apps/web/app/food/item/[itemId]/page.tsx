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
import { CUISINE_LABELS, calcFoodTotals, getFoodItem } from '@gsm/shared';
import { BackButton } from '@/components/BackButton';
import { FlowGuard } from '@/components/FlowGuard';
import { FoodThumb } from '@/components/FoodThumb';
import { PrimaryButton } from '@/components/PrimaryButton';
import { QuantityStepper } from '@/components/QuantityStepper';
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
  const { cart, addToCart, food } = useApp();
  const [quantity, setQuantity] = useState(1);

  const item = getFoodItem(itemId)!;
  /** So luong mon nay DA co trong gio, de nguoi dung khong them trung. */
  const inCart = cart.find((line) => line.itemId === itemId)?.quantity ?? 0;

  function changeQuantity(next: number) {
    // QuantityStepper da chan o cham duoi, nhung giu lai lop bao ve nay: hop
    // dong cua ham la "so luong hop le", khong phai "component goi dung".
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
      maxWidth="max-w-[760px]"
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
        <FoodThumb item={item} />

        <div className="flex flex-col">
          <h2 className="t-display-md">{item.name}</h2>
          {/* Ten quan den tu context chu khong tu mon: mot mon co the thuoc
              nhieu quan, va truoc day ngu canh "mon tai X" mat han khi roi man
              menu — man nay va man confirm deu khong hien noi ten quan. */}
          <p className="t-body-sm mt-xxs text-body">
            {food.restaurantName ?? CUISINE_LABELS[item.cuisine]}
          </p>
          <p className="t-body-sm mt-md text-body">{item.description}</p>
          <p className="t-display-sm mt-lg">{formatVnd(item.price)}</p>

          <div className="mt-2xl flex items-center gap-lg">
            <span className="t-body-sm text-body">Số lượng</span>
            <QuantityStepper quantity={quantity} onChange={changeQuantity} label={item.name} />
          </div>

          {inCart > 0 ? (
            <p className="t-caption mt-md text-mute">Đã có {inCart} phần trong giỏ</p>
          ) : null}
        </div>
      </div>
    </ScreenShell>
  );
}
