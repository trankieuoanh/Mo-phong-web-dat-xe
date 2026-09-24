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
import type { LatLon, Place, RouteResult } from '@/lib/shared';
import { Icon } from '@/components/Icon';
import { useTileProviders } from '@/lib/use-tile-providers';

const TILE_SIZE = 256;
const MIN_ZOOM = 3;
const MAX_ZOOM = 18;
/** Chua le quanh tuyen de ghim khong dinh sat mep. */
const PADDING_RATIO = 0.12;

/**
 * Bang nha cung cap tile nam o `lib/shared/tiles.ts` — phep do phai do dung
 * cai danh sach ma man hinh nay se hien.
 *
 * HAI LOP PHONG VE, BAT HAI THU KHAC NHAU:
 *
 *   1. `useTileProviders()` — phep do o BE, bat "200 NHUNG TILE SAI".
 *   2. `handleTileError` ben duoi — bat "TRINH DUYET KHONG TAI DUOC".
 *
 * Lop 2 tung la lop duy nhat, va no da khong cuu duoc su co that: CARTO chuyen
 * sang bat buoc API key, bat dau in chu "API KEY REQUIRED" cheo len moi tile,
 * NHUNG van tra HTTP 200 kem mot file PNG hop le. `onError` khong bao gio ban,
 * bo dem mai bang 0, va ban do hong o ca hai luong ma app khong he biet.
 *
 * Bai hoc: `onError` cua the <img> chi biet "tai duoc hay khong", khong biet
 * "dung hay sai". Muon biet dieu thu hai thi phai chu dong di do — viec cua
 * `lib/server/services/tiles.service.ts`.
 *
 * Nguoc lai, lop 1 khong thay duoc lop 2: may chay BE goi duoc mot ten mien
 * khong co nghia trinh duyet cua nguoi dung cung goi duoc.
 */

/**
 * Bao nhieu tile hong lien tiep thi coi nha cung cap do la chet.
 *
 * Khong chuyen ngay o tile dau tien: mot tile le hong (vung bien, loi mang chop
 * nhoang) khong co nghia ca may chu chet, va nhay nha cung cap moi lan nhu vay
 * se lam ban do nhap nhay.
 */
const TILE_FAILS_BEFORE_SWITCH = 3;

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
  /**
   * Co prop nay = BAT CHE DO CHON VI TRI: bam mot diem tren ban do thi goi
   * callback voi toa do diem do.
   *
   * Khong truyen = ban do chi de xem (van keo va zoom duoc).
   */
  onPick?: (point: LatLon) => void;
  /**
   * Vi tri tai xe hien tai (dung cho man driver_arriving).
   * Neu truyen, se ve them mot ghim tai xe (icon xe) tren ban do.
   */
  driverPosition?: LatLon;
}

/**
 * Keo qua bao nhieu pixel thi coi la KEO chu khong phai BAM.
 *
 * Day la chi tiet quan trong nhat cua che do chon vi tri. Khong co nguong nay
 * thi moi lan keo ban do xong tha tay, `pointerup` se roi dung giua ban do va
 * app tuong nguoi dung vua chon mot diem — tuc keo ban do di xem cho khac lai
 * thanh dat ghim o cho vua tha tay.
 *
 * 5px thay vi 0: chuot ai cung rung mot chut luc bam, va tren man cam ung thi
 * ngon tay luon truot vai pixel.
 */
const DRAG_THRESHOLD_PX = 5;

// ─────────────────────────────────────────────────────────────
// Chieu Web Mercator: lat/lon <-> pixel the gioi o mot muc zoom
//
// HAI CHIEU NAM CANH NHAU CO CHU Y. Chieu xuoi dung de VE (ghim, tuyen duong),
// chieu nguoc dung de DOC (nguoi dung bam vao dau tren ban do). Sua mot chieu
// ma quen chieu kia thi ghim ve mot dang con toa do ghi vao event lai mot dang
// — mot loi khong co trieu chung tren man hinh.
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

/** Nghich dao cua `lonToWorldX`. */
function worldXToLon(x: number, zoom: number): number {
  return (x / (TILE_SIZE * 2 ** zoom)) * 360 - 180;
}

