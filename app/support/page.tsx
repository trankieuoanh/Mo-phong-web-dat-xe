'use client';

/**
 * /support — Trung tam ho tro. Theo sample_ui/trung_tam_ho_tro.png.
 *
 * KHONG NAM TRONG FUNNEL: khong co trong `SCREENS`, khong goi `useScreenView`,
 * khong goi `trackEvent` — giong /history (CLAUDE.md quy tac 9).
 *
 * Email va so tong dai giu nguyen chu nhu anh mau nhung KHONG boc `mailto:`
 * hay `tel:`. Day la thong tin lien he THAT cua mot cong ty that; de bam duoc
 * nghia la mot ban mo phong trong lop hoc co the khien ai do goi nham vao tong
 * dai cua ho.
 */

import { InfoCardGrid, type InfoCard } from '@/components/InfoCardGrid';
import { AppShell } from '@/components/shell/AppShell';

/** Bon muc, dung thu tu trong anh mau. */
const ITEMS: InfoCard[] = [
  { icon: 'question', label: 'Các câu hỏi thường gặp' },
  { icon: 'alert', label: 'Báo cáo sự cố' },
  { icon: 'mail', label: 'Email hỗ trợ support.vn@greensm.com' },
  { icon: 'headset', label: 'Gọi tổng đài 19002097' },
];

export default function SupportPage() {
  return (
    <AppShell section="Trung tâm hỗ trợ">
      <div className="mx-auto w-full min-w-0 max-w-[1280px] break-words px-lg desktop:px-0 [&_li>span:last-child]:min-w-0">
        <InfoCardGrid items={ITEMS} />
      </div>
    </AppShell>
  );
}
