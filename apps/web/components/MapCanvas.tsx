'use client';

/**
 * Ban do that: tile raster tu OpenStreetMap + tuyen duong ve de len bang SVG.
 *
 * KHONG dung Leaflet/Google Maps — CLAUDE.md quy tac 8 chot danh sach thu vien.
 * Mot ban do tinh (khong keo tha) chi can chieu Web Mercator va xep mot luoi
 * the <img>, khong dang mot dependency.
 *
 * Ban truoc ve mot luoi pho BIA voi tuyen duong hang so — hai chuyen di khac
 * hoan toan van ra cung mot hinh. Gio ca nen lan tuyen deu theo toa do that.
 *
 * GHI CONG `© OpenStreetMap` LA BAT BUOC — dieu khoan dung tile yeu cau, khong
 * phai chi tiet tham my.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { LatLon, Place, RouteResult } from '@gsm/shared';
import { Icon } from '@/components/Icon';

const TILE_SIZE = 256;
const MIN_ZOOM = 3;
const MAX_ZOOM = 18;
/** Chua le quanh tuyen de ghim khong dinh sat mep. */
const PADDING_RATIO = 0.12;

interface MapCanvasProps {
  pickup: Place;
  /** Khong co = chi ghim diem don, chua biet diem den. */
  destination?: Place;
  /** Co tuyen thi khung nhin om tron tuyen; khong thi om hai ghim. */
  route?: RouteResult | null;
  /** Tooltip canh ghim diem don. */
  label?: string;
  /**
   * true khi ban do nam o cot `aside` cua bo cuc split: cao bang panel.
   * false (mac dinh): giu khung 4:3 nhu mot anh chen trong noi dung.
   */
  fill?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Chieu Web Mercator: lat/lon -> pixel the gioi o mot muc zoom
// ─────────────────────────────────────────────────────────────

function lonToWorldX(lon: number, zoom: number): number {
  return ((lon + 180) / 360) * TILE_SIZE * 2 ** zoom;
}

function latToWorldY(lat: number, zoom: number): number {
  // Kep vi do: cong thuc Mercator phan ky o hai cuc.
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const rad = (clamped * Math.PI) / 180;
  const y = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2;
  return y * TILE_SIZE * 2 ** zoom;
}

interface Viewport {
  zoom: number;
  /** Goc trai-tren cua khung, tinh bang pixel the gioi o `zoom`. */
  originX: number;
  originY: number;
}

/** Zoom lon nhat ma toan bo `points` van lot trong khung `width`×`height`. */
function fitZoom(points: LatLon[], width: number, height: number): number {
  if (points.length < 2) return 15;

  const usableW = width * (1 - PADDING_RATIO * 2);
  const usableH = height * (1 - PADDING_RATIO * 2);

  for (let zoom = MAX_ZOOM; zoom >= MIN_ZOOM; zoom -= 1) {
    const xs = points.map((p) => lonToWorldX(p.lon, zoom));
    const ys = points.map((p) => latToWorldY(p.lat, zoom));
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);
    if (spanX <= usableW && spanY <= usableH) return zoom;
  }
  return MIN_ZOOM;
}

function centerOf(points: LatLon[]): LatLon {
  if (points.length === 1) return points[0]!;
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  return {
    lat: (Math.max(...lats) + Math.min(...lats)) / 2,
    lon: (Math.max(...lons) + Math.min(...lons)) / 2,
  };
}

/** Giot nuoc cam vao (x, y) — day nhon cham dung toa do do. */
function Pin({ x, y, tone }: { x: number; y: number; tone: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="2" rx="10" ry="3.5" fill="var(--color-ink)" opacity="0.2" />
      <path
        d="M0 0 C -8 -11, -11 -16, -11 -21 a11 11 0 1 1 22 0 c0 5 -3 10 -11 21 Z"
        fill={tone}
        stroke="var(--color-canvas)"
        strokeWidth="2"
      />
      <circle cx="0" cy="-21" r="4" fill="var(--color-canvas)" />
    </g>
  );
}

