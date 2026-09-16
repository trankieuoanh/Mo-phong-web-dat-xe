'use client';

/**
 * /history — lich su di chuyen cua NGUOI DUNG. Theo sample_ui/history.png.
 *
 * KHONG NAM TRONG FUNNEL: khong co trong `SCREENS`, khong goi `useScreenView`,
 * khong goi `trackEvent`. Man nay CHI DOC.
 *
 * Khong co collection `orders` — moi chuyen duoc dung lai tu chinh event ket
 * thuc funnel: `confirm_ride` (mot chuyen xe) va `place_order` (mot don do an).
 * Vi vay hai event do phai TU MO TA du (`address_label`, `pickup_label`...),
 * xem event-taxonomy.md muc `ride_confirm`.
 *
 * Loc theo `user_id` chu khong phai `session_id`: `user_id` song o localStorage
 * nen bang nay ben qua nhieu phien, nhieu ngay — dung nghia "lich su nguoi dung".
 *
 * Duong goi API la `/api/events` SAME-ORIGIN qua proxy rewrites cua Next
 * (apps/web/next.config.ts). Khong bao gio goi thang localhost:4000 — xem
 * CLAUDE.md muc "Ba cai bay da biet".
 */

import { useEffect, useMemo, useState } from 'react';
import { getOffer, getVehicle, type EventDoc } from '@gsm/shared';
import { Icon } from '@/components/Icon';
import { AppShell } from '@/components/shell/AppShell';
import { formatVnd } from '@/lib/format';
import { getUserId } from '@/lib/session';

type Status = 'loading' | 'ready' | 'error';
type Tab = 'ride' | 'food';

/** Mot dong trong bang — da gap tu mot event ket thuc funnel. */
interface Trip {
  code: string;
  at: string;
  /** ride */
  pickup?: string;
  destination?: string;
  vehicle?: string;
  payment?: string;
  /** food */
  itemCount?: number;
  offer?: string;
  /** chung */
  total: number;
}

const RIDE_COLUMNS = ['MÃ ĐƠN', 'ĐIỂM ĐÓN', 'ĐIỂM ĐẾN', 'LOẠI XE', 'CƯỚC PHÍ', 'THANH TOÁN', 'THỜI GIAN'];
const FOOD_COLUMNS = ['MÃ ĐƠN', 'SỐ MÓN', 'ƯU ĐÃI', 'TỔNG TIỀN', 'THỜI GIAN'];

const PAYMENT_LABEL: Record<string, string> = { cash: 'Tiền mặt', qr: 'QR' };

const TIME_FORMAT = new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit',
  minute: '2-digit',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : TIME_FORMAT.format(date);
}

/** `properties` la Record<string, unknown> nen phai ep kieu tung khoa mot. */
function str(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}
function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** Event ket thuc funnel -> mot dong lich su. */
function toTrip(event: EventDoc & { id?: string }): Trip {
  const p = event.properties ?? {};
  // 8 ky tu dau cua document id — du de phan biet, ngan de doc nhu ma don that.
  const code = (event.id ?? '').slice(0, 8).toUpperCase() || '—';

  if (event.event_name === 'confirm_ride') {
    return {
      code,
      at: formatTime(event.created_at),
      pickup: str(p.pickup_label) ?? '—',
      destination: str(p.address_label) ?? '—',
      // `vehicle_id` tra duoc ra ten vi VEHICLES la bang dong (khac dia chi).
      vehicle: getVehicle(str(p.vehicle_id) ?? '')?.name ?? '—',
      payment: PAYMENT_LABEL[str(p.payment_method) ?? ''] ?? '—',
      total: num(p.final_price),
    };
  }

  const offerId = str(p.offer_id);
  return {
    code,
    at: formatTime(event.created_at),
    itemCount: num(p.item_count),
    offer: offerId ? (getOffer(offerId)?.title ?? offerId) : 'Không áp dụng',
    total: num(p.final_total),
  };
}