/** Nghich dao cua `latToWorldY` — Mercator nguoc dung `atan(sinh(...))`. */
function worldYToLat(y: number, zoom: number): number {
  const n = Math.PI * (1 - (2 * y) / (TILE_SIZE * 2 ** zoom));
  return (Math.atan(Math.sinh(n)) * 180) / Math.PI;
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

export function MapCanvas({
  pickup,
  destination,
  route,
  label,
  fill = false,
  onPick,
  driverPosition,
}: MapCanvasProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  /** Nguoi dung bam +/−; cong vao zoom vua khit. Nut re-center dat lai ve 0. */
  const [zoomOffset, setZoomOffset] = useState(0);

  /**
   * Nguoi dung da keo ban do di bao nhieu pixel so voi khung vua khit.
   * Nut re-center dat lai ve 0, giong `zoomOffset`.
   */
  const [pan, setPan] = useState({ x: 0, y: 0 });

  /**
   * Lan keo dang dien ra. Nam trong ref chu khong phai state: `pointermove` ban
   * hang chuc lan moi giay, de trong state thi moi lan doi con tro deu keo theo
   * mot vong render du chua co gi tren man hinh thay doi.
   */
  const dragRef = useRef<{ startX: number; startY: number; moved: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  /**
   * Nha cung cap tile dang dung + so tile hong lien tiep.
   *
   * Dem nam trong ref chu khong phai state: moi the <img> hong ban mot su kien,
   * de trong state thi mot khung 40 tile hong se keo theo 40 lan render.
   */
  /** Lop phong ve 1: chi nhung nha cung cap da qua phep do o BE. */
  const tileProviders = useTileProviders();

  const [providerIndex, setProviderIndex] = useState(0);
  const failCountRef = useRef(0);
  const provider = tileProviders[providerIndex] ?? tileProviders[0]!;
  /** Het nha cung cap ma van hong — luc nay moi noi that voi nguoi dung. */
  const [tilesDead, setTilesDead] = useState(false);

  // Phep do ve muon hon lan render dau, va co the cat ngan danh sach. Ve dau
  // bang: `providerIndex` cu tro theo bang cu nen sau khi loc no chi con la mot
  // so ngau nhien. Dat lai ca co `tilesDead` — bang moi dang duoc thu lai tu dau.
  useEffect(() => {
    failCountRef.current = 0;
    setProviderIndex(0);
    setTilesDead(false);
  }, [tileProviders]);

  const handleTileError = useCallback(() => {
    failCountRef.current += 1;
    if (failCountRef.current < TILE_FAILS_BEFORE_SWITCH) return;

    failCountRef.current = 0;
    setProviderIndex((current) => {
      const next = current + 1;
      if (next >= tileProviders.length) {
        // Da thu het. Giu nguyen nha cung cap cuoi de tile nao con song van hien.
        setTilesDead(true);
        return current;
      }
      return next;
    });
  }, [tileProviders.length]);

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
    const base = destination ? [pickup, destination] : [pickup];
    // Them vi tri tai xe de khung nhin om ca tai xe
    return driverPosition ? [...base, driverPosition] : base;
  }, [route, pickup, destination, driverPosition]);

  // Doi tuyen/diem thi bo CA zoom lan pan nguoi dung da chinh tay — neu khong,
  // chuyen moi se ke thua khung nhin cua chuyen truoc va co the nam ngoai khung.
  const pointsKey = points.map((p) => `${p.lat},${p.lon}`).join('|');
  useEffect(() => {
    setZoomOffset(0);
    setPan({ x: 0, y: 0 });
  }, [pointsKey]);

  const viewport = useMemo<Viewport | null>(() => {
    if (size.width === 0 || size.height === 0) return null;

    const base = fitZoom(points, size.width, size.height);
    const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, base + zoomOffset));
    const center = centerOf(points);

    // TRU `pan`: keo ban do sang phai nghia la goc khung dich sang TRAI.
    return {
      zoom,
      originX: lonToWorldX(center.lon, zoom) - size.width / 2 - pan.x,
      originY: latToWorldY(center.lat, zoom) - size.height / 2 - pan.y,
    };
  }, [points, size.width, size.height, zoomOffset, pan]);

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

  // Project driver position de dung trong SVG (sau khi project da duoc khai bao)
  const [driverX, driverY] = driverPosition ? project(driverPosition) : [0, 0];

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
          // `key` mang ten nha cung cap: doi nha cung cap thi React phai TAO the
          // <img> moi chu khong sua `src` cua the cu — mot the da hong khong
          // phai luc nao cung tai lai khi chi doi thuoc tinh.
          key: `${provider.name}/${viewport.zoom}/${tx}/${ty}`,
          src: provider.url(viewport.zoom, wrappedX, ty),
          left: tx * TILE_SIZE - viewport.originX,
          top: ty * TILE_SIZE - viewport.originY,
        });
      }
    }
    return out;
  }, [viewport, size.width, size.height, provider]);

  const routeLine = useMemo(() => {
    if (!viewport || !route || route.geometry.length < 2) return '';
    return route.geometry
      .map(([lat, lon]) => project({ lat, lon }).join(','))
      .join(' ');
  }, [viewport, route, project]);

  const [pickupX, pickupY] = project(pickup);
  const [destX, destY] = destination ? project(destination) : [0, 0];

  // ── Keo / bam ───────────────────────────────────────────────

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    // Chi chuot trai / mot ngon tay. Bam phai mo menu ngu canh chu khong keo.
    if (event.button !== 0) return;

    // Cum +/−, nut re-center va dong ghi cong deu nam BEN TRONG khung ban do,
    // nen su kien cua chung noi bot len day. Khong chan thi bam "+" se vua
    // phong to vua tha mot cai ghim xuong dung cho nut do dang nam.
    //
    // Loc theo `closest` chu khong stopPropagation o tung nut: them mot nut moi
    // sau nay se tu dong duoc bao ve, khong phai nho.
    if ((event.target as HTMLElement).closest('button, a')) return;
    // Bat con tro: keo ra NGOAI khung van nhan duoc pointermove, khong thi ban
    // do dung khuc moi lan con tro roi khoi mep.
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startY: event.clientY, moved: 0 };
    setDragging(true);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    // Tong quang duong di duoc, khong phai khoang cach tu diem dau: keo mot vong
    // roi ve dung cho cu VAN la keo, khong phai bam.
    drag.moved += Math.abs(event.movementX) + Math.abs(event.movementY);
    drag.startX = event.clientX;
    drag.startY = event.clientY;

    setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    if (!drag || !onPick || !viewport) return;

    // Di qua nguong = KEO, khong phai bam chon vi tri. Xem DRAG_THRESHOLD_PX.
    if (drag.moved > DRAG_THRESHOLD_PX) return;

    // Toa do bam tinh theo goc khung, khong phai goc trang.
    const rect = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;

    onPick({
      lat: worldYToLat(viewport.originY + localY, viewport.zoom),
      lon: worldXToLon(viewport.originX + localX, viewport.zoom),
    });
  }

  /**
   * Cuon de zoom — CHI o bo cuc `split` (`fill`).
   *
   * Ban do `fill` nam trong mot vung da khoa chieu cao (`lg:h-dvh
   * lg:overflow-hidden`) nen trang khong cuon, bat wheel o do la an toan. Khung
   * 4:3 o /food/confirm thi nam giua mot cot DANG CUON — chan wheel o do se khoa
   * cuon trang ngay giua man xac nhan don.
   */
  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!fill) return;
    setZoomOffset((v) => Math.max(-4, Math.min(4, v + (event.deltaY < 0 ? 1 : -1))));
  }

  const cursor = dragging ? 'cursor-grabbing' : onPick ? 'cursor-crosshair' : 'cursor-grab';

  return (
    <div
      ref={ref}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      // `touch-none` la BAT BUOC: thieu no thi tren man cam ung, keo ban do se
      // cuon ca trang thay vi di chuyen ban do.
      className={`relative touch-none overflow-hidden rounded-xl bg-canvas-soft ${cursor} ${
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
          onError={handleTileError}
          width={TILE_SIZE}
          height={TILE_SIZE}
          className="pointer-events-none absolute max-w-none select-none"
          style={{ left: tile.left, top: tile.top }}
        />
      ))}

      {/* Noi that khi khong con nha cung cap nao tai duoc tile. Truoc day moi
          loi mang deu im lang thoai hoa thanh mot o xam co nut zoom, khong
          phan biet duoc voi "ban do dang tai" hay "loi bo cuc". */}
      {tilesDead ? (
        <div className="absolute inset-0 grid place-items-center px-lg">
          <p className="t-body-sm max-w-[280px] min-w-0 break-words text-center text-body">
            Không tải được nền bản đồ. Ghim và tuyến đường vẫn đúng vị trí.
          </p>
        </div>
      ) : null}

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

          {/* Driver marker — icon xe, mau cam */}
          {driverPosition ? (
            <g transform={`translate(${driverX} ${driverY})`}>
              <ellipse cx="0" cy="2" rx="10" ry="3.5" fill="var(--color-ink)" opacity="0.2" />
              <circle cx="0" cy="-8" r="18" fill="var(--color-warning)" stroke="var(--color-canvas)" strokeWidth="2" />
              <path d="M5 17h14" stroke="var(--color-on-warning)" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M4 17v-4.2a2 2 0 0 1 .2-.9l1.9-3.8A2 2 0 0 1 7.9 7h8.2a2 2 0 0 1 1.8 1.1l1.9 3.8a2 2 0 0 1 .2.9V17" stroke="var(--color-on-warning)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 17v2h3v-2M17 17v2h3v-2" stroke="var(--color-on-warning)" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="7.5" cy="13.5" r="1" fill="var(--color-on-warning)" />
              <circle cx="16.5" cy="13.5" r="1" fill="var(--color-on-warning)" />
            </g>
          ) : null}
        </svg>
      ) : null}

      {/* Lop 3 — dieu khien. Gio chung LAM THAT, khong con trang tri. */}
      <div className="shadow-level-2 absolute top-lg left-lg flex flex-col overflow-hidden rounded-md bg-canvas text-ink">
        <button
          type="button"
          aria-label="Phóng to"
          onClick={() => setZoomOffset((v) => Math.min(v + 1, 4))}
          className="grid size-11 place-items-center border-b border-surface-pressed hover:bg-canvas-soft"
        >
          <Icon name="plus" size={18} />
        </button>
        <button
          type="button"
          aria-label="Thu nhỏ"
          onClick={() => setZoomOffset((v) => Math.max(v - 1, -4))}
          className="grid size-11 place-items-center hover:bg-canvas-soft"
        >
          <Icon name="minus" size={18} />
        </button>
      </div>

      <button
        type="button"
        aria-label="Đưa bản đồ về vừa khít tuyến đường"
        onClick={() => {
          setZoomOffset(0);
          setPan({ x: 0, y: 0 });
        }}
        className="shadow-level-2 absolute right-lg bottom-3xl grid size-11 place-items-center rounded-full bg-canvas text-ink hover:bg-canvas-soft sm:bottom-lg"
      >
        <Icon name="target" size={20} />
      </button>

      {label || route ? (
        <div className="pointer-events-none absolute top-3xl left-16 right-lg z-10 flex min-w-0 flex-col items-center gap-sm sm:top-lg sm:right-0 sm:left-0 sm:block">
          {label ? (
            <div className="t-body-sm-strong shadow-level-2 flex w-full min-w-0 max-w-full items-center gap-sm rounded-pill bg-canvas px-lg py-sm text-ink sm:absolute sm:left-1/2 sm:top-0 sm:w-auto sm:max-w-[70%] sm:-translate-x-1/2">
              <span className="min-w-0 truncate">{label}</span>
            </div>
          ) : null}

          {route ? (
            <div className="shadow-level-2 flex w-full min-w-0 max-w-full flex-col rounded-pill bg-canvas px-lg py-sm text-ink sm:absolute sm:right-lg sm:top-0 sm:w-auto">
              <span className="t-body-sm-strong min-w-0 truncate">
                {route.durationMin} phút • {route.distanceKm} km
              </span>
              {route.source === 'straight' ? (
                // Noi that voi nguoi dung khi con so la duong chim bay — cung thong
                // tin ma `route_source` ghi vao event.
                <span className="t-caption block truncate text-mute">ước lượng — đường chim bay</span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Ghi cong BAT BUOC: du lieu ban do la cua OpenStreetMap du tile duoc
          phuc vu boi CDN nao (CLAUDE.md quy tac 10). Nha cung cap tile nao doi
          hoi ghi cong rieng thi dung canh do — dieu khoan cua CARTO yeu cau. */}
      <span className="t-caption absolute right-0 bottom-0 flex gap-xs bg-canvas/80 px-xs text-body">
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer noopener"
        >
          © OpenStreetMap
        </a>
        {provider.credit ? (
          <a href={provider.credit.href} target="_blank" rel="noreferrer noopener">
            {provider.credit.label}
          </a>
        ) : null}
      </span>
    </div>
  );
}
