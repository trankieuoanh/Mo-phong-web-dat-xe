'use client';

/**
 * Ban do gia lap bang SVG. KHONG dung Leaflet/Google Maps —
 * them thu vien pha CLAUDE.md quy tac 8, can API key, va khong them duoc
 * gi cho phan tich funnel. Xem ride-flow-design.md muc 4.
 *
 * Moi toa do la HANG SO trong file nay: ban do nhay mua moi lan re-render
 * trong nhu loi chu khong nhu ban do.
 *
 * Xep lop tu duoi len, mo phong cach ban do that duoc ve (sample_ui/main_screen.png):
 * nen -> cong vien/song -> khoi nha -> duong (net trang de len) -> nhan pho ->
 * POI -> ghim. Mau chi lay tu token trong globals.css (CLAUDE.md quy tac 4).
 */

import { FIXED_ROUTE } from '@gsm/shared';
import { Icon } from '@/components/Icon';

interface MapCanvasProps {
  /** `pickup`: mot ghim o tam. `route`: tuyen duong noi hai ghim. */
  variant: 'pickup' | 'route';
  /** Tooltip canh ghim — vi du ten diem don. */
  label?: string;
  /**
   * true khi ban do nam o cot `aside` cua bo cuc split: cao bang panel.
   * false (mac dinh): giu khung 4:3 nhu mot anh chen trong noi dung.
   */
  fill?: boolean;
}

/** Khoi nha — x, y, w, h. */
const BLOCKS: [number, number, number, number][] = [
  [40, 40, 150, 100], [230, 30, 120, 110], [390, 50, 170, 90],
  [600, 40, 140, 120], [780, 60, 140, 100],
  [50, 210, 130, 120], [220, 200, 150, 130], [410, 220, 120, 110],
  [600, 210, 160, 120], [800, 230, 120, 100],
  [60, 390, 140, 110], [240, 400, 130, 100], [420, 380, 150, 120],
  [620, 400, 130, 110], [790, 390, 130, 120],
  [70, 560, 160, 110], [270, 570, 140, 100], [460, 560, 150, 110],
  [660, 575, 130, 95], [830, 560, 100, 110],
];

/** Duong lon — ke ngang/doc, ve bang net trang day. */
const AVENUES = [
  'M0 175 H960', 'M0 355 H960', 'M0 530 H960',
  'M205 0 V720', 'M580 0 V720', 'M765 0 V720',
];

/** Ngo nho, manh hon. */
const LANES = ['M0 90 H960', 'M0 265 H960', 'M0 450 H960', 'M0 640 H960', 'M390 0 V720'];

/** Song chay cheo qua ban do. */
const RIVER =
  'M-20 700 C 180 610, 240 470, 400 400 C 560 330, 640 200, 700 -20 L 800 -20 C 740 210, 660 360, 470 450 C 300 530, 240 640, 90 720 Z';

/** Cong vien / ho nuoc. */
const PARKS: [number, number, number, number][] = [
  [820, 300, 120, 160],
  [110, 640, 180, 120],
];

/** Nhan ten pho: [x, y, xoay do, chu]. */
const STREET_LABELS: [number, number, number, string][] = [
  [90, 168, 0, 'P. Cầu Giấy'],
  [640, 168, 0, 'P. Kim Mã'],
  [300, 348, 0, 'Đ. Nguyễn Khang'],
  [700, 348, 0, 'P. Đào Tấn'],
  [140, 523, 0, 'P. Chùa Láng'],
  [620, 523, 0, 'Vành Đai 1'],
  [198, 300, -90, 'Vành Đai 2'],
  [573, 250, -90, 'D. Quảng Hàm'],
];

/** Cham POI rai rac. */
const POIS: [number, number][] = [
  [120, 120], [300, 90], [480, 130], [700, 100], [860, 130],
  [150, 280], [330, 270], [500, 300], [680, 280], [880, 250],
  [130, 460], [310, 470], [520, 440], [690, 470], [870, 500],
  [200, 620], [420, 650], [610, 620], [820, 660],
];

/** Tuyen duong: diem don (205,530) -> diem den (765,175), gay khuc theo luoi pho. */
const ROUTE_PATH = '205,530 205,355 390,355 390,175 765,175';

const PICKUP = { x: 205, y: 530 };
const DEST = { x: 765, y: 175 };
/** Ghim don o variant `pickup` — dat gan tam ban do. */
const SOLO = { x: 470, y: 355 };

/** Giot nuoc cam vao (cx, cy) — day nhon cham dung toa do do. */
function Pin({ x, y, tone }: { x: number; y: number; tone: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="2" rx="12" ry="4" fill="var(--color-ink)" opacity="0.14" />
      <path
        d="M0 0 C -10 -14, -14 -20, -14 -27 a14 14 0 1 1 28 0 c0 7 -4 13 -14 27 Z"
        fill={tone}
      />
      <circle cx="0" cy="-27" r="5.5" fill="var(--color-canvas)" />
    </g>
  );
}

