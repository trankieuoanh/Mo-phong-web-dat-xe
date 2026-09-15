'use client';

/**
 * screen_name: `promo_selection` — step 4
 * Event: screen_view, select_promo, skip_promo, back.
 *
 * `discount_amount` la SO TIEN GIAM THUC TE (VND), khong phai phan tram —
 * de pandas cong truc tiep (event-taxonomy.md muc 3).
 */

import { useRouter } from 'next/navigation';
import { PROMOS, calcDiscount, getVehicle, isRuleAvailable } from '@gsm/shared';
import { BackButton } from '@/components/BackButton';
import { FlowGuard } from '@/components/FlowGuard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenShell } from '@/components/ScreenShell';
import { useApp } from '@/lib/app-context';
import { formatVnd } from '@/lib/format';
import { trackEvent, useScreenView } from '@/lib/track';

export default function PromoPage() {
  const { ride } = useApp();
  return (
    <FlowGuard
      ready={Boolean(ride.addressId && ride.vehicleId)}
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

  const basePrice = getVehicle(ride.vehicleId!)?.basePrice ?? 0;

  function selectPromo(id: string, code: string, discountAmount: number) {
    trackEvent({
      eventName: 'select_promo',
      screenName: 'promo_selection',
      properties: { promo_id: id, promo_code: code, discount_amount: discountAmount },
    });
    setRide({ promoId: id });
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
      title="Chọn khuyến mãi"
      leading={<BackButton from="promo_selection" to="vehicle_selection" href="/ride/vehicle" />}
      footer={
        <PrimaryButton variant="subtle" onClick={skipPromo}>
          Bỏ qua
        </PrimaryButton>
      }
    >
      <ul className="flex flex-col gap-md">
        {PROMOS.map((promo) => {
          const available = isRuleAvailable(promo, basePrice);
          const discount = calcDiscount(promo, basePrice);

          return (
            <li key={promo.id}>
              <button
                type="button"
                disabled={!available}
                onClick={() => selectPromo(promo.id, promo.code, discount)}
                className="w-full rounded-md bg-canvas-soft p-lg text-left text-ink active:bg-surface-pressed disabled:cursor-not-allowed disabled:opacity-50"
              >
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
              </button>
            </li>
          );
        })}
      </ul>
    </ScreenShell>
  );
}
