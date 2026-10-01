/**
 * Doc 11 bang phan tich (dim_*, fact_*) tu D1 — du lieu tu powerBI/*.csv.
 * Thiet ke: docs/d1-schema-design.md muc 12. CHI DOC.
 */
import 'server-only';
import { d1Query } from '../db/d1';
import { encodeCursor, type AnalyticsQuery } from '../validators/analytics.validator';

export interface AnalyticsTable {
  /** Cot khoa chinh, theo thu tu — cung la thu tu sap xep va khoa phan trang. */
  pk: string[];
  /** Cot thoi diem cho `from`/`to` (UTC ISO micro-giay). Vang = bang khong loc theo thoi gian. */
  timeColumn?: string;
  /** SQLite luu 0/1; API tra `true`/`false` nhu CSV goc. */
  booleanColumns: string[];
}

/** DANH SACH TRANG — 11 bang = 11 file CSV. Khop migrations/0002_analytics_schema.sql. */
export const ANALYTICS_TABLES: Record<string, AnalyticsTable> = {
  dim_region: { pk: ['region_id'], booleanColumns: [] },
  dim_hex: { pk: ['hex_id'], booleanColumns: [] },
  dim_promo: { pk: ['promo_code'], booleanColumns: ['has_cap_change'] },
  dim_promo_cap_history: { pk: ['cap_version_id'], booleanColumns: [] },
  dim_date: { pk: ['date_key'], booleanColumns: ['is_weekend', 'is_campaign_day'] },
  dim_merchant: { pk: ['merchant_id'], booleanColumns: [] },
  dim_user: { pk: ['user_id'], booleanColumns: [] },
  fact_promo_budget: { pk: ['month_start', 'service', 'hex_id', 'segment'], booleanColumns: [] },
  fact_ride: { pk: ['session_id'], timeColumn: 'session_start', booleanColumns: ['is_peak_hour', 'is_rainy', 'is_campaign_day', 'promo_viewed', 'cap_applied'] },
  fact_food: { pk: ['session_id'], timeColumn: 'session_start', booleanColumns: ['is_peak_hour', 'is_rainy', 'is_campaign_day', 'topped_up_to_qualify', 'promo_viewed', 'cap_applied'] },
  fact_promo_burn: { pk: ['burn_event_id'], timeColumn: 'event_datetime', booleanColumns: ['cap_applied', 'is_trip_completed'] },
};

export function getAnalyticsTable(name: string): AnalyticsTable | null {
  // Object.hasOwn: chan `__proto__`, `constructor`… khong phai ten bang.
  return Object.hasOwn(ANALYTICS_TABLES, name) ? ANALYTICS_TABLES[name]! : null;
}

/** Ham serverless cua Vercel gioi han than phan hoi ~4,5 MB — chua 0,5 MB du phong. */
const MAX_RESPONSE_BYTES = 4_000_000;

type Row = Record<string, unknown>;

function toApiRow(row: Row, table: AnalyticsTable): Row {
  for (const col of table.booleanColumns) {
    if (row[col] !== null && row[col] !== undefined) row[col] = row[col] === 1;
  }
  return row;
}

function toIsoMicros(date: Date): string {
  return `${date.toISOString().slice(0, 23)}000Z`;
}

export async function readAnalyticsTable(
  name: string,
  table: AnalyticsTable,
  query: AnalyticsQuery,
): Promise<{ rows: Row[]; next_cursor: string | null }> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (query.after) {
    // So sanh bo (row value) — SQLite >= 3.15; dung duoc cho khoa chinh ghep (fact_promo_budget).
    where.push(`(${table.pk.join(', ')}) > (${table.pk.map(() => '?').join(', ')})`);
    params.push(...query.after);
  }
  if (table.timeColumn && query.from) {
    where.push(`${table.timeColumn} >= ?`);
    params.push(toIsoMicros(query.from));
  }
  if (table.timeColumn && query.to) {
    where.push(`${table.timeColumn} <= ?`);
    params.push(toIsoMicros(query.to));
  }

  // `name` va cac ten cot deu den tu bang trang o tren, khong tu request.
  const sql =
    `SELECT * FROM ${name}` +
    (where.length > 0 ? ` WHERE ${where.join(' AND ')}` : '') +
    ` ORDER BY ${table.pk.join(', ')} LIMIT ?`;
  // Lay du 1 dong de biet con trang sau hay khong.
  const { results } = await d1Query<Row>(sql, [...params, query.limit + 1]);

  let hasMore = results.length > query.limit;
  let rows = results.slice(0, query.limit).map((r) => toApiRow(r, table));

  // Bang rong 55 cot x 5.000 dong co the vuot gioi han than phan hoi: cat doi cho toi khi vua.
  while (rows.length > 1 && Buffer.byteLength(JSON.stringify(rows)) > MAX_RESPONSE_BYTES) {
    rows = rows.slice(0, Math.ceil(rows.length / 2));
    hasMore = true;
  }

  const last = rows[rows.length - 1];
  const next_cursor =
    hasMore && last ? encodeCursor(table.pk.map((col) => last[col] as string | number)) : null;
  return { rows, next_cursor };
}
