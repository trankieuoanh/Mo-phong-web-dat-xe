/**
 * Tai anh mon an that tu Wikimedia Commons ve apps/web/public/food/.
 *
 * CHAY MOT LAN, khong phai luc build: anh nam trong repo, app khong bao gio goi
 * mang de lay anh. Chay lai chi khi muon doi anh.
 *
 *   node scripts/fetch-food-images.mjs
 *
 * GIAY PHEP LA PHAN BAT BUOC, KHONG PHAI TUY CHON. Anh tren Commons phan lon la
 * CC BY / CC BY-SA — duoc dung lai thoai mai NHUNG phai ghi cong tac gia. Script
 * vi vay ghi luon apps/web/public/food/CREDITS.md; thieu file do la dung anh sai
 * giay phep.
 *
 * Mon nao khong tim duoc anh hop le thi BO QUA, khong bia: `FoodThumb` tu lui ve
 * khung co glyph, va mot o glyph thi that tha con mot tam anh sai mon thi khong.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, '../apps/web/public/food');

const USER_AGENT = 'gsm-simulation/0.1 (https://github.com/gsm-simulation) image-fetch';
const API = 'https://commons.wikimedia.org/w/api.php';

/**
 * `id` phai khop id trong packages/shared/src/mock-data.ts (CLAUDE.md quy tac 5).
 * `q` la tu khoa TIM tren Commons; `file` la ten tep CHI DINH SAN.
 *
 * Mac dinh tim theo tu khoa vi ten tep tren Commons rat kho doan. NHUNG tim
 * kiem la tro doan, va da doan sai 8/29 lan o vong dau: mot khoanh thit quay
 * cho "banh mi", mot noi la dua cho "che", mot vi khay banh song trong xuong
 * cho "gyoza", mot goi khoai tay CO LOGO THUONG HIEU cho "khoai tay chien".
 *
 * Vi vay: mon nao kiem tra bang mat thay sai thi ghim cung `file`. Danh sach
 * nay chinh la ket qua cua viec da xem tung anh mot — dung bo no di khi chay lai.
 */
const WANTED = [
  { id: 'banh-mi-01', file: 'File:Special Baguette (Bánh mì) - Banh Mi Ancient Saigon 2024-12-20.jpg' },
  { id: 'pho-bo-02', q: 'pho bo beef noodle soup' },
  { id: 'bun-cha-03', q: 'bun cha hanoi' },
  { id: 'com-tam-04', q: 'com tam broken rice' },
  { id: 'banh-xeo-05', q: 'banh xeo pancake' },
  { id: 'tra-sua-06', q: 'bubble tea boba' },
  { id: 'ca-phe-07', q: 'vietnamese iced coffee ca phe sua da' },
  { id: 'che-08', file: 'File:Chè bà ba.jpg' },
  { id: 'sushi-09', q: 'sushi plate' },
  { id: 'ramen-10', q: 'shoyu ramen bowl' },
  { id: 'gyoza-11', file: 'File:10pc Gyoza plate.jpg' },
  { id: 'kimbap-12', q: 'gimbap' },
  { id: 'bibimbap-13', file: 'File:Bibimbap with egg.jpg' },
  { id: 'ga-ran-14', q: 'korean fried chicken dakgangjeong' },
  { id: 'suon-nuong-15', file: 'File:Grilled Sparerib on Easter Day 2011.JPG' },
  { id: 'ba-chi-nuong-16', q: 'samgyeopsal grilled pork belly' },
  { id: 'bo-nuong-17', q: 'bulgogi grilled beef' },
  { id: 'pizza-margherita-18', q: 'pizza margherita' },
  { id: 'pizza-hai-san-19', q: 'seafood pizza' },
  { id: 'mi-y-20', q: 'spaghetti carbonara' },
  { id: 'burger-21', q: 'cheeseburger hamburger' },
  { id: 'khoai-tay-22', file: 'File:French fries at Chez Jolie.jpg' },
  { id: 'hot-dog-23', q: 'hot dog sausage bun' },
  { id: 'tom-nuong-24', q: 'grilled prawns shrimp' },
  { id: 'muc-chien-25', q: 'fried calamari squid' },
  { id: 'lau-hai-san-26', file: 'File:Hot pot dinner.jpg' },
  { id: 'nuoc-ep-27', q: 'orange juice glass' },
  { id: 'kem-28', file: 'File:Bowl ~ Ice cream.jpg' },
  { id: 'banh-flan-29', q: 'creme caramel flan' },
];

/** Be ngang anh tai ve. The anh hien thi toi da ~360px, 640 la du cho man Retina. */
const THUMB_WIDTH = 640;

