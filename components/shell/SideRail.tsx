'use client';

/**
 * Menu doc ben trai — theo sample_ui/homepage.png (mo rong, co nhan chu) va
 * sample_ui/main_screen.png (da thu gon, chi icon).
 *
 * HAI TRANG THAI, nut "Thu gon menu" o day chuyen qua lai. Lua chon nho vao
 * localStorage nen F5 khong mat.
 *
 * HAI MUC LUONG LA TAB — day la cho duy nhat doi luong duoc (man `/` khong con
 * hai card nua). Mot quy tac duy nhat:
 *
 *   tab cua luong DANG DUNG = active, KHONG bam duoc;
 *   tab luong kia = bam duoc, ban `select_flow`.
 *
 * ...nhung chi o BA MAN DAU LUONG (`/`, `/ride/address`, `/food`) — xem
 * FLOW_ENTRY duoi. Vao sau hon thi ca hai tro lai TRANG TRI: nhay luong tu giua
 * luong tao session lai khong phan tich duoc. Mot nut bam duoc ma khong ghi lai
 * la mot khoang mu trong du lieu, nen "khong bam duoc" phai that su khong bam.
 *
 * Loi vao luong ride o `/` KHONG nam o day ma la o tim kiem giua panel
 * (app/page.tsx) — nho vay tab "Dat xe" o `/` chi phai lam mot viec: bao rang
 * day la luong mac dinh.
 *
 * Muc "Hoat dong" bam duoc o moi noi. Roi luong giua chung la BO DO THAT va
 * duoc ghi nhan dung bang max(step_index) — du lieu trung thuc, khong phai loi.
 */

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Flow } from '@/lib/shared';
import { GsmLogo } from '@/components/GsmLogo';
import { Icon, type IconName } from '@/components/Icon';
import { trackSelectFlow, type FlowEntryScreen } from '@/lib/track';
import { activeFlowOf, selectFlowScreenFor } from './flow-nav';

const COLLAPSED_KEY = 'gsm_rail_collapsed';

/**
 * Ba man dau luong — chi o day tab moi doi luong duoc.
 *
 * Gia tri la `screen_name` that cua man dang dung, de `select_flow` ghi dung
 * NOI nguoi dung nhay luong (event-taxonomy.md muc 1: doc `screen_name`, khong
 * phai `previous_screen`).
 */
// Bang FLOW_ENTRY da chuyen sang ./flow-nav.ts de TopBar (tab luong o man hep)
// dung chung dung mot nguon — hai ban sao se lech nhau vao luc khong ai de y.

interface RailItem {
  icon: IconName;
  label: string;
  /** Muc co `flow` la mot TAB luong. */
  flow?: Flow;
  /** Duong dan. Muc co `flow` dung href de dieu huong sau khi ban event. */
  href?: string;
}

/**
 * Nhan theo DU AN NAY, khong copy nguyen anh mau: Green SM that co dich vu
 * "Giao hang" (giao kien hang), con o day luong thu hai la dat do an.
 */
const ITEMS: RailItem[] = [
  // "Dat xe" dung truoc vi day la luong MAC DINH cua `/`.
  { icon: 'car', label: 'Đặt xe', flow: 'ride', href: '/ride/address' },
  { icon: 'bag', label: 'Đặt đồ ăn', flow: 'food', href: '/food' },
  // Bon muc duoi la link THAT, deu tro toi man NGOAI FUNNEL: chung khong co
  // trong SCREENS va khong bao gio ban event (CLAUDE.md quy tac 9).
  { icon: 'clock', label: 'Hoạt động', href: '/history' },
  { icon: 'users', label: 'Tài khoản phụ', href: '/account' },
  { icon: 'headset', label: 'Trung tâm hỗ trợ', href: '/support' },
  { icon: 'doc', label: 'Điều khoản & Chính sách', href: '/terms' },
];

