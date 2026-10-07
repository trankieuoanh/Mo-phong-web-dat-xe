'use client';

/**
 * Mo phong mot xe chay doc `geometry` (tuyen that). Dung chung cho xe cong nghe (diem don → diem
 * den) va xe giao hang (quan → khach): hook KHONG biet "tai xe" hay "don hang" — chi biet mot tuyen.
 *
 * KHONG BAN EVENT NAO. Chi doc tuyen da co, KHONG goi lai OSRM.
 *
 * Vi tri noi suy theo DO DAI tich luy cua tuyen (pointAlong), nen xe di deu va khong nhay qua tung
 * diem. Cap nhat state ~20 lan/giay chu khong phai moi frame: ban do chi can xe muot, khong can 60fps,
 * va moi lan cap nhat la mot lan render MapCanvas.
 */

import { useEffect, useRef, useState } from 'react';
import { pointAlong, type RoutePoint } from '@/lib/shared';

export type VehicleStatus = 'idle' | 'moving' | 'arrived';

export interface VehicleSimulation {
  position: RoutePoint | null;
  /** 0..1 */
  progress: number;
  status: VehicleStatus;
}

/** Khoang cach toi thieu giua hai lan setState (ms) ≈ 20 fps. */
const MIN_FRAME_MS = 50;

/**
 * Thoi gian mo phong ca chuyen: nen thoi gian that cho vua mat nguoi xem. Chuyen 16 phut → 45 giay.
 * Gioi han 20–45 giay de chuyen rat ngan van thay xe chay, chuyen rat dai khong bat nguoi dung doi.
 */
export function simulationDurationMs(durationMin: number): number {
  return Math.max(20_000, Math.min(45_000, (durationMin * 60 * 1000) / 10));
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/**
 * @param geometry  `[lat, lon][]` cua tuyen, hoac `null` khi chua co.
 * @param durationMs thoi gian chay het tuyen (xem `simulationDurationMs`).
 * @param enabled   false = dung xe o diem dau, khong chay.
 */
export function useVehicleSimulation(
  geometry: [number, number][] | null,
  durationMs: number,
  enabled = true,
): VehicleSimulation {
  const [sim, setSim] = useState<VehicleSimulation>({ position: null, progress: 0, status: 'idle' });
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!geometry || geometry.length < 2) {
      setSim({ position: null, progress: 0, status: 'idle' });
      return;
    }
    if (!enabled) {
      setSim({ position: pointAlong(geometry, 0), progress: 0, status: 'idle' });
      return;
    }
    // Nguoi dung tat chuyen dong: nhay thang toi noi, khong hoat canh.
    if (prefersReducedMotion()) {
      setSim({ position: pointAlong(geometry, 1), progress: 1, status: 'arrived' });
      return;
    }

    const startedAt = performance.now();
    let lastPaint = 0;
    setSim({ position: pointAlong(geometry, 0), progress: 0, status: 'moving' });

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      if (progress >= 1) {
        setSim({ position: pointAlong(geometry, 1), progress: 1, status: 'arrived' });
        frameRef.current = null;
        return;
      }
      if (now - lastPaint >= MIN_FRAME_MS) {
        lastPaint = now;
        setSim({ position: pointAlong(geometry, progress), progress, status: 'moving' });
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
    // `geometry` la tham chieu cua mot tuyen da chup: doi tuyen (hiem) thi bat dau lai.
  }, [geometry, durationMs, enabled]);

  return sim;
}
