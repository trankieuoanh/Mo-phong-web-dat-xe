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
import { useState } from 'react';
import { DEFAULT_PICKUP, PROMOS, calcDiscount, calcFare, getVehicle, isRuleAvailable } from '@gsm/shared';
import { BackButton } from '@/components/BackButton';
import { FlowGuard } from '@/components/FlowGuard';
import { Icon } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenShell } from '@/components/ScreenShell';
import { useApp } from '@/lib/app-context';
import { routeOrFallback } from '@/lib/use-route';
import { formatVnd } from '@/lib/format';
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
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');

  /** Go dung `code` thi tick promo tuong ung — CHUA ban event. */
  function applyCode() {
    const typed = code.trim().toUpperCase();
    const found = PROMOS.find((p) => p.code.toUpperCase() === typed);

    if (!found) {
      setCodeError('Mã không hợp lệ');
      return;
    }
    if (!isRuleAvailable(found, basePrice)) {
      setCodeError(`Cần đơn tối thiểu ${formatVnd(found.minOrder)}`);
      return;
    }
    setCodeError('');
    setPicked(found.id);
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

      <div className="flex items-center gap-md">
        <input
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setCodeError('');
          }}
          placeholder="Bạn có mã ưu đãi? Nhập tại đây."
          aria-label="Mã ưu đãi"
          className="t-body-md min-w-0 flex-1 rounded-md bg-canvas-soft p-lg text-ink outline-none placeholder:text-mute"
        />
        <PrimaryButton variant="subtle" fullWidth={false} onClick={applyCode}>
          Áp dụng
        </PrimaryButton>
      </div>
      {codeError ? <p className="t-caption mt-xs text-mute">{codeError}</p> : null}

      <div aria-hidden="true" className="mt-lg flex items-center gap-lg rounded-xl bg-canvas-soft p-2xl">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-canvas text-primary-dark">
          <Icon name="crown" size={22} />
        </span>
        <span>
          <span className="t-body-md-strong block">Gói hội viên GSM</span>
          <span className="t-body-sm mt-xxs block text-body">
            Ưu đãi mỗi chuyến, huỷ bất cứ lúc nào
          </span>
        </span>
      </div>

      <ul className="mt-lg flex flex-col gap-md">
        {PROMOS.map((promo) => {
          const available = isRuleAvailable(promo, basePrice);
          const discount = calcDiscount(promo, basePrice);

          return (
            <li key={promo.id}>
              <button
                type="button"
                disabled={!available}
                onClick={() => {
                  setPicked((prev) => (prev === promo.id ? null : promo.id));
                  setCodeError('');
                }}
                className={`flex w-full items-center gap-lg rounded-md bg-canvas-soft p-lg text-left text-ink transition-colors enabled:hover:bg-surface-pressed disabled:cursor-not-allowed disabled:opacity-50 ${
                  promo.id === picked ? 'ring-2 ring-primary' : ''
                }`}
              >
                <span className="flex-1">
                  <span className="t-body-md-strong block">{promo.title}</span>
                  <span className="t-body-sm mt-xxs block text-body">{promo.description}</span>
                  {available ? (
                    <span className="t-caption mt-xxs block text-mute">
                      Giảm {formatVnd(discount)}
                    </span>
                  ) : (
                    // Hien thi nhung disable, KEM DONG GIAI THICH — nguoi dung thay duoc
                    // ly do, va ta khong ghi event cho lua chon bi disable.
                    <span className="t-caption mt-xxs block text-mute">
                      Cần đơn tối thiểu {formatVnd(promo.minOrder)}
                    </span>
                  )}
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
