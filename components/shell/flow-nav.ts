/**
 * Luat doi luong, dung chung cho SideRail (desktop) va TopBar (man hep).
 *
 * De o mot file rieng vi hai cho cung phai tra loi CUNG mot cau hoi — "man nay
 * co doi luong duoc khong" — va hai ban sao cua cung mot bang se lech nhau vao
 * dung luc khong ai de y. Lech o day khong lam hong giao dien: no lam mot cai
 * tab bam duoc ma le ra khong, tuc ban mot `select_flow` giua luong va lam sai
 * mau so cua ca funnel.
 */

import type { Flow } from '@gsm/shared';
import type { FlowEntryScreen } from '@/lib/track';

/**
 * Ba man dau luong — chi o day tab moi doi luong duoc. Vao sau hon thi ca hai
 * tab tro lai TRANG TRI: nhay luong tu giua luong tao session khong phan tich
 * duoc, va mot nut bam duoc ma khong ghi lai la mot khoang mu trong du lieu.
 *
 * Gia tri la `screen_name` that cua man dang dung, de `select_flow` ghi dung
 * noi nguoi dung bam.
 */
export const FLOW_ENTRY: Record<string, FlowEntryScreen> = {
  '/': 'home',
  '/ride/address': 'address_selection',
  '/food': 'food_menu',
};

export interface FlowTab {
  flow: Flow;
  label: string;
  href: string;
}

/**
 * Nhan theo DU AN NAY, khong copy nguyen anh mau: Green SM that co dich vu
 * "Giao hang" (giao kien hang), con o day luong thu hai la dat do an.
 */
export const FLOW_TABS: FlowTab[] = [
  // "Dat xe" dung truoc vi day la luong MAC DINH cua `/`.
  { flow: 'ride', label: 'Đặt xe', href: '/ride/address' },
  { flow: 'food', label: 'Đặt đồ ăn', href: '/food' },
];

/**
 * Luong dang dung. `/` tinh la ride — day chinh la "mac dinh la dat xe":
 * khong co nhanh nay thi o `/` khong tab nao sang len.
 */
export function activeFlowOf(pathname: string): Flow | null {
  if (pathname === '/' || pathname.startsWith('/ride')) return 'ride';
  if (pathname.startsWith('/food')) return 'food';
  return null;
}

/**
 * `screen_name` dung de ghi `select_flow` khi bam tab `flow` tu `pathname` —
 * hoac `null` khi tab do KHONG duoc phep bam.
 *
 * VI SAO LA MOT HAM CHU KHONG PHAI VAI DONG `if` O MOI COMPONENT: truoc day
 * SideRail va TopBar moi ben tu suy ra cau tra loi nay, va ca hai cung sai mot
 * kieu — o bon man NGOAI FUNNEL (/history, /account, /support, /terms) chung
 * bien ca hai tab thanh `<span aria-hidden>`, tuc khong con duong nao quay lai
 * luong ngoai nut Back cua trinh duyet.
 *
 * Goc cua loi: luat "khong cho nhay luong" duoc viet cho man GIUA LUONG
 * (/ride/vehicle...), nhung dieu kien lai la "khong tra duoc FLOW_ENTRY", ma
 * man ngoai funnel cung khong tra duoc. Luat dung cho, ap nham cho.
 */
export function selectFlowScreenFor(
  pathname: string,
  flow: Flow,
  href: string,
): FlowEntryScreen | null {
  const active = activeFlowOf(pathname);

  // Dang o chinh luong nay — tab la dau hieu active, khong bam.
  if (active === flow) return null;

  // NGOAI FUNNEL: nguoi dung khong dang do dang gi ca, nen doi luong la hop le.
  // Ghi theo man DICH vi man dang dung khong co `screen_name` nao — no co y
  // khong nam trong SCREENS. Xem event-taxonomy.md muc `select_flow`.
  if (active === null) return FLOW_ENTRY[href] ?? null;

  // Con lai: dang trong mot luong, bam tab luong kia. Chi cho phep o ba man dau
  // luong. Vao sau hon thi `FLOW_ENTRY` tra undefined -> null -> trang tri, dung
  // luat cu: nhay luong tu giua luong tao session lai khong phan tich duoc.
  return FLOW_ENTRY[pathname] ?? null;
}