/** Bo the HTML khoi cac truong metadata cua Commons. */
function stripHtml(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tim mot anh tren Commons theo tu khoa, tra ve ket qua dau tien dung duoc.
 *
 * `gsrnamespace=6` = chi tim trong khong gian ten "File". Khong co no thi ket
 * qua tra ve ca bai viet va trang danh muc, tuc khong co anh nao.
 */
/** Lay thong tin mot tep Commons theo DUNG ten — dung cho cac mon da ghim. */
async function lookupExact(title) {
  const url = new URL(API);
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('titles', title);
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|extmetadata|mime');
  url.searchParams.set('iiurlwidth', String(THUMB_WIDTH));

  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`Commons API ${response.status}`);

  const body = await response.json();
  const page = Object.values(body?.query?.pages ?? {})[0];
  const info = page?.imageinfo?.[0];
  if (!info?.thumburl) return null;

  return {
    title: page.title,
    url: info.thumburl,
    descriptionUrl: info.descriptionurl,
    license: stripHtml(info.extmetadata?.LicenseShortName?.value) || 'không rõ',
    author: stripHtml(info.extmetadata?.Artist?.value) || 'không rõ',
  };
}

async function lookup(query) {
  const url = new URL(API);
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrsearch', `${query} filetype:bitmap`);
  url.searchParams.set('gsrnamespace', '6');
  url.searchParams.set('gsrlimit', '8');
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|extmetadata|mime');
  url.searchParams.set('iiurlwidth', String(THUMB_WIDTH));

  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`Commons API ${response.status}`);

  const body = await response.json();
  const pages = Object.values(body?.query?.pages ?? {});
  // `index` la thu hang cua ket qua tim; Object.values khong dam bao thu tu do.
  pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

  for (const page of pages) {
    const info = page?.imageinfo?.[0];
    if (!info?.thumburl) continue;
    // Bo SVG/anh dong: mot bieu do vector hay anh GIF khong phai anh mon an.
    if (!['image/jpeg', 'image/png'].includes(info.mime)) continue;

    return {
      title: page.title,
      url: info.thumburl,
      descriptionUrl: info.descriptionurl,
      license: stripHtml(info.extmetadata?.LicenseShortName?.value) || 'không rõ',
      author: stripHtml(info.extmetadata?.Artist?.value) || 'không rõ',
    };
  }
  return null;
}

async function download(url, target) {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`tải ảnh ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(target, buffer);
  return buffer.length;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const credits = [];
  const missing = [];

  for (const entry of WANTED) {
    let info = null;
    try {
      info = entry.file ? await lookupExact(entry.file) : await lookup(entry.q);
    } catch (error) {
      console.log(`  lỗi  ${entry.id}: ${error.message}`);
    }

    if (!info) {
      missing.push(entry);
      console.log(`  bỏ   ${entry.id}: không tìm được ảnh hợp lệ`);
      continue;
    }

    // Giu duoi tep goc: Commons co ca .jpg lan .png, va doi duoi ma khong doi
    // noi dung se lam trinh duyet phai doan kieu tep.
    const ext = new URL(info.url).pathname.split('.').pop()?.toLowerCase() ?? 'jpg';
    const filename = `${entry.id}.${ext}`;

    try {
      const bytes = await download(info.url, resolve(OUT_DIR, filename));
      credits.push({ ...entry, ...info, filename, bytes });
      console.log(`  ok   ${entry.id} -> ${filename} (${Math.round(bytes / 1024)} KB)`);
    } catch (error) {
      missing.push(entry);
      console.log(`  lỗi  ${entry.id}: ${error.message}`);
    }
  }

  const lines = [
    '# Nguồn và giấy phép ảnh món ăn',
    '',
    'Sinh tự động bởi `scripts/fetch-food-images.mjs`. **Đừng sửa tay.**',
    '',
    'Ảnh tải từ Wikimedia Commons. Phần lớn là CC BY / CC BY-SA — được dùng lại',
    'nhưng **bắt buộc ghi công tác giả**, và file này chính là phần ghi công đó.',
    '',
    '| Món | Tệp | Giấy phép | Tác giả | Trang gốc |',
    '|---|---|---|---|---|',
    ...credits.map(
      (c) =>
        `| \`${c.id}\` | ${c.filename} | ${c.license} | ${c.author} | ${c.descriptionUrl} |`,
    ),
    '',
  ];
  await writeFile(resolve(OUT_DIR, 'CREDITS.md'), lines.join('\n'));

  console.log(`\nTải được ${credits.length}/${WANTED.length} ảnh.`);
  if (missing.length) {
    console.log(`Không có ảnh (giữ glyph): ${missing.map((m) => m.id).join(', ')}`);
  }

  // In ra doan can dan vao mock-data.ts, de khong phai go tay 29 dong.
  console.log('\n--- image cho mock-data.ts ---');
  for (const c of credits) console.log(`${c.id}  ->  image: '/food/${c.filename}',`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
