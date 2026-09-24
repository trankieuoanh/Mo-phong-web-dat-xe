/**
 * Do xem nha cung cap tile nao con dung duoc. Xem api-endpoints.md muc 3d.
 *
 * VI SAO PHAI CO DICH VU NAY. `MapCanvas.tsx` da co san co che dem tile hong roi
 * nhay sang nha cung cap du phong — nhung no dua vao su kien `onError` cua the
 * <img>, ma `onError` chi bat duoc "KHONG TAI DUOC", khong bat duoc "TAI DUOC
 * NHUNG SAI".
 *
 * Do dung la thu da xay ra: CARTO chuyen sang bat buoc API key va bat dau in chu
 * "API KEY REQUIRED" cheo len moi tile — nhung van tra HTTP 200 kem mot file PNG
 * hop le. `onError` khong bao gio ban, bo dem mai bang 0, va ban do hong suot ma
 * app khong he biet.
 *
 * Phep do o day bu dung cho trong do. Hai co che BO SUNG cho nhau, khong thay
 * the nhau:
 *   - phep do nay (BE)  bat "200 nhung tile sai";
 *   - `onError` (FE)    bat "trinh duyet khong tai duoc" — mang cua nguoi dung
 *                       co the chan mot ten mien ma may chay BE van goi duoc.
 */
import 'server-only';
import { PROBE_MAX_BYTES, PROBE_TILE, TILE_PROVIDERS } from '@/lib/shared';
import { createUpstreamGate } from './upstream';

/** Qua moc nay thi coi nhu nha cung cap do khong tra loi. */
const UPSTREAM_TIMEOUT_MS = 8000;

const gate = createUpstreamGate({
  // Mot muc cache cho moi origin, nen minGapMs gan nhu khong bao gio cham toi —
  // no o day de phong hai tab cung mo mot luc.
  minGapMs: 300,
  // 6 gio: mot nha cung cap khong khoa API key giua buoi demo. Giu dai de app
  // khong hoi lai upstream moi lan doi trang.
  ttlMs: 6 * 60 * 60 * 1000,
  // Du cho localhost + domain production + vai domain preview cua Vercel.
  maxEntries: 8,
});

/**
 * Mot nha cung cap "dung duoc" khi tile bien sau cua no vua tai duoc, vua DU
 * NHO. Xem chu thich cua `PROBE_MAX_BYTES` trong lib/shared/tiles.ts
 * de biet vi sao kich thuoc lai la thu phan biet duoc watermark.
 *
 * NEM khi khong ket noi duoc — day la truong hop KHONG KET LUAN DUOC, khac han
 * voi `false` (da tra loi, va cau tra loi sai). Xem `probeAll`.
 */
async function probe(url: string, origin: string): Promise<boolean> {
  const response = await fetch(url, {
    headers: {
      Accept: 'image/png,image/*',
      // Stadia chan theo Referer: khong co header nay thi no tra 401, va phep do
      // se ket luan nham la Stadia chet. Dat THANG vao headers chu khong dung
      // tuy chon `referrer` cua fetch — tuy chon do la khai niem cua trinh duyet
      // va undici khong phai luc nao cung dich no ra header that.
      //
      // `origin` di tu route handler xuong, lay tu CHINH request cua trinh
      // duyet — xem app/api/tiles/route.ts. Khong con bien moi truong nao de
      // dat sai o day.
      Referer: origin,
    },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });

  if (!response.ok) return false;
  if (!(response.headers.get('content-type') ?? '').startsWith('image/')) return false;

  // Doc han body chu khong tin `content-length`: header do vang mat khi upstream
  // tra ve dang chunked, va khi ay `Number(null)` cho ra 0 — tuc la mot nha cung
  // cap hong se duoc cham diem "sach nhat bang".
  const body = await response.arrayBuffer();
  return body.byteLength <= PROBE_MAX_BYTES;
}

/**
 * VIEC CUA PHEP DO LA LOAI NHA CUNG CAP DA CHUNG MINH LA HONG — khong phai chi
 * nhan nhung nha da chung minh la tot. Khac biet nay quyet dinh cach xu ly loi
 * mang, va no khong phai chuyen ly thuyet: lan chay dau tien `osmfr` timeout
 * dung mot lan, va vi luc do loi mang bi coi la "hong", `osmfr` bi gat khoi danh
 * sach du phong — roi ket qua thieu do nam trong cache SAU GIO LIEN.
 *
 * Nen: khong ket luan duoc thi GIU LAI. Mot nha cung cap chua ro song chet van
 * dang gia lam lop du phong, va neu no chet that thi `onError` o MapCanvas van
 * bat duoc. Nho vay cache 6 gio moi an toan — mot cu chop mang khong con dau
 * doc duoc ca danh sach.
 */
async function probeAll(origin: string): Promise<string[]> {
  const { z, x, y } = PROBE_TILE;

  // Ba nha cung cap la ba ten mien khac nhau, goi song song khong ai bi don dap.
  const verdicts = await Promise.all(
    TILE_PROVIDERS.map(async (provider) => {
      try {
        return (await probe(provider.url(z, x, y), origin)) ? provider.name : null;
      } catch (error) {
        console.error(
          `[GET /api/tiles] ${provider.name} khong do duoc, TAM GIU LAI trong danh sach:`,
          error instanceof Error ? error.message : error,
        );
        return provider.name;
      }
    }),
  );

  // Giu nguyen thu tu uu tien cua TILE_PROVIDERS — `Promise.all` da bao dam
  // ket qua ve dung thu tu dau vao.
  return verdicts.filter((name): name is string => name !== null);
}

/**
 * `origin` la origin THAT cua request dang duoc phuc vu, khong phai mot hang so.
 *
 * No vua la `Referer` gui len upstream, vua la KHOA CACHE — hai vai tro nay
 * phai di cung nhau: cung mot bang TILE_PROVIDERS cho ket qua khac nhau o
 * localhost va o ban deploy (Stadia 401 khi referer khong phai localhost), nen
 * dung chung mot o cache cho moi origin se tra loi sai cho mot trong hai.
 */
export function findUsableTileProviders(origin: string): Promise<string[]> {
  return gate.run(origin, () => probeAll(origin));
}
