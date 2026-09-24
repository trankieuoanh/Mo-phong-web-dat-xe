'use client';

/**
 * screen_name: `promo_selection` — step 4
 * Event: screen_view, select_promo, skip_promo, back.
 *
 * Giao dien theo ride-flow-design.md muc 3 "Man 4".
 *
 * THAY DOI HANH VI (muc 7 cua tai lieu do): bam mot promo chi TICK CHON,
 * nut footer moi ban event. Nho vay moi session co dung MOT `select_promo`.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  DEFAULT_PICKUP,
  PROMOS,
  calcDiscount,
  calcFare,
  getVehicle,
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
import { routeOrFallback } from '@/lib/use-route';
import { formatRuleBlock, formatVnd } from '@/lib/format';
import { trackEvent, useScreenView } from '@/lib/track';

export default function PromoPage() {
  const { ride } = useApp();
  return (
    <FlowGuard
      ready={Boolean(ride.destination && ride.vehicleId)}
      fallback="/ride/address"
    >
      <PromoContent />
    </FlowGuard>
  );
}

function PromoContent() {
  useScreenView('promo_selection');
  const router = useRouter();
  const { ride, setRide } = useApp();

  // BAT BUOC dung calcFare, khong doc mot gia co dinh nao: `minOrder` cua promo
  // xet tren SO TIEN THAT cua chuyen. Doc nham la promo bi disable/enable sai.
  const vehicle = getVehicle(ride.vehicleId!);
  const route = routeOrFallback(ride.pickup ?? DEFAULT_PICKUP, ride.destination!, ride.route);
  const basePrice = vehicle ? calcFare(vehicle, route.distanceKm) : 0;

  const [picked, setPicked] = useState<string | null>(ride.promoId ?? null);

  /**
   * Gio dia phuong, cho cac ma "gio vang".
   *
   * Doc trong useEffect chu KHONG luc render: Next prerender client component
   * o server, ma gio server (UTC) lech gio may (UTC+7) — dung cai bay hydration
   * ghi o dau lib/session.ts. Cung khuon voi mealOfHour() o app/food/page.tsx.
   *
   * `undefined` o luot render dau khien ma gio vang hien KHOA, va server lan
   * client deu ve ra cung mot HTML nhu vay. Effect chay xong moi mo khoa.
   */
  const [hour, setHour] = useState<number>();
  useEffect(() => setHour(new Date().getHours()), []);

  /** Boi canh xet dieu kien linh hoat — hang xe, quang duong, gio. */
  const ctx: RuleContext = { vehicleType: vehicle?.type, distanceKm: route.distanceKm, hour };

  /** Go dung ma thi tick promo tuong ung — CHUA ban event. */
  function pickByCode(rule: DiscountRule) {
    setPicked(rule.id);
  }

  function confirmSelection() {
    const promo = PROMOS.find((p) => p.id === picked);
    if (!promo) return;

    trackEvent({
      eventName: 'select_promo',
      screenName: 'promo_selection',
      properties: {
        promo_id: promo.id,
        promo_code: promo.code,
        discount_amount: calcDiscount(promo, basePrice),
      },
    });
    setRide({ promoId: promo.id });
    router.push('/ride/confirm');
  }

  function skipPromo() {
    trackEvent({ eventName: 'skip_promo', screenName: 'promo_selection' });
    // null = da bo qua (khac undefined = chua toi buoc do). screen-map.md muc 3.
    setRide({ promoId: null });
    router.push('/ride/confirm');
  }

  return (
    <ScreenShell
      // Man nay trong spec la mot overlay, khong phai mot buoc co ban do —
      // nen dung panel hep canh giua thay vi bo cuc 2 cot.
      variant="wide"
      section="Di chuyển"
      tabs={['Đặt xe', 'Đang diễn ra']}
      maxWidth="max-w-[600px]"
      title="Ưu đãi"
      leading={
        <BackButton
          from="promo_selection"
          to="vehicle_selection"
          href="/ride/vehicle"
          icon="close"
        />
      }
      footer={
        picked ? (
          <PrimaryButton onClick={confirmSelection}>Áp dụng mã</PrimaryButton>
        ) : (
          <PrimaryButton variant="subtle" onClick={skipPromo}>
            Bỏ qua ưu đãi và tiếp tục
          </PrimaryButton>
        )
      }
    >
      <div aria-hidden="true" className="mb-lg flex gap-sm">
        <span className="t-body-sm-strong rounded-pill bg-canvas-soft px-lg py-sm text-ink ring-2 ring-primary">
          Mã ưu đãi
        </span>
        <span className="t-body-sm-strong rounded-pill bg-canvas-soft px-lg py-sm text-mute">
          VPoint
        </span>
      </div>

      <DiscountCodeInput rules={PROMOS} subtotal={basePrice} ctx={ctx} onApply={pickByCode} />

      <div aria-hidden="true" className="mt-lg flex items-center gap-lg rounded-xl bg-canvas-soft p-2xl">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-canvas text-primary-dark">
          <Icon name="crown" size={22} />
        </span>
        <span className="min-w-0">
          <span className="t-body-md-strong block break-words">Gói hội viên GSM</span>
          <span className="t-body-sm mt-xxs block break-words text-body">
            Ưu đãi mỗi chuyến, huỷ bất cứ lúc nào
          </span>
        </span>
      </div>

      <ul className="mt-lg grid w-full grid-cols-1 gap-md">
        {PROMOS.map((promo) => {
          const block = ruleBlock(promo, basePrice, ctx);
          const available = block === null;
          const discount = calcDiscount(promo, basePrice);

          return (
            <li key={promo.id}>
              <button
                type="button"
                disabled={!available}
                onClick={() => setPicked((prev) => (prev === promo.id ? null : promo.id))}
                className={`flex min-h-12 w-full items-start gap-lg rounded-md bg-canvas-soft p-lg text-left text-ink transition-colors enabled:hover:bg-surface-pressed disabled:cursor-not-allowed disabled:opacity-50 ${
                  promo.id === picked ? 'ring-2 ring-primary' : ''
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="t-body-md-strong block break-words">{promo.title}</span>
                  <span className="t-body-sm mt-xxs block break-words text-body">{promo.description}</span>
                  {/* Hien thi nhung disable, KEM DONG GIAI THICH — nguoi dung thay duoc
                      ly do, va ta khong ghi event cho lua chon bi disable.
                      `formatRuleBlock` noi dung dieu kien nao chua thoa, khong
                      con gan cung "Can don toi thieu" cho moi truong hop. */}
                  <span className="t-caption mt-xxs block break-words text-mute">
                    {block ? formatRuleBlock(block) : `Giảm ${formatVnd(discount)}`}
                  </span>
                </span>

                <span
                  aria-hidden="true"
                  className={`grid size-6 shrink-0 place-items-center rounded-full ${
                    promo.id === picked ? 'bg-primary-dark text-on-primary' : 'bg-canvas'
                  }`}
                >
                  {promo.id === picked ? <Icon name="check" size={14} /> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </ScreenShell>
  );
}
