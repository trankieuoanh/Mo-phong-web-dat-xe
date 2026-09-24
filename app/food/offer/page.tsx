'use client';

/**
 * screen_name: `food_offer_selection` — step 5
 * Event: screen_view, select_offer, skip_offer, back.
 *
 * Uu dai ap len TIEN HANG (cart_total), khong ap len phi giao — tru
 * `offer-freeship` von giam dung bang SHIPPING_FEE (mock-data.md muc 5, 6).
 *
 * TICK ROI XAC NHAN, khong phai bam-la-di. Bam mot uu dai chi doi trang thai
 * tai cho; `select_offer` ban khi bam nut o footer — dung mo hinh `select_promo`
 * cua /ride/promo. Hai cai duoc:
 *
 *   1. Moi phien co DUNG MOT `select_offer`. Ban cu ban ngay luc bam roi dieu
 *      huong, nen quay lai chon lai la sinh them mot event nua, va phan tich
 *      phai tu doan cai nao moi la lua chon cuoi.
 *   2. Trang thai da chon thuc su nhin thay duoc. Truoc day `ring-2 ring-primary`
 *      gan nhu khong bao gio hien ra vi man hinh chuyen ngay khi bam.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  OFFERS,
  SHIPPING_FEE,
  calcDiscount,
  calcFoodTotals,
  getFoodItem,
  ruleBlock,
  type DiscountRule,
  type RuleContext,
} from '@/lib/shared';
import { BackButton } from '@/components/BackButton';
import { DiscountCodeInput } from '@/components/DiscountCodeInput';
import { FlowGuard } from '@/components/FlowGuard';
import { Icon } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenShell } from '@/components/ScreenShell';
import { useApp } from '@/lib/app-context';
import { formatRuleBlock, formatVnd } from '@/lib/format';
import { trackEvent, useScreenView } from '@/lib/track';

/**
 * Guard chi chan LUC VAO man — cung khuon voi `/food/cart`.
 *
 * Truoc day man nay thieu chot `entered`, nen no hanh xu khac han man gio hang
 * ngay canh no: xoa het mon o gio hang thi duoc o lai va thay trang thai rong,
 * con o day thi bi day ve `/food` giua chung. Hai man lien nhau trong cung mot
 * luong khong nen phan ung khac nhau truoc cung mot thay doi.
 */
export default function FoodOfferPage() {
  const { cart } = useApp();
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (cart.length > 0) setEntered(true);
  }, [cart.length]);

  return (
    <FlowGuard ready={cart.length > 0 || entered} fallback="/food">
      <FoodOfferContent />
    </FlowGuard>
  );
}

