'use client';

/**
 * /terms — Dieu khoan & Chinh sach. Noi dung theo
 * sample_ui/dieu_khoan_va_chinh_sach.png.
 *
 * KHONG NAM TRONG FUNNEL: khong co trong `SCREENS`, khong goi `useScreenView`,
 * khong goi `trackEvent` — giong /history (CLAUDE.md quy tac 9).
 *
 * LAY NOI DUNG, BO VO. Anh mau la trang web MARKETING cua Green SM, khong phai
 * mot man trong app: no co thanh nav rieng (Trang chu / Danh muc / Mua xe dien
 * VinFast), hero banner, breadcrumb va thanh cookie. Dung y nguyen se cho rieng
 * man nay mot he dieu huong khac han 13 man con lai. Bon ten chinh sach thi giu
 * dung nhu anh.
 *
 * Minh hoa trong anh mau nhieu mau (kep vang, dau moc cam, bat tay hong) — o day
 * la glyph don sac: DESIGN.md chot "the system has no secondary accent".
 */

import { InfoCardGrid, type InfoCard } from '@/components/InfoCardGrid';
import { AppShell } from '@/components/shell/AppShell';

/** Bon chinh sach, dung thu tu trong anh mau. */
const ITEMS: InfoCard[] = [
  { icon: 'doc', label: 'Điều khoản chung' },
  { icon: 'rules', label: 'Quy chế hoạt động' },
  { icon: 'shield', label: 'Chính sách bảo vệ dữ liệu cá nhân' },
  { icon: 'contract', label: 'Hợp đồng dịch vụ' },
];

export default function TermsPage() {
  return (
    <AppShell section="Điều khoản & Chính sách">
      <div className="mx-auto w-full min-w-0 max-w-[1280px] break-words px-lg desktop:px-0 [&_li>span:last-child]:min-w-0">
        <InfoCardGrid items={ITEMS} />
      </div>
    </AppShell>
  );
}
