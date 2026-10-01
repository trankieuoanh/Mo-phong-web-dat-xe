/**
 * GET /api/analytics/<table> — doc mot trong 11 bang phan tich (dim_*, fact_*) tu D1.
 *
 * 11 bang = 11 file CSV cu cua powerBI/, moi bang mot URL:
 *   /api/analytics/dim_region, /api/analytics/fact_ride, …  (danh sach: ANALYTICS_TABLES)
 *
 * Tham so: `limit` (mac dinh 2000, toi da 5000), `after` (= `next_cursor` cua trang truoc),
 * `from` / `to` (chi bang fact_* co cot thoi gian). Phan hoi: `{ rows, next_cursor }`.
 * Bang khac ngoai danh sach -> 404. CHI DOC. Bao ve bang `ANALYTICS_TOKEN` tuy chon (read-auth.ts).
 */
import type { NextRequest } from 'next/server';
import { getAnalyticsTable, readAnalyticsTable } from '@/lib/server/services/analytics.service';
import { isReadAllowed } from '@/lib/server/services/read-auth';
import { validateAnalyticsQuery } from '@/lib/server/validators/analytics.validator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: Promise<{ table: string }> }) {
  if (!isReadAllowed(request)) {
    return Response.json({ error: 'Cần Authorization: Bearer <token>' }, { status: 401 });
  }

  const { table: name } = await context.params;
  const table = getAnalyticsTable(name);
  if (!table) return Response.json({ error: `Unknown table: ${name}` }, { status: 404 });

  const result = validateAnalyticsQuery(request.nextUrl.searchParams, {
    pkLength: table.pk.length,
    hasTimeColumn: table.timeColumn !== undefined,
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });

  try {
    return Response.json(await readAnalyticsTable(name, table, result.value));
  } catch (error) {
    console.error(`[GET /api/analytics/${name}] doc D1 that bai:`, error);
    return Response.json({ error: 'Could not read table' }, { status: 500 });
  }
}