function FoodOfferContent() {
  useScreenView('food_offer_selection');
  const router = useRouter();
  const { cart, offerId, setOfferId } = useApp();

  const { cartTotal } = calcFoodTotals(cart, null, getFoodItem);

  /**
   * Lua chon tam, CHUA ghi vao context va chua ban event. Khoi tao tu `offerId`
   * de quay lai man nay van thay uu dai da chon truoc do.
   */
  const [picked, setPicked] = useState<string | null>(offerId ?? null);

  /**
   * Gio dia phuong, cho cac uu dai theo khung gio (bua sang, an khuya).
   *
   * Doc trong useEffect chu KHONG luc render — cung ly do va cung khuon voi
   * mealOfHour() o app/food/page.tsx: gio server (UTC) lech gio may (UTC+7)
   * nen doc luc render la mot hydration mismatch.
   */
  const [hour, setHour] = useState<number>();
  useEffect(() => setHour(new Date().getHours()), []);

  /** Luong food khong co hang xe lan quang duong — chi co gio. */
  const ctx: RuleContext = { hour };

  /** Go dung ma thi tick uu dai tuong ung — CHUA ban event. */
  function pickByCode(rule: DiscountRule) {
    setPicked(rule.id);
  }

  function applyOffer() {
    const offer = OFFERS.find((o) => o.id === picked);
    if (!offer) return;

    trackEvent({
      eventName: 'select_offer',
      screenName: 'food_offer_selection',
      properties: {
        offer_id: offer.id,
        offer_code: offer.code,
        // SHIPPING_FEE di kem: uu dai `appliesTo: 'shipping'` giam tren phi
        // giao. Con so nay PHAI trung voi so hien o day, o /food/confirm va
        // trong `place_order` — xem ghi chu dau calcDiscount().
        discount_amount: calcDiscount(offer, cartTotal, SHIPPING_FEE),
      },
    });
    setOfferId(offer.id);
    router.push('/food/confirm');
  }

  function skipOffer() {
    trackEvent({ eventName: 'skip_offer', screenName: 'food_offer_selection' });
    setOfferId(null);
    router.push('/food/confirm');
  }

  return (
    <ScreenShell
      variant="wide"
      section="Đặt đồ ăn"
      tabs={['Đặt món', 'Đang diễn ra', 'Đơn đã lưu']}
      maxWidth="max-w-[760px]"
      title="Chọn ưu đãi"
      leading={
        <span className="[&_button]:size-11">
          <BackButton from="food_offer_selection" to="food_cart" href="/food/cart" />
        </span>
      }
      /* Pattern M — footer doi vai tro theo viec da tick hay chua. Ban cu chi co
         mot nut "Bo qua" dang `subtle`, nen buoc nay la man duy nhat trong ca
         app khong co hanh dong chinh o footer. */
      footer={
        picked ? (
          <PrimaryButton onClick={applyOffer}>Áp dụng ưu đãi</PrimaryButton>
        ) : (
          <PrimaryButton variant="subtle" onClick={skipOffer}>
            Bỏ qua ưu đãi và tiếp tục
          </PrimaryButton>
        )
      }
    >
      {/* O nhap ma — dua luong food ve ngang voi /ride/promo. Truoc day chi
          luong ride co, nen `offer_usage` va `promo_usage` khong so sanh duoc
          voi nhau vi mot ben thieu han mot cach tuong tac. */}
      <div className="mb-lg [&>div]:flex-wrap">
        <DiscountCodeInput rules={OFFERS} subtotal={cartTotal} ctx={ctx} onApply={pickByCode} />
      </div>

      <ul className="grid grid-cols-1 gap-md">
        {OFFERS.map((offer) => {
          const block = ruleBlock(offer, cartTotal, ctx);
          const available = block === null;
          const discount = calcDiscount(offer, cartTotal, SHIPPING_FEE);
          const selected = offer.id === picked;

          return (
            <li key={offer.id}>
              <button
                type="button"
                disabled={!available}
                aria-pressed={selected}
                onClick={() => setPicked(selected ? null : offer.id)}
                className={`flex min-h-12 w-full items-center gap-lg rounded-xl bg-canvas-soft p-lg text-left text-ink transition-colors enabled:hover:bg-surface-pressed enabled:active:bg-surface-pressed disabled:cursor-not-allowed disabled:opacity-50 ${
                  selected ? 'ring-2 ring-primary' : ''
                }`}
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-canvas text-primary-dark">
                  <Icon name="ticket" size={22} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="t-body-md-strong block">{offer.title}</span>
                  <span className="t-body-sm mt-xxs block text-body">{offer.description}</span>
                  {/* `formatRuleBlock` noi dung dieu kien nao chua thoa — gio,
                      don toi thieu... — chu khong gan cung mot cau cho moi ca. */}
                  <span className="t-caption mt-xxs block text-mute">
                    {block ? formatRuleBlock(block) : `Giảm ${formatVnd(discount)}`}
                  </span>
                </span>

                {/* Pattern C — bong tich. Uu dai khong du dieu kien khong co o
                    nay: `opacity-50` cong dong ly do o tren da noi du. */}
                {available ? (
                  <span
                    aria-hidden="true"
                    className={`grid size-6 shrink-0 place-items-center rounded-full ${
                      selected ? 'bg-primary-dark text-on-primary' : 'bg-canvas'
                    }`}
                  >
                    {selected ? <Icon name="check" size={14} /> : null}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </ScreenShell>
  );
}
