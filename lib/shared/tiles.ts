/**
 * Nha cung cap tile ban do + phep do suc khoe cua ho.
 *
 * VI SAO NAM O lib/shared: phep do o server phai do dung cai danh sach ma
 * giao dien se hien thi.
 * Chep tay hai ban thi mot hom nao do BE bao "carto dung duoc" trong khi FE da
 * doi sang URL khac — cung ly do `EventName` va `SCREENS` nam o day.
 *
 * KHONG dung thu vien ban do (CLAUDE.md quy tac 8): `MapCanvas.tsx` tu xep luoi
 * the <img> tu bang nay.
 */

export interface TileProvider {
  name: string;
  url: (z: number, x: number, y: number) => string;
  /** Ten hien trong dong ghi cong, canh `© OpenStreetMap`. */
  credit?: { label: string; href: string };
}

/**
 * THEO THU TU UU TIEN.
 *
 * `osm_bright` cua Stadia — tone CO MAU: duong vang nhat, cong vien xanh la,
 * song ho xanh duong, nen do thi be rat nhat.
 *
 * Truoc day o day la `alidade_smooth` (tong xam tối gian, chon vi gan `light_all`
 * cua CARTO nhat). Nhung mot nen gan nhu don sac lam ban do kho doc: duong, cong
 * vien va mat nuoc deu ra cung mot mau xam, nen nguoi dung khong phan biet duoc
 * minh dang di qua cai gi.
 *
 * `osm_bright` du mau de doc nhu mot tam ban do that, NHUNG moi mau deu nhat —
 * nho vay tuyen duong cyan (`--color-primary-dark`) va hai ghim ve de len van
 * tach ro khoi nen. Day la ly do khong chon tone OSM goc (cao toc do/hong,
 * quoc lo cam dam): mau nong o do se tranh cho voi chinh tuyen duong.
 *
 * STADIA CHAN THEO `Referer`, va dieu do chi mien phi tren localhost. Do that:
 * cung mot tile tra 200 voi referer `http://localhost:3000/` nhung tra 401 voi
 * referer `https://<app>.vercel.app/`. Nen o ban deploy, phep do trong
 * `lib/server/services/tiles.service.ts` se tu loai Stadia ra: no gui referer
 * lay tu CHINH request cua trinh duyet (`app/api/tiles/route.ts`), nen ket luan
 * cua no luon khop voi thu nguoi dung that se nhan.
 *
 * Stadia van dung dau bang vi no dep nhat khi chay localhost. Viec loai no o
 * moi truong khac la viec cua phep do, KHONG phai cua bang nay — dung xoa no
 * khoi day chi vi ban deploy khong dung duoc.
 *
 * CARTO VAN NAM TRONG BANG du hien tai no doi API key — neu CARTO mo lai raster
 * mien phi thi no tu song lai ma khong ai phai sua code. Nhung no bi DAY XUONG
 * CUOI, va day la thay doi quan trong nhat cua bang nay:
 *
 *   CARTO la nha cung cap DUY NHAT tra HTTP 200 khi dang hong (200 + mot PNG
 *   hop le co chu "API KEY REQUIRED" cheo mat). Dung o vi tri thu hai, no NUOT
 *   luon co che `onError` cua MapCanvas: Stadia 401 -> onError -> nhay sang
 *   CARTO -> khong bao gio error nua -> ban do dung lai o tile watermark va
 *   khong bao gio di tiep toi `osmfr`. Dung cuoi bang thi no chi con la chot
 *   chan cuoi cung, khong chan duong ai.
 *
 * Thu tu hien tai vi vay la: stadia -> osmfr -> osmde -> carto. Hai nha o giua
 * deu khong doi key va deu do duoc 103 B tren `PROBE_TILE`.
 *
 * `tile.openstreetmap.org` KHONG co trong bang: tren may chay du an nay, toan
 * bo `*.openstreetmap.org` khong phan giai duoc DNS (ca tile lan Nominatim),
 * trong khi OSRM va cac dich vu khac van thong. `tile.openstreetmap.de` la ten
 * mien KHAC (`.de`, ha tang cua OSM Duc) nen khong dinh cai chan do.
 *
 * DU LIEU VAN LA CUA OPENSTREETMAP — doi CDN khong doi nguon du lieu, nen dong
 * ghi cong `© OpenStreetMap` VAN BAT BUOC (CLAUDE.md quy tac 10). Nha cung cap
 * nao doi ghi cong them chinh ho thi dung `credit`.
 */
