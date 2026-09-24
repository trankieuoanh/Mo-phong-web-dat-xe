/**
 * Cong ra cac dich vu ben ngoai (Nominatim, OSRM): hang doi + cache.
 *
 * Tach ra thanh mot cho vi ca hai dich vu deu la ha tang cong dong mien phi voi
 * cung mot rang buoc — dung goi don dap, va dung hoi lai thu vua hoi. Chep logic
 * nay hai lan nghia la sua mot ben quen ben kia, ma trieu chung cua no la bi
 * chan IP giua luc demo chu khong phai mot test do.
 */
import 'server-only';

interface GateOptions {
  /** Khoang cach toi thieu giua hai lan goi upstream, don vi ms. */
  minGapMs: number;
  /** Thoi gian song cua mot muc cache, don vi ms. */
  ttlMs: number;
  maxEntries: number;
}

/**
 * Ket qua RONG co duoc cache khong? Mac dinh la KHONG.
 *
 * Mot mang rong la mot cau tra loi hop le, nen ban dau no duoc cache nhu moi
 * gia tri khac. Nhung hau qua thi khong hop le chut nao: mot lan "khong tim
 * thay quan nao" se dong bang dai "Gan ban" suot CA TTL, va nut "Thu lai" tra
 * ve dung cai mang rong do tuc thi — bam bao nhieu lan cung vo ich, va nhin tu
 * phia nguoi dung thi app don gian la hong.
 *
 * Ket qua rong gan nhu luon la dau hieu cua mot van de tam thoi (upstream chap
 * chon, ban kinh hoi hep, toa do vua doi), nen hoi lai la dung.
 */
function shouldCache(value: unknown): boolean {
  return !(Array.isArray(value) && value.length === 0);
}

interface CacheEntry<T> {
  at: number;
  value: T;
}

export interface UpstreamGate {
  /**
   * Chay `work` sau khi da den luot va da cho du `minGapMs`.
   * Neu `key` con trong cache thi tra ngay, khong cham upstream.
   */
  run<T>(key: string, work: () => Promise<T>): Promise<T>;
}

export function createUpstreamGate(options: GateOptions): UpstreamGate {
  const cache = new Map<string, CacheEntry<unknown>>();

  /**
   * Hang doi mot lan mot. Moi luot noi vao `chain`, nen hai request den cung
   * luc van ra upstream cach nhau >= minGapMs thay vi song song.
   */
  let chain: Promise<unknown> = Promise.resolve();
  let lastCallAt = 0;

  function read<T>(key: string): T | null {
    const hit = cache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.at > options.ttlMs) {
      cache.delete(key);
      return null;
    }
    // Ghi lai de khoa vua dung nhay ve cuoi — Map giu thu tu chen, nen xoa khoa
    // dau tien ben duoi chinh la xoa cai cu nhat (LRU nguoi ngheo).
    cache.delete(key);
    cache.set(key, hit);
    return hit.value as T;
  }

  function write<T>(key: string, value: T): void {
    cache.set(key, { at: Date.now(), value });
    while (cache.size > options.maxEntries) {
      const oldest = cache.keys().next();
      if (oldest.done) break;
      cache.delete(oldest.value);
    }
  }

  return {
    run<T>(key: string, work: () => Promise<T>): Promise<T> {
      const cached = read<T>(key);
      if (cached !== null) return Promise.resolve(cached);

      // `.catch` giu chain song sot khi mot luot that bai — neu khong, moi
      // request sau do se thua lai loi cu.
      const next = chain.catch(() => {}).then(async () => {
        // Doc lai cache ngay truoc khi goi: trong luc cho den luot, mot request
        // truoc do co the da hoi dung khoa nay va dien san ket qua.
        const late = read<T>(key);
        if (late !== null) return late;

        const waitMs = options.minGapMs - (Date.now() - lastCallAt);
        if (waitMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
        lastCallAt = Date.now();

        const value = await work();
        if (shouldCache(value)) write(key, value);
        return value;
      });

      chain = next;
      return next;
    },
  };
}