export function MapCanvas({ pickup, destination, route, label, fill = false }: MapCanvasProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  /** Nguoi dung bam +/−; cong vao zoom vua khit. Nut re-center dat lai ve 0. */
  const [zoomOffset, setZoomOffset] = useState(0);

  // Do khung bang ResizeObserver — bo cuc `split` co be ngang thay doi theo
  // cua so, va zoom vua khit phu thuoc kich thuoc that.
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /** Cac diem quyet dinh khung nhin: ca tuyen neu co, khong thi hai ghim. */
  const points = useMemo<LatLon[]>(() => {
    if (route && route.geometry.length > 1) {
      return route.geometry.map(([lat, lon]) => ({ lat, lon }));
    }
    return destination ? [pickup, destination] : [pickup];
  }, [route, pickup, destination]);

  // Doi tuyen/diem thi bo muc zoom nguoi dung da chinh tay — neu khong, chuyen
  // moi se ke thua zoom cua chuyen truoc va co the nam ngoai khung.
  const pointsKey = points.map((p) => `${p.lat},${p.lon}`).join('|');
  useEffect(() => {
    setZoomOffset(0);
  }, [pointsKey]);

  const viewport = useMemo<Viewport | null>(() => {
    if (size.width === 0 || size.height === 0) return null;

    const base = fitZoom(points, size.width, size.height);
    const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, base + zoomOffset));
    const center = centerOf(points);

    return {
      zoom,
      originX: lonToWorldX(center.lon, zoom) - size.width / 2,
      originY: latToWorldY(center.lat, zoom) - size.height / 2,
    };
  }, [points, size.width, size.height, zoomOffset]);

  /** lat/lon -> toa do pixel trong khung. */
  const project = useCallback(
    (point: LatLon): [number, number] => {
      if (!viewport) return [0, 0];
      return [
        lonToWorldX(point.lon, viewport.zoom) - viewport.originX,
        latToWorldY(point.lat, viewport.zoom) - viewport.originY,
      ];
    },
    [viewport],
  );

  /** Lua the <img> phu kin khung o muc zoom hien tai. */
  const tiles = useMemo(() => {
    if (!viewport) return [];

    const count = 2 ** viewport.zoom;
    const minTileX = Math.floor(viewport.originX / TILE_SIZE);
    const maxTileX = Math.floor((viewport.originX + size.width) / TILE_SIZE);
    const minTileY = Math.floor(viewport.originY / TILE_SIZE);
    const maxTileY = Math.floor((viewport.originY + size.height) / TILE_SIZE);

    const out: { key: string; src: string; left: number; top: number }[] = [];
    for (let tx = minTileX; tx <= maxTileX; tx += 1) {
      for (let ty = minTileY; ty <= maxTileY; ty += 1) {
        // Ngoai hai cuc thi khong co tile; con kinh do thi cuon vong.
        if (ty < 0 || ty >= count) continue;
        const wrappedX = ((tx % count) + count) % count;
        out.push({
          key: `${viewport.zoom}/${tx}/${ty}`,
          src: `https://tile.openstreetmap.org/${viewport.zoom}/${wrappedX}/${ty}.png`,
          left: tx * TILE_SIZE - viewport.originX,
          top: ty * TILE_SIZE - viewport.originY,
        });
      }
    }
    return out;
  }, [viewport, size.width, size.height]);

  const routeLine = useMemo(() => {
    if (!viewport || !route || route.geometry.length < 2) return '';
    return route.geometry
      .map(([lat, lon]) => project({ lat, lon }).join(','))
      .join(' ');
  }, [viewport, route, project]);

  const [pickupX, pickupY] = project(pickup);
  const [destX, destY] = destination ? project(destination) : [0, 0];

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden rounded-xl bg-canvas-soft ${
        fill ? 'h-full min-h-0 w-full' : 'aspect-[4/3] w-full'
      }`}
    >
      {/* Lop 1 — tile nen.
          Dung <img> tho chu KHONG dung next/image: tile la anh 256px co san
          trên CDN cua OSM, cho no di qua bo toi uu cua Next chi them mot chang
          proxy va lam hong viec dinh vi tuyet doi theo pixel. */}
      {tiles.map((tile) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={tile.key}
          src={tile.src}
          alt=""
          aria-hidden="true"
          loading="lazy"
          width={TILE_SIZE}
          height={TILE_SIZE}
          className="pointer-events-none absolute max-w-none select-none"
          style={{ left: tile.left, top: tile.top }}
        />
      ))}

      {/* Lop 2 — tuyen duong va ghim */}
      {viewport ? (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          {routeLine ? (
            <>
              {/* Vien trang ben duoi de tuyen noi tren nen tile nhieu mau. */}
              <polyline
                points={routeLine}
                fill="none"
                stroke="var(--color-canvas)"
                strokeWidth="9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points={routeLine}
                fill="none"
                stroke="var(--color-primary-dark)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          ) : null}

          <Pin x={pickupX} y={pickupY} tone="var(--color-primary-dark)" />
          {/* Diem den dung `ink` — DESIGN.md cam mau accent thu hai. */}
          {destination ? <Pin x={destX} y={destY} tone="var(--color-ink)" /> : null}
        </svg>
      ) : null}

      {/* Lop 3 — dieu khien. Gio chung LAM THAT, khong con trang tri. */}
      <div className="shadow-level-2 absolute top-lg left-lg flex flex-col overflow-hidden rounded-md bg-canvas text-ink">
        <button
          type="button"
          aria-label="Phóng to"
          onClick={() => setZoomOffset((v) => Math.min(v + 1, 4))}
          className="grid size-9 place-items-center border-b border-surface-pressed hover:bg-canvas-soft"
        >
          <Icon name="plus" size={18} />
        </button>
        <button
          type="button"
          aria-label="Thu nhỏ"
          onClick={() => setZoomOffset((v) => Math.max(v - 1, -4))}
          className="grid size-9 place-items-center hover:bg-canvas-soft"
        >
          <Icon name="minus" size={18} />
        </button>
      </div>

      <button
        type="button"
        aria-label="Đưa bản đồ về vừa khít tuyến đường"
        onClick={() => setZoomOffset(0)}
        className="shadow-level-2 absolute right-lg bottom-lg grid size-11 place-items-center rounded-full bg-canvas text-ink hover:bg-canvas-soft"
      >
        <Icon name="target" size={20} />
      </button>

      {label ? (
        <div className="t-body-sm-strong shadow-level-2 absolute top-lg left-1/2 flex max-w-[70%] -translate-x-1/2 items-center gap-sm rounded-pill bg-canvas px-lg py-sm text-ink">
          <span className="truncate">{label}</span>
        </div>
      ) : null}

      {route ? (
        <div className="shadow-level-2 absolute right-lg top-lg rounded-pill bg-canvas px-lg py-sm text-ink">
          <span className="t-body-sm-strong">
            {route.durationMin} phút • {route.distanceKm} km
          </span>
          {route.source === 'straight' ? (
            // Noi that voi nguoi dung khi con so la duong chim bay — cung thong
            // tin ma `route_source` ghi vao event.
            <span className="t-caption block text-mute">ước lượng — đường chim bay</span>
          ) : null}
        </div>
      ) : null}

      {/* Ghi cong BAT BUOC theo dieu khoan dung tile OpenStreetMap. */}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer noopener"
        className="t-caption absolute right-0 bottom-0 bg-canvas/80 px-xs text-body"
      >
        © OpenStreetMap
      </a>
    </div>
  );
}