export function SideRail() {
  const pathname = usePathname();
  const router = useRouter();

  // Mac dinh MO RONG. Doc localStorage trong useEffect, KHONG luc render —
  // cung bay hydration mismatch da ghi o dau lib/session.ts.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === '1');
    } catch {
      // Storage bi chan (cua so an danh) — giu mac dinh mo rong.
    }
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        // Khong ghi duoc thi thoi, trang thai trong phien nay van dung.
      }
      return next;
    });
  }

  const activeFlow: Flow | null = activeFlowOf(pathname);

  function chooseFlow(screenName: FlowEntryScreen, flow: Flow, href: string) {
    // Ban DONG BO truoc push — xem ghi chu o trackSelectFlow.
    trackSelectFlow(screenName, flow);
    router.push(href);
  }

  // Khi thu gon, o icon la hinh vuong 44px; khi mo rong, hang trai het be ngang.
  //
  // `border-l-2 border-transparent` co o MOI hang chu khong chi hang active:
  // them vien chi khi active se day noi dung sang phai 2px moi lan doi tab.
  const rowBase = collapsed
    ? 'grid size-11 place-items-center rounded-xl border-l-2 border-transparent transition-colors'
    : 'flex w-full items-center gap-md rounded-xl border-l-2 border-transparent px-md py-md transition-colors';

  return (
    <nav
      aria-label="Điều hướng chính"
      className={`sticky top-0 flex h-dvh shrink-0 flex-col gap-xxs border-r border-surface-pressed bg-canvas p-lg transition-[width] ${
        collapsed ? 'w-[72px] items-center' : 'w-[264px]'
      }`}
    >
      <span className={`mb-lg flex items-center text-primary-dark ${collapsed ? '' : 'px-md'}`}>
        {collapsed ? <GsmLogo size={28} /> : <GsmLogo variant="full" size={30} />}
      </span>

      {ITEMS.map((item) => {
        /** Muc co href ma khong co flow = link toi mot man ngoai funnel. */
        const isPlainLink = item.flow === undefined && item.href !== undefined;

        const active =
          (item.flow !== undefined && item.flow === activeFlow) ||
          (isPlainLink && pathname === item.href);

        const tone = active
          ? 'border-primary bg-canvas-soft text-primary-dark'
          : 'text-body';

        // Nhan chu — an khi thu gon, nhung `title` van giu de van dung duoc.
        const body = (
          <>
            <Icon name={item.icon} />
            {collapsed ? null : <span className="t-body-md-strong truncate">{item.label}</span>}
          </>
        );

        // Bon muc ngoai funnel — link that o moi man.
        if (isPlainLink) {
          return (
            <Link
              key={item.label}
              href={item.href!}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className={`${rowBase} ${tone} hover:bg-canvas-soft`}
            >
              {body}
            </Link>
          );
        }

        // Tab luong doi duoc: o ba man dau luong, HOAC o mot man ngoai funnel.
        // Luat day du (ke ca khi nao KHONG doi duoc) nam o selectFlowScreenFor.
        const selectScreen = item.flow
          ? selectFlowScreenFor(pathname, item.flow, item.href!)
          : null;

        if (selectScreen) {
          return (
            <button
              key={item.label}
              type="button"
              title={item.label}
              aria-label={item.label}
              onClick={() => chooseFlow(selectScreen, item.flow!, item.href!)}
              className={`${rowBase} ${tone} hover:bg-canvas-soft`}
            >
              {body}
            </button>
          );
        }

        // Tab cua luong DANG DUNG: khong bam duoc (dang o day roi) nhung VAN
        // phai doc duoc — `aria-hidden` o nhanh duoi se giau mat tab dang chon.
        if (item.flow && active) {
          return (
            <span
              key={item.label}
              aria-current="page"
              title={item.label}
              className={`${rowBase} ${tone}`}
            >
              {body}
            </span>
          );
        }

        // Con lai DUY NHAT mot truong hop: tab cua luong KIA khi dang o GIUA
        // luong (vi du tab "Dat do an" luc dang o /ride/vehicle) —
        // `selectFlowScreenFor` tra null, va `active` la false.
        //
        // Trang tri thuan tuy, dung nhu y dinh o dau file: nhay luong tu giua
        // luong tao mot session khong phan tich duoc.
        return (
          <span key={item.label} aria-hidden="true" title={item.label} className={`${rowBase} ${tone}`}>
            {body}
          </span>
        );
      })}

      <button
        type="button"
        onClick={toggle}
        title={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
        aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
        aria-expanded={!collapsed}
        className={`${rowBase} mt-auto text-mute hover:bg-canvas-soft`}
      >
        <Icon name="collapse" className={collapsed ? 'rotate-180' : ''} />
        {collapsed ? null : <span className="t-body-sm">Thu gọn menu</span>}
      </button>
    </nav>
  );
}
