/**
 * Cache ket qua doc D1: TTL + single-flight + tra ban cu khi loi.
 *
 * Ly do ton tai: moi `GET /api/events` khong loc la MOT LAN DOC TOAN BO
 * collection (~9.000 luot doc), ma free tier chi co 50.000 luot/ngay. Power BI
 * refresh vai lan la het han muc. Xem api-endpoints.md muc 3.
 *
 * Khac `upstream.ts` o ba cho, nen KHONG dung lai no:
 *   1. Khong co hang doi noi tiep — hai khoa khac nhau duoc doc song song.
 *   2. Single-flight THEO KHOA: 10 request cung luc cho cung mot khoa chi sinh
 *      MOT query D1; 9 request con lai cho chung mot promise.
 *   3. Muc het han KHONG bi xoa ngay — no la duong lui khi lan lam moi that bai.
 *
 * Cache nam trong bo nho tien trinh: mat khi restart, va tren Vercel moi lambda
 * instance co ban rieng. Xem ARCHITECTURE.md muc "Cai gia cua viec gop".
 */
import 'server-only';

export type CacheStatus = 'HIT' | 'MISS' | 'REFRESH' | 'WAIT' | 'STALE';

export interface CacheResult<T> {
  value: T;
  status: CacheStatus;
}

export interface CacheStats {
  hits: number;
  misses: number;
  refreshes: number;
  waits: number;
  stale: number;
  errors: number;
  entries: number;
}

interface QueryCacheOptions<T> {
  /** Tien to log, vd `events` → `[events] CACHE HIT`. */
  name: string;
  ttlMs: number;
  maxEntries: number;
  /** Ket qua khong qua duoc ham nay thi KHONG vao cache va bi coi la loi. */
  validate: (value: T) => boolean;
  /** So ban ghi de in log — mac dinh do dai mang, `?` neu khong phai mang. */
  size?: (value: T) => number;
  /** Tiem dong ho gia khi test — mac dinh `Date.now`. */
  now?: () => number;
}

interface CacheEntry<T> {
  value: T;
  cachedAt: number;
  expiresAt: number;
}

interface Flight<T> {
  promise: Promise<CacheResult<T>>;
}

/**
 * `previous` la gia tri dang nam trong cache (ke ca khi da het han) — cho phep
 * lam moi TANG DAN thay vi doc lai tu dau. KHONG duoc sua `previous` tai cho:
 * lan lam moi co the that bai, va khi do chinh `previous` duoc tra ve (STALE).
 */
export type CacheLoader<T> = (previous: T | undefined) => Promise<T>;

export interface QueryCache<T> {
  get(key: string, load: CacheLoader<T>): Promise<CacheResult<T>>;
  /** Xoa cac khoa khop `match` (vang = xoa het). Tra ve so khoa da xoa. */
  invalidate(match?: (key: string) => boolean): number;
  stats(): CacheStats;
}

export function createQueryCache<T>(options: QueryCacheOptions<T>): QueryCache<T> {
  const now = options.now ?? Date.now;
  const tag = `[${options.name}]`;
  const cache = new Map<string, CacheEntry<T>>();
  const inflight = new Map<string, Flight<T>>();
  const counters = { hits: 0, misses: 0, refreshes: 0, waits: 0, stale: 0, errors: 0 };
  const sizeOf = (value: T): string =>
    options.size ? String(options.size(value)) : Array.isArray(value) ? String(value.length) : '?';

  function write(key: string, value: T): void {
    const at = now();
    // Xoa roi chen lai de khoa vua ghi nhay ve cuoi Map — cung kieu LRU voi upstream.ts.
    cache.delete(key);
    cache.set(key, { value, cachedAt: at, expiresAt: at + options.ttlMs });
    while (cache.size > options.maxEntries) {
      const oldest = cache.keys().next();
      if (oldest.done) break;
      cache.delete(oldest.value);
    }
  }

  function startFlight(key: string, previous: CacheEntry<T> | undefined, load: CacheLoader<T>) {
    // Dat `flight` vao Map TRUOC khi goi `load`, va moi lan ghi deu so danh tinh
    // `flight`: neu `invalidate` da go khoa nay giua chung thi ket qua cua lan
    // doc cu (bat dau truoc lan ghi) khong duoc phep lot vao cache.
    const flight = {} as Flight<T>;
    inflight.set(key, flight);

    const startedAt = now();
    if (previous) {
      counters.refreshes += 1;
      console.log(`${tag} CACHE REFRESH START key=${key} age=${Math.round((startedAt - previous.cachedAt) / 1000)}s`);
    } else {
      counters.misses += 1;
      console.log(`${tag} CACHE MISS key=${key}`);
    }

    flight.promise = (async (): Promise<CacheResult<T>> => {
      try {
        const value = await load(previous?.value);
        if (!options.validate(value)) {
          throw new Error(`${tag} ket qua doc ve khong hop le — khong cache`);
        }
        if (inflight.get(key) === flight) write(key, value);
        console.log(
          `${tag} CACHE REFRESH SUCCESS key=${key} records=${sizeOf(value)} duration=${now() - startedAt}ms`,
        );
        return { value, status: previous ? 'REFRESH' : 'MISS' };
      } catch (error) {
        counters.errors += 1;
        // Doc lai tu Map chu khong dung `previous`: neu khoa vua bi invalidate
        // thi ban cu KHONG con dang tin, tra loi 500 dung hon tra du lieu sai.
        const fallback = inflight.get(key) === flight ? cache.get(key) : undefined;
        if (fallback) {
          counters.stale += 1;
          console.warn(
            `${tag} CACHE REFRESH FAILED — serving stale key=${key} age=${Math.round((now() - fallback.cachedAt) / 1000)}s:`,
            error instanceof Error ? error.message : error,
          );
          return { value: fallback.value, status: 'STALE' };
        }
        console.warn(`${tag} CACHE REFRESH FAILED key=${key} — khong co ban cu de lui`);
        throw error;
      } finally {
        if (inflight.get(key) === flight) inflight.delete(key);
      }
    })();

    return flight.promise;
  }

  return {
    async get(key, load) {
      const entry = cache.get(key);
      if (entry && now() < entry.expiresAt) {
        counters.hits += 1;
        cache.delete(key);
        cache.set(key, entry);
        console.log(
          `${tag} CACHE HIT key=${key} records=${sizeOf(entry.value)} age=${Math.round((now() - entry.cachedAt) / 1000)}s`,
        );
        return { value: entry.value, status: 'HIT' };
      }

      const pending = inflight.get(key);
      if (pending) {
        counters.waits += 1;
        console.log(`${tag} CACHE WAIT key=${key}`);
        const result = await pending.promise;
        return { value: result.value, status: result.status === 'STALE' ? 'STALE' : 'WAIT' };
      }

      return startFlight(key, entry, load);
    },

    invalidate(match) {
      let removed = 0;
      for (const key of [...cache.keys()]) {
        if (!match || match(key)) {
          cache.delete(key);
          removed += 1;
        }
      }
      // Go luon lan doc dang bay: no bat dau TRUOC lan ghi nen ket qua da cu.
      // Request dang cho no van nhan ket qua (khong ai bi bo roi), chi la ket qua
      // do khong duoc ghi vao cache.
      for (const key of [...inflight.keys()]) {
        if (!match || match(key)) inflight.delete(key);
      }
      if (removed > 0) console.log(`${tag} CACHE INVALIDATED n=${removed}`);
      return removed;
    },

    stats() {
      return { ...counters, entries: cache.size };
    },
  };
}