export default function HistoryPage() {
  const [events, setEvents] = useState<(EventDoc & { id?: string })[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [userId, setUserId] = useState('');
  const [tab, setTab] = useState<Tab>('ride');
  const [query, setQuery] = useState('');

  useEffect(() => {
    // getUserId() cham localStorage nen chi duoc goi trong effect,
    // khong goi luc render (apps/web/lib/session.ts).
    const id = getUserId();
    setUserId(id);

    let cancelled = false;

    fetch(`/api/events?user_id=${encodeURIComponent(id)}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) {
          // Route GET co y tra nguyen van thong bao loi cua Firestore vi no
          // chua LINK TAO INDEX can bam (apps/api/src/routes/events.routes.ts).
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        return body as (EventDoc & { id?: string })[];
      })
      .then((data) => {
        if (cancelled) return;
        setEvents(data);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setErrorMessage(error instanceof Error ? error.message : 'Không đọc được dữ liệu');
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const trips = useMemo(() => {
    const wanted = tab === 'ride' ? 'confirm_ride' : 'place_order';
    const rows = events.filter((e) => e.event_name === wanted).map(toTrip);
    // Moi nhat len dau — nguoc voi thu tu tang dan cua API.
    rows.reverse();

    const keyword = query.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((t) =>
      [t.code, t.pickup, t.destination, t.vehicle].some((v) =>
        v?.toLowerCase().includes(keyword),
      ),
    );
  }, [events, tab, query]);

  const totalSpent = trips.reduce((sum, t) => sum + t.total, 0);
  const columns = tab === 'ride' ? RIDE_COLUMNS : FOOD_COLUMNS;

  return (
    <AppShell section="Hoạt động">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-lg">
        <div>
          <h1 className="t-display-sm">Lịch sử chuyến đi</h1>
          <p className="t-caption mt-xxs text-mute">
            Người dùng: <span className="font-medium text-body">{userId || '—'}</span>
          </p>
        </div>

        {/* Tab — o day BAM DUOC that (khac tab trang tri o top bar). */}
        <div className="flex gap-2xl border-b border-surface-pressed">
          {(
            [
              ['ride', 'Di chuyển'],
              ['food', 'Đặt đồ ăn'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`t-body-md-strong border-b-2 pb-md transition-colors ${
                tab === id ? 'border-primary text-ink' : 'border-transparent text-body'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-md">
          <div className="flex min-w-[280px] flex-1 items-center gap-md rounded-md bg-canvas px-lg py-md">
            <Icon name="search" size={20} className="text-body" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm bằng mã đơn hoặc địa chỉ"
              aria-label="Tìm bằng mã đơn hoặc địa chỉ"
              className="t-body-md w-full bg-transparent text-ink outline-none placeholder:text-mute"
            />
          </div>
        </div>

        {/* Hai the tong ket — dung nhu history.png. */}
        <div className="grid gap-lg sm:grid-cols-2">
          <StatCard
            label={tab === 'ride' ? 'Tổng số chuyến' : 'Tổng số đơn'}
            value={status === 'ready' ? String(trips.length) : '--'}
          />
          <StatCard
            label="Tổng chi tiêu"
            value={status === 'ready' && trips.length > 0 ? formatVnd(totalSpent) : '--'}
          />
        </div>

        <div className="overflow-hidden rounded-xl bg-canvas">
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[840px] border-collapse text-left">
              <thead>
                <tr className="border-b border-surface-pressed bg-canvas-soft">
                  {columns.map((column) => (
                    <th key={column} className="t-caption px-lg py-md font-medium text-body">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {status === 'loading' ? (
                  Array.from({ length: 4 }, (_, i) => (
                    <tr key={i} className="border-b border-canvas-soft">
                      {columns.map((column) => (
                        <td key={column} className="px-lg py-md">
                          <span className="block h-4 animate-pulse rounded-pill bg-canvas-soft" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : status === 'error' ? (
                  <tr>
                    <td colSpan={columns.length} className="px-lg py-3xl text-center">
                      <p className="t-body-md-strong">Không đọc được dữ liệu</p>
                      {/* Hien nguyen van: thong bao cua Firestore co the chua link tao index. */}
                      <p className="t-caption mt-xs break-all text-body">{errorMessage}</p>
                      <p className="t-caption mt-md text-mute">
                        Kiểm tra apps/api đã chạy chưa và credential Firebase trong apps/api/.env —
                        xem setup.md.
                      </p>
                    </td>
                  </tr>
                ) : trips.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="t-body-md px-lg py-3xl text-center text-body"
                    >
                      Không có kết quả nào
                    </td>
                  </tr>
                ) : (
                  trips.map((trip, index) => (
                    <tr
                      key={`${trip.code}-${index}`}
                      className="border-b border-canvas-soft last:border-b-0"
                    >
                      <td className="t-body-sm-strong px-lg py-md">{trip.code}</td>
                      {tab === 'ride' ? (
                        <>
                          <td className="t-body-sm max-w-[220px] truncate px-lg py-md text-body">
                            {trip.pickup}
                          </td>
                          <td className="t-body-sm max-w-[220px] truncate px-lg py-md text-body">
                            {trip.destination}
                          </td>
                          <td className="t-body-sm px-lg py-md text-body">{trip.vehicle}</td>
                        </>
                      ) : (
                        <>
                          <td className="t-body-sm px-lg py-md text-body">{trip.itemCount} món</td>
                          <td className="t-body-sm px-lg py-md text-body">{trip.offer}</td>
                        </>
                      )}
                      <td className="t-body-md-strong px-lg py-md">{formatVnd(trip.total)}</td>
                      {tab === 'ride' ? (
                        <td className="t-body-sm px-lg py-md text-body">{trip.payment}</td>
                      ) : null}
                      <td className="t-body-sm px-lg py-md text-body">{trip.at}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-canvas-soft p-2xl">
      <p className="t-body-sm text-body">{label}</p>
      <p className="t-display-md mt-xxs">{value}</p>
    </div>
  );
}
