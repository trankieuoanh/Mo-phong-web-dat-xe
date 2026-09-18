/**
 * Nha cung cap tile ban do + phep do suc khoe cua ho.
 *
 * VI SAO NAM O @gsm/shared: BE phai do dung cai danh sach ma FE se hien thi.
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
 * CARTO VAN NAM TRONG BANG du hien tai no doi API key. Phep do o duoi se loai
 * no ra, nen giu lai khong hai gi — va neu CARTO mo lai raster mien phi thi no
 * tu quay ve dung vi tri cu ma khong ai phai sua code.
 *
 * `tile.openstreetmap.org` KHONG co trong bang: tren may chay du an nay, toan
 * bo `*.openstreetmap.org` khong phan giai duoc DNS (ca tile lan Nominatim),
 * trong khi OSRM va cac dich vu khac van thong.
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
    name: 'carto',
    url: (z, x, y) => `https://basemaps.cartocdn.com/light_all/${z}/${x}/${y}.png`,
    credit: { label: '© CARTO', href: 'https://carto.com/attributions' },
  },
  {
    // Du phong: cung du lieu OSM, khac ha tang va khac ten mien.
    name: 'osmfr',
    url: (z, x, y) => `https://a.tile.openstreetmap.fr/osmfr/${z}/${x}/${y}.png`,
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
 * | Nha cung cap             | Kich thuoc | Ket luan       |
 * |--------------------------|------------|----------------|
 * | osm.de, osmfr            |     103 B  | sach           |
 * | Stadia `alidade_smooth`  |     156 B  | sach (tone cu) |
 * | Stadia `osm_bright`      |     495 B  | sach (DANG DUNG)|
 * | CARTO                    |    1718 B  | CO WATERMARK   |
 *
 * CARTO in chu "API KEY REQUIRED" cheo len moi tile, ke ca tile bien trong, nen
 * no phinh len hon mot bac do lon. Nguong 800 nam giua khe ho 495 -> 1718.
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
