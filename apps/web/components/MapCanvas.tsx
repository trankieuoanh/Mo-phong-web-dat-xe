'use client';

/**
 * Ban do gia lap bang SVG. KHONG dung Leaflet/Google Maps —
 * them thu vien pha CLAUDE.md quy tac 8, can API key, va khong them duoc
 * gi cho phan tich funnel. Xem ride-flow-design.md muc 4.
 *
 * Moi toa do la HANG SO trong file nay: ban do nhay mua moi lan re-render
 * trong nhu loi chu khong nhu ban do.
 */

import { FIXED_ROUTE } from '@gsm/shared';

interface MapCanvasProps {
  /** `pickup`: mot ghim o tam. `route`: tuyen duong noi hai ghim. */
  variant: 'pickup' | 'route';
}

/** Cac duong pho gia — ke ngang/doc co dinh. */
const STREETS = [
  'M0 62 H320',
  'M0 150 H320',
  'M0 206 H320',
  'M74 0 V240',
  'M182 0 V240',
  'M256 0 V240',
];

/** Cac ngo nho, manh hon. */
const ALLEYS = ['M0 104 H320', 'M128 0 V240', 'M0 24 H320'];

/** Tuyen duong: diem don (74,206) -> diem den (256,62), gay khuc theo luoi pho. */
const ROUTE_PATH = '74,206 74,150 182,150 182,62 256,62';

export function MapCanvas({ variant }: MapCanvasProps) {
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-canvas-soft">
      <svg
        viewBox="0 0 320 240"
        className="h-full w-full"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <g stroke="var(--color-hairline-mid)" fill="none" strokeLinecap="round">
          {STREETS.map((d) => (
            <path key={d} d={d} strokeWidth="6" opacity="0.12" />
          ))}
          {ALLEYS.map((d) => (
            <path key={d} d={d} strokeWidth="2" opacity="0.1" />
          ))}
        </g>

        {variant === 'pickup' ? (
          <g>
            <circle cx="160" cy="120" r="22" fill="var(--color-primary)" opacity="0.18" />
            <circle cx="160" cy="120" r="8" fill="var(--color-primary)" />
          </g>
        ) : (
          <g>
            <polyline
              points={ROUTE_PATH}
              fill="none"
              stroke="var(--color-primary-dark)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="74" cy="206" r="7" fill="var(--color-primary)" />
            <circle cx="256" cy="62" r="7" fill="var(--color-ink)" />
          </g>
        )}
      </svg>

      {variant === 'route' ? (
        <div className="t-body-sm-strong shadow-level-2 absolute top-lg left-lg rounded-pill bg-canvas px-lg py-sm text-ink">
          {FIXED_ROUTE.durationMin} phút • {FIXED_ROUTE.distanceKm} km
        </div>
      ) : null}
    </div>
  );
}
