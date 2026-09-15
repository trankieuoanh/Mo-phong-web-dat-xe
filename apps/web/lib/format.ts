/**
 * Tien LUON la so nguyen VND trong du lieu (35000).
 * Chi format khi hien thi (35.000d). Xem CLAUDE.md muc Quy uoc code.
 */
import { CURRENCY } from '@gsm/shared';

const vnd = new Intl.NumberFormat('vi-VN');

/** 35000 -> "35.000đ" */
export function formatVnd(amount: number): string {
  return `${vnd.format(amount)}${CURRENCY}`;
}

/** 35000 -> "35.000" (khi don vi da hien o cho khac) */
export function formatNumber(amount: number): string {
  return vnd.format(amount);
}
