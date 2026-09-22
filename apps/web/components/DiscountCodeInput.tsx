'use client';

/**
 * O nhap ma uu dai. Dung chung cho ca `promo_selection` (luong ride) lan
 * `food_offer_selection` (luong food), nen hai cho khong the lech nhau ve
 * hanh vi — cung tinh than voi PlacePicker.
 *
 * KHONG BAN EVENT NAO. Go mot ma chua phai mot lua chon: `select_promo` /
 * `select_offer` van chi ban o nut footer, va nho vay moi phien co DUNG MOT
 * event do du nguoi dung go di go lai bao nhieu lan
 * (ride-flow-design.md muc 7, food-flow-design.md muc 7).
 *
 * `onApply` chi TICK CHON o component cha; cha quyet dinh lam gi tiep.
 */

import { useState } from 'react';
import { ruleBlock, type DiscountRule, type RuleContext } from '@gsm/shared';
import { PrimaryButton } from '@/components/PrimaryButton';
import { formatRuleBlock } from '@/lib/format';

interface DiscountCodeInputProps {
  /** PROMOS hoac OFFERS. */
  rules: DiscountRule[];
  /** Gia chuyen (ride) hoac tien hang (food) — de xet `minOrder`. */
  subtotal: number;
  /** Boi canh xet dieu kien linh hoat. Luong food khong truyen gi. */
  ctx?: RuleContext;
  onApply: (rule: DiscountRule) => void;
  placeholder?: string;
}

export function DiscountCodeInput({
  rules,
  subtotal,
  ctx,
  onApply,
  placeholder = 'Bạn có mã ưu đãi? Nhập tại đây.',
}: DiscountCodeInputProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  function apply() {
    const typed = code.trim().toUpperCase();
    const found = rules.find((rule) => rule.code.toUpperCase() === typed);

    if (!found) {
      setError('Mã không hợp lệ');
      return;
    }

    // Ma co that nhung chua du dieu kien: noi ro DIEU KIEN NAO chua thoa, chu
    // khong bao chung chung. Go `GSMBIKE` trong luc dang chon o to ma chi nhan
    // duoc "Ma khong hop le" thi nguoi dung se go lai them vai lan vo ich.
    const block = ruleBlock(found, subtotal, ctx);
    if (block) {
      setError(formatRuleBlock(block));
      return;
    }

    setError('');
    onApply(found);
  }

  return (
    <>
      <div className="flex items-center gap-md">
        {/* text-input — tailwind-theme.md muc 4 */}
        <input
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') apply();
          }}
          placeholder={placeholder}
          aria-label="Mã ưu đãi"
          className="t-body-md min-w-0 flex-1 rounded-md bg-canvas-soft p-lg text-ink outline-none placeholder:text-mute"
        />
        <PrimaryButton variant="subtle" fullWidth={false} onClick={apply}>
          Áp dụng
        </PrimaryButton>
      </div>
      {error ? <p className="t-caption mt-xs text-mute">{error}</p> : null}
    </>
  );
}
