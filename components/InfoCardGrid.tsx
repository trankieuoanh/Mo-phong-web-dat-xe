'use client';

/**
 * Luoi the thong tin — huy hieu icon tron + mot dong nhan.
 *
 * Theo sample_ui/trung_tam_ho_tro.png: luoi 2 cot, the nen xam nhat, huy hieu
 * tron mau nen trang o ben trai.
 *
 * DUNG CHUNG cho /support va /terms vi hai man la CUNG MOT bo cuc, chi khac noi
 * dung. Viet hai lan thi hai ban se lech nhau vao luc khong ai de y — cung ly do
 * flow-nav.ts duoc tach ra khoi SideRail.
 *
 * THE KHONG BAM DUOC — khong phai <a>, khong phai <button>. Khong co trang dich
 * that phia sau, ma mot nut bam vao im lang chinh la thu SideRail.tsx:18-19 goi
 * la "khoang mu trong du lieu". The o day la noi dung doc duoc, khong phai dieu
 * huong gia vo.
 */

import { Icon, type IconName } from '@/components/Icon';

export interface InfoCard {
  icon: IconName;
  label: string;
}

interface InfoCardGridProps {
  items: InfoCard[];
}

export function InfoCardGrid({ items }: InfoCardGridProps) {
  return (
    // Mot cot o man hep, hai cot tu `md` — giong anh mau tren desktop ma khong
    // sinh thanh cuon ngang o 390px (DESIGN.md: desktop-first, khong desktop-only).
    <ul className="grid gap-lg md:grid-cols-2">
      {items.map((item) => (
        <li
          key={item.label}
          className="flex items-center gap-lg rounded-xl bg-canvas-soft px-2xl py-xl"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-canvas text-primary-dark">
            <Icon name={item.icon} size={22} />
          </span>
          <span className="t-body-md-strong text-ink">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