export const TILE_PROVIDERS: TileProvider[] = [
  {
    name: 'stadia',
    url: (z, x, y) => `https://tiles.stadiamaps.com/tiles/osm_bright/${z}/${x}/${y}.png`,
    credit: { label: '© Stadia Maps', href: 'https://stadiamaps.com/attribution/' },
  },
  {
    // Du phong: cung du lieu OSM, khac ha tang va khac ten mien.
    name: 'osmfr',
    url: (z, x, y) => `https://a.tile.openstreetmap.fr/osmfr/${z}/${x}/${y}.png`,
  },
  {
    // Lop du phong thu hai. Khac ha tang HAN VOI osmfr (OSM Duc, khong phai OSM
    // Phap), nen mot ben chet khong keo ben kia theo — day la ly do co mat cua
    // no, chu khong phai de bang dai ra.
    name: 'osmde',
    url: (z, x, y) => `https://tile.openstreetmap.de/${z}/${x}/${y}.png`,
    credit: { label: '© OpenStreetMap Deutschland', href: 'https://www.openstreetmap.de/' },
  },
  {
    // CUOI BANG CO CHU Y: xem doan "CARTO VAN NAM TRONG BANG" o tren.
    name: 'carto',
    url: (z, x, y) => `https://basemaps.cartocdn.com/light_all/${z}/${x}/${y}.png`,
    credit: { label: '© CARTO', href: 'https://carto.com/attributions' },
  },
];

/**
 * Tile dung de do: GIUA BIEN DONG (15.4°N 114.7°E), khong co mot net ban do nao.
 *
 * DUNG DOI SANG TOA DO KHAC. Ca phep do duoi day dua tren mot dieu duy nhat:
 * mot tile bien sau SACH thi gan nhu la mot o mau phang, nen xuong con vai tram
 * byte. Doi sang tile co dat lien la pha hong phep do.
 */
export const PROBE_TILE = { z: 13, x: 6707, y: 3740 } as const;

/**
 * Qua nguong nay thi tile bien sau dang chua thu gi do khong phai bien.
 *
 * Do that tren chinh tile `PROBE_TILE`:
 *
 * | Nha cung cap             | Kich thuoc | Ket luan            |
 * |--------------------------|------------|---------------------|
 * | osmfr, osmde             |     103 B  | sach                |
 * | Stadia `alidade_smooth`  |     156 B  | sach (tone cu)      |
 * | Stadia `osm_bright`      |     495 B  | sach (DANG DUNG)    |
 * | CARTO                    |    1718 B  | CO WATERMARK        |
 * | Stadia, referer prod     |   14885 B  | 401 — loai tu `!ok` |
 *
 * CARTO in chu "API KEY REQUIRED" cheo len moi tile, ke ca tile bien trong, nen
 * no phinh len hon mot bac do lon. Nguong 800 nam giua khe ho 495 -> 1718.
 *
 * Hang cuoi bang la Stadia khi phep do gui referer cua ban deploy that: no tra
 * 401 kem mot trang HTML, va `probe()` loai no ngay o buoc `response.ok` chu
 * chua kip can. Hang do o day de nho mot dieu: NGUONG NAY KHONG PHAI THU LOAI
 * STADIA RA O PRODUCTION — ma la ma trang thai. Sua nguong khong cuu duoc Stadia.
 *
 * DOI TONE STADIA THI PHAI DO LAI O DAY. Tone co mau nang hon tone xam ngay ca
 * o giua bien: 156 B -> 495 B khi doi `alidade_smooth` sang `osm_bright`, tuc
 * bien an toan tut tu 644 B xuong 305 B. Van an, nhung dung nhin con so 800 roi
 * nghi la no rong rai — siet xuong 200 se lam phep do ket luan Stadia bi
 * watermark, loai no khoi danh sach, va ban do am tham roi ve `osmfr`.
 *
 * Day KHONG phai so ma thuat tuy tien — do lai bang:
 *   curl -so /dev/null -w '%{size_download}\n' -e http://localhost:3000/ \
 *     'https://tiles.stadiamaps.com/tiles/osm_bright/13/6707/3740.png'
 */
export const PROBE_MAX_BYTES = 800;
