/**
 * Bo icon SVG noi tuyen — thay toan bo emoji trong app.
 *
 * Vi sao khong dung thu vien icon: CLAUDE.md quy tac 8 chot danh sach thu vien,
 * va mot bo ~30 icon line ve tay nhe hon bat ky package nao.
 *
 * Moi path dung `stroke="currentColor"` + `fill="none"` nen icon an mau chu cua
 * phan tu cha — khong bao gio can go hex mau o cho goi (CLAUDE.md quy tac 4).
 */

export type IconName =
  // side rail
  | 'box'
  | 'car'
  | 'clock'
  | 'users'
  | 'headset'
  | 'doc'
  | 'collapse'
  // dieu huong
  | 'arrow-left'
  | 'close'
  | 'chevron-right'
  | 'chevron-down'
  | 'check'
  | 'search'
  // ban do / dia chi
  | 'pin'
  | 'pin-filled'
  | 'target'
  | 'map'
  | 'plus'
  | 'minus'
  // loai dia chi
  | 'home'
  | 'work'
  | 'school'
  | 'plane'
  | 'shop'
  // phuong tien & thanh toan
  | 'bike'
  | 'cash'
  | 'qr'
  // trang tri
  | 'heart'
  | 'dots'
  | 'ticket'
  | 'bolt'
  | 'crown'
  | 'trash'
  | 'bag'
  | 'wave';

/**
 * Moi phan tu la NOI DUNG ben trong <svg viewBox="0 0 24 24">.
 * Giu chung mot luoi 24px de moi icon can nang thi giac ngang nhau.
 */
const PATHS: Record<IconName, React.ReactNode> = {
  box: (
    <>
      <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
      <path d="m3 8 9 5 9-5" />
      <path d="M12 13v8" />
    </>
  ),
  car: (
    <>
      <path d="M5 17h14" />
      <path d="M4 17v-4.2a2 2 0 0 1 .2-.9l1.9-3.8A2 2 0 0 1 7.9 7h8.2a2 2 0 0 1 1.8 1.1l1.9 3.8a2 2 0 0 1 .2.9V17" />
      <path d="M4 17v2h3v-2M17 17v2h3v-2" />
      <circle cx="7.5" cy="13.5" r="1" />
      <circle cx="16.5" cy="13.5" r="1" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19a6 6 0 0 1 12 0" />
      <path d="M16 6.2a3 3 0 0 1 0 5.6" />
      <path d="M17.5 14.3A5.5 5.5 0 0 1 21 19" />
    </>
  ),
  headset: (
    <>
      <path d="M4 14v-2a8 8 0 1 1 16 0v2" />
      <rect x="2.5" y="13.5" width="4" height="6" rx="1.5" />
      <rect x="17.5" y="13.5" width="4" height="6" rx="1.5" />
      <path d="M19.5 19.5v.5a2 2 0 0 1-2 2H13" />
    </>
  ),
  doc: (
    <>
      <path d="M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-6-6Z" />
      <path d="M13 3v6h6" />
      <path d="M9 13h6M9 17h6" />
    </>
  ),
  collapse: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
      <path d="m16 10-2 2 2 2" />
    </>
  ),

  'arrow-left': <path d="M19 12H5m0 0 6-6m-6 6 6 6" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  'chevron-right': <path d="m9 6 6 6-6 6" />,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  check: <path d="m5 12.5 5 5L19 7" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.5-4.5" />
    </>
  ),

  pin: (
    <>
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  'pin-filled': (
    <path
      d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </>
  ),
  map: (
    <>
      <path d="m9 4 6 2 5.2-1.7a.6.6 0 0 1 .8.6v12.3a1 1 0 0 1-.7 1L15 20l-6-2-5.2 1.7a.6.6 0 0 1-.8-.6V6.8a1 1 0 0 1 .7-1L9 4Z" />
      <path d="M9 4v14M15 6v14" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,

  home: (
    <>
      <path d="m4 10.5 8-6.5 8 6.5" />
      <path d="M6 9.5V20h12V9.5" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  work: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M3 12h18" />
    </>
  ),
  school: (
    <>
      <path d="m12 4 9 4.5-9 4.5-9-4.5L12 4Z" />
      <path d="M6.5 11v4.5c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V11" />
      <path d="M21 8.5V14" />
    </>
  ),
  plane: <path d="M10.5 20.5 12 15l7.3-2a1.8 1.8 0 0 0 0-3.4L3.5 4l3 6-3 2.5 4.2 1.2 1 4.3 1.8-1.5Z" />,
  shop: (
    <>
      <path d="M4 9h16l-1 11H5L4 9Z" />
      <path d="M9 9V6a3 3 0 0 1 6 0v3" />
    </>
  ),

  bike: (
    <>
      <circle cx="5.5" cy="17" r="3" />
      <circle cx="18.5" cy="17" r="3" />
      <path d="M5.5 17h5l4-8h-2" />
      <path d="m14.5 9 2.5 8" />
      <path d="M16.5 5h2.5l1 4" />
    </>
  ),
  cash: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 10v4M18 10v4" />
    </>
  ),
  qr: (
    <>
      <rect x="3.5" y="3.5" width="6" height="6" rx="1" />
      <rect x="14.5" y="3.5" width="6" height="6" rx="1" />
      <rect x="3.5" y="14.5" width="6" height="6" rx="1" />
      <path d="M14.5 14.5h3v3h-3zM20.5 17.5v3h-3" />
    </>
  ),

  heart: <path d="M12 20s-7-4.6-7-9.5A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.5C19 15.4 12 20 12 20Z" />,
  dots: (
    <>
      <circle cx="5.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  ticket: (
    <>
      <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.5a2.5 2.5 0 0 0 0 5V16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1.5a2.5 2.5 0 0 0 0-5V8Z" />
      <path d="M13 6v2M13 11v2M13 16v2" />
    </>
  ),
  bolt: <path d="M13.5 3 5 13.5h5.5L10 21l8.5-10.5H13l.5-7.5Z" />,
  crown: (
    <>
      <path d="m3 8 3.5 3L12 5l5.5 6L21 8l-2 10H5L3 8Z" />
      <path d="M5 18h14" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  bag: (
    <>
      <path d="M5 8h14l-1 12H6L5 8Z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
      <path d="M9 12h6" />
    </>
  ),
  wave: (
    <>
      <path d="M3 13c2.5-3 5-3 7.5 0S16 16 19 13" />
      <path d="M3 18c2.5-3 5-3 7.5 0S16 21 19 18" />
      <path d="M12 3v4" />
    </>
  ),
};

interface IconProps {
  name: IconName;
  /** Canh mot phia, don vi px. Mac dinh 24 — dung luoi goc cua bo icon. */
  size?: number;
  className?: string;
}

export function Icon({ name, size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className ?? ''}`}
    >
      {PATHS[name]}
    </svg>
  );
}