export function MapCanvas({ variant, label, fill = false }: MapCanvasProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-canvas ${
        fill ? 'h-full min-h-0 w-full' : 'aspect-[4/3] w-full'
      }`}
    >
      <svg
        viewBox="0 0 960 720"
        className="h-full w-full"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        {/* 1. Nen */}
        <rect x="0" y="0" width="960" height="720" fill="var(--color-canvas-softer)" />

        {/* 2. Cong vien + song */}
        {PARKS.map(([x, y, w, h]) => (
          <rect key={`p${x}`} x={x} y={y} width={w} height={h} rx="14" fill="var(--color-canvas-soft)" />
        ))}
        <path d={RIVER} fill="var(--color-surface-pressed)" opacity="0.7" />

        {/* 3. Khoi nha */}
        {BLOCKS.map(([x, y, w, h]) => (
          <rect key={`b${x}-${y}`} x={x} y={y} width={w} height={h} rx="6" fill="var(--color-canvas)" />
        ))}

        {/* 4. Duong — vien mo truoc, long trang de len sau */}
        <g fill="none" strokeLinecap="round">
          {AVENUES.map((d) => (
            <path key={`ao${d}`} d={d} stroke="var(--color-hairline-mid)" strokeWidth="24" opacity="0.07" />
          ))}
          {AVENUES.map((d) => (
            <path key={`a${d}`} d={d} stroke="var(--color-canvas)" strokeWidth="18" />
          ))}
          {LANES.map((d) => (
            <path key={`l${d}`} d={d} stroke="var(--color-canvas)" strokeWidth="8" />
          ))}
        </g>

        {/* 5. Nhan ten pho */}
        <g fill="var(--color-mute)" fontSize="13" fontFamily="var(--font-text)">
          {STREET_LABELS.map(([x, y, rot, text]) => (
            <text key={text} x={x} y={y} transform={`rotate(${rot} ${x} ${y})`}>
              {text}
            </text>
          ))}
        </g>

        {/* 6. Cham POI */}
        <g fill="var(--color-mute)" opacity="0.55">
          {POIS.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="3.5" />
          ))}
        </g>

        {/* 7. Ghim */}
        {variant === 'pickup' ? (
          <>
            <circle cx={SOLO.x} cy={SOLO.y} r="40" fill="var(--color-primary)" opacity="0.14" />
            <Pin x={SOLO.x} y={SOLO.y} tone="var(--color-ink)" />
          </>
        ) : (
          <>
            <polyline
              points={ROUTE_PATH}
              fill="none"
              stroke="var(--color-primary-dark)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Pin x={PICKUP.x} y={PICKUP.y} tone="var(--color-primary-dark)" />
            {/* Diem den dung `ink`, KHONG dung cam nhu logo that —
                DESIGN.md cam mau accent thu hai. */}
            <Pin x={DEST.x} y={DEST.y} tone="var(--color-ink)" />
          </>
        )}
      </svg>

      {/* Cum zoom — TRANG TRI, khong bam duoc (ride-flow-design.md muc 8). */}
      <div
        aria-hidden="true"
        className="shadow-level-2 absolute top-lg left-lg flex flex-col overflow-hidden rounded-md bg-canvas text-ink"
      >
        <span className="grid size-9 place-items-center border-b border-surface-pressed">
          <Icon name="plus" size={18} />
        </span>
        <span className="grid size-9 place-items-center">
          <Icon name="minus" size={18} />
        </span>
      </div>

      {/* Nut re-center — TRANG TRI: khong co toa do that de re-center ve. */}
      <span
        aria-hidden="true"
        className="shadow-level-2 absolute right-lg bottom-lg grid size-11 place-items-center rounded-full bg-canvas text-ink"
      >
        <Icon name="target" size={20} />
      </span>

      {label ? (
        // Tooltip canh ghim, giong "198/6 Duong Cau Giay >" trong anh mau.
        <div className="t-body-sm-strong shadow-level-2 absolute top-1/2 left-1/2 flex max-w-[70%] -translate-x-1/2 -translate-y-[calc(50%+56px)] items-center gap-sm rounded-pill bg-canvas px-lg py-sm text-ink">
          <span className="truncate">{label}</span>
          <Icon name="chevron-right" size={16} className="text-body" />
        </div>
      ) : null}

      {variant === 'route' ? (
        <div className="t-body-sm-strong shadow-level-2 absolute top-lg right-lg rounded-pill bg-canvas px-lg py-sm text-ink">
          {FIXED_ROUTE.durationMin} phút • {FIXED_ROUTE.distanceKm} km
        </div>
      ) : null}
    </div>
  );
}
