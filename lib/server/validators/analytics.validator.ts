/**
 * Validate tham so cua GET /api/analytics/<table> — docs/d1-schema-design.md muc 12.
 * Ten bang KHONG bao gio di tu request vao SQL: chi tra ngược tu bang trang `ANALYTICS_TABLES`.
 */
import 'server-only';

export const DEFAULT_LIMIT = 2000;
export const MAX_LIMIT = 5000;

export interface AnalyticsQuery {
  limit: number;
  /** Gia tri khoa chinh cua dong CUOI trang truoc (giai ma tu `after`). */
  after?: (string | number)[];
  from?: Date;
  to?: Date;
}

export type AnalyticsQueryResult = { ok: true; value: AnalyticsQuery } | { ok: false; error: string };

export function encodeCursor(values: (string | number)[]): string {
  return Buffer.from(JSON.stringify(values)).toString('base64url');
}

function decodeCursor(raw: string, pkLength: number): (string | number)[] | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString());
    if (
      Array.isArray(parsed) &&
      parsed.length === pkLength &&
      parsed.every((v) => typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v)))
    ) {
      return parsed as (string | number)[];
    }
  } catch {
    /* xuong duoi */
  }
  return null;
}

export function validateAnalyticsQuery(
  params: URLSearchParams,
  opts: { pkLength: number; hasTimeColumn: boolean },
): AnalyticsQueryResult {
  const query: AnalyticsQuery = { limit: DEFAULT_LIMIT };

  const limit = params.get('limit');
  if (limit !== null) {
    const n = Number(limit);
    if (!Number.isInteger(n) || n < 1 || n > MAX_LIMIT) {
      return { ok: false, error: `Invalid value for limit: expected an integer 1..${MAX_LIMIT}` };
    }
    query.limit = n;
  }

  const after = params.get('after');
  if (after !== null) {
    const values = decodeCursor(after, opts.pkLength);
    if (!values) return { ok: false, error: 'Invalid value for after: expected the next_cursor of a previous page' };
    query.after = values;
  }

  for (const key of ['from', 'to'] as const) {
    const value = params.get(key);
    if (value === null) continue;
    if (!opts.hasTimeColumn) return { ok: false, error: `${key} is not supported for this table` };
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: `Invalid value for ${key}: expected an ISO date (e.g. 2026-07-01)` };
    }
    query[key] = parsed;
  }

  return { ok: true, value: query };
}
