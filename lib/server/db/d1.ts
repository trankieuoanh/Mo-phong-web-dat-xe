/**
 * Noi DUY NHAT trong app cam token Cloudflare — goi D1 qua REST API (khong binding, vi app
 * chay tren Vercel chu khong phai Cloudflare Workers). Xem docs/d1-schema-design.md.
 *
 * `import 'server-only'`: keo file nay vao Client Component la build do ngay (CLAUDE.md quy tac 1).
 * Moi SQL phai THAM SO HOA (`?` + params) — khong bao gio noi chuoi.
 *
 * Khoi tao tre: GET /api/health khong import file nay, nen van tra loi khi chua co credential.
 */
import 'server-only';

export interface D1Meta {
  rows_read: number;
  rows_written: number;
  changes: number;
  duration: number;
}

export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  meta: D1Meta;
}

export interface D1Statement {
  sql: string;
  params?: unknown[];
}

export class D1Error extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'D1Error';
  }
}

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;

function readConfig() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const missing = [
    !accountId && 'CLOUDFLARE_ACCOUNT_ID',
    !databaseId && 'CLOUDFLARE_D1_DATABASE_ID',
    !token && 'CLOUDFLARE_API_TOKEN',
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new D1Error(
      `Thieu bien moi truong Cloudflare D1: ${missing.join(', ')}. ` +
        'Xem .env.example va docs/d1-schema-design.md.',
    );
  }
  return {
    url: `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    token: token!,
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface ApiResponse {
  success?: boolean;
  errors?: { code?: number; message?: string }[];
  result?: (D1Result & { success?: boolean })[];
}

/**
 * Chay mot MANG cau lenh nhu mot transaction (batch cua D1: tat ca hoac khong).
 * Retry co backoff chi cho loi tam thoi (429, 5xx, mang, timeout). Loi SQL/rang buoc nem thang.
 */
export async function d1Batch(statements: D1Statement[]): Promise<D1Result[]> {
  if (statements.length === 0) return [];
  const { url, token } = readConfig();
  const body = JSON.stringify(
    statements.length === 1
      ? { sql: statements[0]!.sql, params: statements[0]!.params ?? [] }
      : { batch: statements.map((s) => ({ sql: s.sql, params: s.params ?? [] })) },
  );

  for (let attempt = 1; ; attempt += 1) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: 'no-store',
      });
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS) {
        throw new D1Error(`Khong goi duoc D1: ${error instanceof Error ? error.message : String(error)}`);
      }
      await sleep(300 * 3 ** (attempt - 1));
      continue;
    }

    if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
      const retryAfter = Number(res.headers.get('retry-after')) * 1000;
      await sleep(retryAfter > 0 ? Math.min(retryAfter, 5000) : 300 * 3 ** (attempt - 1));
      continue;
    }

    const data = (await res.json().catch(() => null)) as ApiResponse | null;
    if (!res.ok || !data?.success || !Array.isArray(data.result)) {
      const detail =
        (data?.errors ?? []).map((e) => `${e.code ?? ''} ${e.message ?? ''}`.trim()).join('; ') ||
        `HTTP ${res.status}`;
      throw new D1Error(`D1 tu choi cau lenh: ${detail}`, res.status);
    }
    return data.result;
  }
}

/** Mot cau lenh. Tra ve `{ results, meta }`. */
export async function d1Query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<D1Result<T>> {
  const [result] = await d1Batch([{ sql, params }]);
  return result as D1Result<T>;
}
