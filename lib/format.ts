/**
 * Tien LUON la so nguyen VND trong du lieu (35000).
 * Chi format khi hien thi (35.000d). Xem CLAUDE.md muc Quy uoc code.
 */
import { CURRENCY, VEHICLE_TYPE_LABELS, type RuleBlock } from '@/lib/shared';

const vnd = new Intl.NumberFormat('vi-VN');

/** 35000 -> "35.000đ" */
export function formatVnd(amount: number): string {
  return `${vnd.format(amount)}${CURRENCY}`;
}

/** 35000 -> "35.000" (khi don vi da hien o cho khac) */
export function formatNumber(amount: number): string {
  return vnd.format(amount);
}

/** 9 -> "09:00" */
function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/**
 * Ly do mot uu dai bi khoa -> cau tieng Viet hien duoi ten uu dai.
 *
 * O DUNG MOT CHO cho ca `/ride/promo` lan `/food/offer`. Truoc day moi man tu
 * gan cung chuoi "Can don toi thieu ...", va do la ly do them mot dieu kien moi
 * lai phai sua hai noi — de sot mot noi thi hai luong giai thich khac nhau ve
 * cung mot luat.
 *
 * `ruleBlock()` trong lib/shared tra ve du lieu chu khong phai cau chu vi
 * lib/shared khong duoc biet toi `formatVnd`.
 */
export function formatRuleBlock(block: RuleBlock): string {
  switch (block.kind) {
    case 'vehicle':
      return `Chỉ áp dụng cho ${block.vehicleTypes.map((t) => VEHICLE_TYPE_LABELS[t]).join(' và ')}`;
    case 'distance':
      return `Cho chuyến từ ${block.minDistanceKm} km`;
    case 'hours':
      return `Chỉ áp dụng ${formatHour(block.from)}–${formatHour(block.to)}`;
    case 'min_order':
      return `Cần đơn tối thiểu ${formatVnd(block.minOrder)}`;
  }
}
