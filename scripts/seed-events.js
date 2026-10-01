/**
 * Sinh event gia lap ghi THANG vao Firestore bang firebase-admin.
 *
 *   node scripts/seed-events.js               # 600 session / 90 ngay
 *   node scripts/seed-events.js --dry-run     # khong ghi gi, chi in ra de doi chieu
 *   node scripts/seed-events.js --clear       # xoa lai du lieu da seed
 *
 * VI SAO DI TAT QUA CA APP: app chi sinh event khi co nguoi click tay. Dashboard
 * Power BI can hang nghin document trai deu 3 thang — khong click tay ra duoc.
 * `analysis-spec.md` chot nguong toi thieu 30 session moi luong, VA phai co
 * session bo do o nhieu buoc: "chi sinh session hoan thanh thi funnel phang
 * 100% va khong noi len dieu gi".
 *
 * KHONG GOI POST /api/events. Route do gan `created_at = serverTimestamp()`,
 * tuc moi event se mang dung thoi diem chay script — mat sach truc thoi gian,
 * thu duy nhat lam dashboard co nghia. Script vi vay tu gan `Timestamp` qua khu,
 * va cung phai tu gan `platform: 'web'` (viec cua event.service.ts).
 *
 * MOI DOCUMENT CO THEM FIELD `seed_batch`. Day la field thu 10, lech
 * `db-design.md` (9 field) MOT CACH CO CHU Y: event do nguoi that click khong co
 * field nay, nen loc du lieu gia ra khoi du lieu that chi la mot dieu kien, va
 * `--clear` xoa lai duoc chinh xac ma khong cham vao document that.
 *
 * NGUON SU THAT cho moi thu duoi day la `event-taxonomy.md`. Sua file do truoc,
 * roi moi sua file nay.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const ROOT = path.resolve(__dirname, '..');
const KEY_PATH = path.join(ROOT, 'serviceAccountKey.json');
const MOCK_DATA_PATH = path.join(ROOT, 'lib/shared/mock-data.ts');

const EVENTS_COLLECTION = 'events';

/** Gioi han cung cua Firestore: 500 thao tac moi batch. */
const BATCH_LIMIT = 500;

/** Gio dia phuong cua du lieu. metrics.py convert sang dung mui nay. */
const TZ_OFFSET_HOURS = 7;

// ─────────────────────────────────────────────────────────────
// Tham so dong lenh
// ─────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = {
    sessions: 600,
    days: 90,
    seed: 20260922,
    dryRun: false,
    clear: false,
    batch: null,
    yes: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (value === undefined) fail(`Thiếu giá trị cho tham số ${arg}`);
      i += 1;
      return value;
    };

    switch (arg) {
      case '--sessions':
        opts.sessions = Number(next());
        break;
      case '--days':
        opts.days = Number(next());
        break;
      case '--seed':
        opts.seed = Number(next());
        break;
      case '--batch':
        opts.batch = next();
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--clear':
        opts.clear = true;
        break;
      case '--yes':
      case '-y':
        opts.yes = true;
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
      default:
        fail(`Không hiểu tham số ${arg}. Chạy --help để xem danh sách.`);
    }
  }

  if (!Number.isInteger(opts.sessions) || opts.sessions < 1) {
    fail('--sessions phải là số nguyên dương');
  }
  if (!Number.isInteger(opts.days) || opts.days < 1) {
    fail('--days phải là số nguyên dương');
  }

  return opts;
}

function printUsage() {
  console.log(`
Sinh event giả lập vào Firestore.

  node scripts/seed-events.js [tham số]

  --sessions <n>   Số session cần sinh (mặc định 600)
  --days <n>       Trải đều qua bao nhiêu ngày gần nhất (mặc định 90)
  --seed <n>       Hạt giống cho bộ sinh ngẫu nhiên (mặc định 20260922).
                   Cùng hạt giống + cùng tham số = cùng bộ dữ liệu.
  --dry-run        Không ghi gì. In thống kê và 2 timeline mẫu để đối chiếu
                   với event-taxonomy.md. Không cần serviceAccountKey.json.
  --clear          Xoá các document đã seed (mọi document có field seed_batch).
  --batch <id>     Đi kèm --clear: chỉ xoá đúng một đợt seed.
  --yes, -y        Không hỏi xác nhận trước khi xoá.
`);
}

function fail(message) {
  console.error(`\nLỗi: ${message}\n`);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────
// Ngau nhien CO HAT GIONG
//
// Math.random() moi lan chay ra mot bo khac. Voi hat giong thi chay lai dung
// tham so se ra dung bo du lieu cu — can cho viec "xoa het roi seed lai" ma
// bao cao phan tich khong doi so.
// ─────────────────────────────────────────────────────────────

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let rand = mulberry32(1);

const randInt = (min, max) => min + Math.floor(rand() * (max - min + 1));
const randFloat = (min, max) => min + rand() * (max - min);
const chance = (p) => rand() < p;
const pick = (list) => list[Math.floor(rand() * list.length)];

/** Chon mot phan tu theo trong so. `weights[i]` di cung `list[i]`. */
function pickWeighted(list, weights) {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = rand() * total;
  for (let i = 0; i < list.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return list[i];
  }
  return list[list.length - 1];
}

/** Chon `n` phan tu KHAC NHAU. */
function pickMany(list, n) {
  const pool = list.slice();
  const out = [];
  for (let i = 0; i < n && pool.length > 0; i += 1) {
    out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  }
  return out;
}

/**
 * UUID v4 lay tu PRNG co hat giong — KHONG dung crypto.randomUUID().
 * Hinh dang phai giong lib/session.ts de session gia va session that khong
 * phan biet duoc qua rieng `session_id`.
 */
function seededUuid() {
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 36; i += 1) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += '-';
    else if (i === 14) out += '4';
    else if (i === 19) out += hex[(Math.floor(rand() * 16) & 0x3) | 0x8];
    else out += hex[Math.floor(rand() * 16)];
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// Bang du lieu — BAN SAO cua lib/shared/mock-data.ts
//
// Vi sao phai chep: mock-data.ts la ESM TypeScript va import noi bo khong ghi
// duoi `.js` (CLAUDE.md muc "Quy uoc code"), nen `node` tran khong require duoc.
// Doi lai, `assertIdsStillExist()` o duoi kiem tra MOI id duoi day van con trong
// file goc — id di thang vao `properties` cua event, doi id la du lieu cu va moi
// khong ghep duoc (CLAUDE.md quy tac 5).
//
// LUU Y: chi id duoc kiem tra tu dong. Gia tien (`price`, `openingFare`,
// `pricePerKm`) van la ban sao — sua gia o mock-data.ts thi sua ca o day.
// ─────────────────────────────────────────────────────────────

const SHIPPING_FEE = 15000;

const FIXED_PICKUP = {
  id: 'pickup-current',
  label: 'Vị trí hiện tại',
  address: '128 Xuân Thủy, Cầu Giấy, Hà Nội',
  lat: 21.0369,
  lon: 105.7856,
};

const ADDRESSES = [
  { id: 'addr-home', label: 'Nhà', lat: 21.0052, lon: 105.7989 },
  { id: 'addr-office', label: 'Công ty', lat: 21.0174, lon: 105.7836 },
  { id: 'addr-mall', label: 'Trung tâm thương mại', lat: 21.0023, lon: 105.816 },
  { id: 'addr-school', label: 'Trường', lat: 20.9886, lon: 105.946 },
  { id: 'addr-airport', label: 'Sân bay', lat: 21.2189, lon: 105.8045 },
];

const VEHICLES = [
  { id: 'veh-bike', type: 'bike', openingFare: 15000, pricePerKm: 3300 },
  { id: 'veh-bike-plus', type: 'bike', openingFare: 20000, pricePerKm: 4000 },
  { id: 'veh-mini', type: 'car', openingFare: 28000, pricePerKm: 9000 },
  { id: 'veh-car', type: 'car', openingFare: 32000, pricePerKm: 9000 },
  { id: 'veh-premium', type: 'car', openingFare: 35000, pricePerKm: 9700 },
  { id: 'veh-limo', type: 'car', openingFare: 46000, pricePerKm: 11400 },
];

/** Trong so chon xe — bike 55% / car 45% gop lai. */
const VEHICLE_WEIGHTS = [35, 20, 12, 18, 9, 6];

const PROMOS = [
  { id: 'promo-10k', code: 'GSM10K', type: 'fixed', value: 10000, minOrder: 0 },
  { id: 'promo-20', code: 'GSM20', type: 'percent', value: 20, maxDiscount: 30000, minOrder: 50000 },
  { id: 'promo-new', code: 'NEWGSM', type: 'percent', value: 50, maxDiscount: 40000, minOrder: 0 },
  {
    id: 'promo-bike',
    code: 'GSMBIKE',
    type: 'percent',
    value: 15,
    maxDiscount: 20000,
    minOrder: 0,
    vehicleTypes: ['bike'],
  },
  {
    id: 'promo-car',
    code: 'GSMCAR',
    type: 'fixed',
    value: 30000,
    minOrder: 80000,
    vehicleTypes: ['car'],
  },
  {
    id: 'promo-lunch',
    code: 'GSMTRUA',
    type: 'fixed',
    value: 25000,
    minOrder: 40000,
    activeHours: { from: 11, to: 13 },
  },
  {
    id: 'promo-far',
    code: 'GSMFAR',
    type: 'percent',
    value: 12,
    maxDiscount: 50000,
    minOrder: 0,
    minDistanceKm: 8,
  },
];

const OFFERS = [
  {
    id: 'offer-freeship',
    code: 'FREESHIP',
    type: 'fixed',
    value: SHIPPING_FEE,
    minOrder: 0,
    appliesTo: 'shipping',
  },
  { id: 'offer-15', code: 'FOOD15', type: 'percent', value: 15, maxDiscount: 25000, minOrder: 100000 },
  { id: 'offer-25k', code: 'FOOD25K', type: 'fixed', value: 25000, minOrder: 150000 },
  {
    id: 'offer-ship-half',
    code: 'SHIP50',
    type: 'percent',
    value: 50,
    minOrder: 0,
    appliesTo: 'shipping',
  },
  {
    id: 'offer-breakfast',
    code: 'SANG20',
    type: 'percent',
    value: 20,
    maxDiscount: 20000,
    minOrder: 0,
    activeHours: { from: 5, to: 10 },
  },
  {
    id: 'offer-latenight',
    code: 'DEM15K',
    type: 'fixed',
    value: 15000,
    minOrder: 60000,
    activeHours: { from: 21, to: 2 },
  },
  { id: 'offer-big', code: 'FOOD50K', type: 'fixed', value: 50000, minOrder: 300000 },
];

const FOOD_ITEMS = [
  { id: 'banh-mi-01', name: 'Bánh mì thịt nướng', price: 35000, category: 'main', meals: ['breakfast', 'lunch'] },
  { id: 'pho-bo-02', name: 'Phở bò tái', price: 55000, category: 'main', meals: ['breakfast', 'lunch', 'dinner'] },
  { id: 'bun-cha-03', name: 'Bún chả Hà Nội', price: 50000, category: 'main', meals: ['lunch', 'dinner'] },
  { id: 'com-tam-04', name: 'Cơm tấm sườn bì chả', price: 60000, category: 'main', meals: ['lunch', 'dinner'] },
  { id: 'banh-xeo-05', name: 'Bánh xèo miền Tây', price: 65000, category: 'main', meals: ['lunch', 'dinner'] },
  { id: 'tra-sua-06', name: 'Trà sữa trân châu đường đen', price: 45000, category: 'drink', meals: ['lunch', 'dinner'] },
  { id: 'ca-phe-07', name: 'Cà phê sữa đá', price: 29000, category: 'drink', meals: ['breakfast', 'lunch'] },
  { id: 'nuoc-ep-27', name: 'Nước ép cam tươi', price: 39000, category: 'drink', meals: ['breakfast', 'lunch', 'dinner'] },
  { id: 'che-08', name: 'Chè khúc bạch', price: 32000, category: 'dessert', meals: ['lunch', 'dinner'] },
  { id: 'kem-28', name: 'Kem dừa Thái', price: 45000, category: 'dessert', meals: ['lunch', 'dinner'] },
  { id: 'banh-flan-29', name: 'Bánh flan cà phê', price: 28000, category: 'dessert', meals: ['breakfast', 'lunch', 'dinner'] },
  { id: 'sushi-09', name: 'Sushi cá hồi 8 miếng', price: 145000, category: 'main', meals: ['lunch', 'dinner'] },
  { id: 'ramen-10', name: 'Ramen tonkotsu', price: 120000, category: 'main', meals: ['lunch', 'dinner'] },
  { id: 'gyoza-11', name: 'Gyoza chiên 6 chiếc', price: 65000, category: 'main', meals: ['lunch', 'dinner'] },
  { id: 'kimbap-12', name: 'Kimbap bò', price: 70000, category: 'main', meals: ['breakfast', 'lunch'] },
  { id: 'bibimbap-13', name: 'Cơm trộn Bibimbap', price: 95000, category: 'main', meals: ['lunch', 'dinner'] },
  { id: 'ga-ran-14', name: 'Gà rán sốt cay Hàn Quốc', price: 135000, category: 'main', meals: ['lunch', 'dinner'] },
  { id: 'suon-nuong-15', name: 'Sườn nướng BBQ', price: 155000, category: 'main', meals: ['dinner'] },
  { id: 'ba-chi-nuong-16', name: 'Ba chỉ bò nướng', price: 165000, category: 'main', meals: ['dinner'] },
  { id: 'bo-nuong-17', name: 'Bò nướng tiêu đen', price: 175000, category: 'main', meals: ['lunch', 'dinner'] },
  { id: 'pizza-margherita-18', name: 'Pizza Margherita', price: 149000, category: 'main', meals: ['lunch', 'dinner'] },
  { id: 'pizza-hai-san-19', name: 'Pizza hải sản', price: 189000, category: 'main', meals: ['lunch', 'dinner'] },
  { id: 'mi-y-20', name: 'Mì Ý sốt bò bằm', price: 125000, category: 'main', meals: ['lunch', 'dinner'] },
  { id: 'burger-21', name: 'Burger bò phô mai', price: 115000, category: 'main', meals: ['lunch', 'dinner'] },
  { id: 'khoai-tay-22', name: 'Khoai tây chiên phô mai', price: 59000, category: 'main', meals: ['lunch', 'dinner'] },
  { id: 'hot-dog-23', name: 'Hot dog xúc xích Đức', price: 85000, category: 'main', meals: ['breakfast', 'lunch'] },
  { id: 'tom-nuong-24', name: 'Tôm sú nướng muối ớt', price: 195000, category: 'main', meals: ['dinner'] },
  { id: 'muc-chien-25', name: 'Mực chiên giòn', price: 145000, category: 'main', meals: ['lunch', 'dinner'] },
  { id: 'lau-hai-san-26', name: 'Lẩu hải sản chua cay', price: 320000, category: 'main', meals: ['dinner'] },
];

const MOCK_DRIVERS = [
  { id: 'drv-01', name: 'Nguyễn Văn An', phone: '0901 234 567', plate: '30A-12345' },
  { id: 'drv-02', name: 'Trần Văn Bình', phone: '0912 345 678', plate: '30B-23456' },
  { id: 'drv-03', name: 'Lê Minh Châu', phone: '0923 456 789', plate: '30C-34567' },
  { id: 'drv-04', name: 'Phạm Văn Dũng', phone: '0934 567 890', plate: '30D-45678' },
  { id: 'drv-05', name: 'Hoàng Thị Lan', phone: '0945 678 901', plate: '30E-56789' },
  { id: 'drv-06', name: 'Vũ Minh Nam', phone: '0956 789 012', plate: '30F-67890' },
];

/**
 * Dia diem "tu go tim" — nhanh `address_source: 'search'`.
 * Id dang `osm-<osm_type><osm_id>` dung nhu GET /api/places tra ve; day la cac
 * dia danh co that o Ha Noi nen du lieu doc len van hop ly.
 */
const SEARCH_PLACES = [
  { id: 'osm-N240109189', label: 'Hồ Hoàn Kiếm', lat: 21.0287, lon: 105.8524 },
  { id: 'osm-W123456789', label: 'Văn Miếu Quốc Tử Giám', lat: 21.0294, lon: 105.8355 },
  { id: 'osm-N305118842', label: 'Chợ Đồng Xuân', lat: 21.0384, lon: 105.8497 },
  { id: 'osm-W884512033', label: 'Sân vận động Mỹ Đình', lat: 21.0203, lon: 105.7639 },
  { id: 'osm-N412778901', label: 'Bệnh viện Bạch Mai', lat: 20.9973, lon: 105.8407 },
  { id: 'osm-W553201774', label: 'Times City', lat: 20.9942, lon: 105.8677 },
  { id: 'osm-N661029384', label: 'Hồ Tây', lat: 21.0587, lon: 105.8213 },
  { id: 'osm-W771930284', label: 'Đại học Bách khoa Hà Nội', lat: 21.0045, lon: 105.8434 },
  { id: 'osm-N884102931', label: 'Ga Hà Nội', lat: 21.0245, lon: 105.8412 },
  { id: 'osm-W992013847', label: 'Aeon Mall Long Biên', lat: 21.0287, lon: 105.8971 },
  { id: 'osm-N113049281', label: 'Lăng Chủ tịch Hồ Chí Minh', lat: 21.0368, lon: 105.8347 },
  { id: 'osm-W220394817', label: 'Keangnam Landmark', lat: 21.0173, lon: 105.7838 },
];

/**
 * Quan an cho `select_restaurant`. `cuisine` la mang tag THO cua OSM, ghi
 * nguyen van — va MOT NUA de rong, dung nhu do phu that cua du lieu cong dong
 * (event-taxonomy.md muc `food_menu`).
 */
const RESTAURANTS = [
  { id: 'osm-N1001', name: 'Phở Thìn Lò Đúc', cuisine: ['vietnamese'] },
  { id: 'osm-N1002', name: 'Bún chả Hương Liên', cuisine: ['vietnamese'] },
  { id: 'osm-W1003', name: 'Quán Nướng Sườn Cây', cuisine: ['thịt_nướng', 'grill', 'barbecue'] },
  { id: 'osm-N1004', name: 'Sushi Hokkaido Sachi', cuisine: ['japanese', 'sushi'] },
  { id: 'osm-N1005', name: 'Gà rán Bonchon', cuisine: [] },
  { id: 'osm-W1006', name: 'Pizza 4P\u2019s Xuân Thủy', cuisine: ['pizza', 'italian'] },
  { id: 'osm-N1007', name: 'Cơm tấm Sài Gòn', cuisine: [] },
  { id: 'osm-N1008', name: 'Lẩu hải sản Biển Đông', cuisine: [] },
  { id: 'osm-W1009', name: 'Highlands Coffee Cầu Giấy', cuisine: ['coffee_shop'] },
  { id: 'osm-N1010', name: 'Quán ăn bình dân Cô Tư', cuisine: [] },
];

/** Tu khoa nguoi dung go o o tim mon. Vai tu co tinh KHONG co trong thuc don. */
const SEARCH_QUERIES = [
  'phở', 'bún', 'cơm', 'bánh mì', 'trà sữa', 'cà phê', 'sushi', 'pizza',
  'gà rán', 'nướng', 'lẩu', 'kem', 'chè', 'burger', 'mì',
  'bún bò huế', 'cháo lòng', 'nem nướng', 'xôi xéo', 'bánh cuốn',
];

const DRIVER_NOTES = [
  'Gọi trước khi đến',
  'Đợi em 2 phút nhé',
  'Cho em xin mũ bảo hiểm',
  'Em đứng ở cổng sau',
  'Bác đi cẩn thận giúp em',
  'Em có hành lý cồng kềnh',
];

// ─────────────────────────────────────────────────────────────
// Chong troi id — CLAUDE.md quy tac 5
// ─────────────────────────────────────────────────────────────

/**
 * Doc mock-data.ts DUOI DANG VAN BAN va khang dinh moi id o tren van con.
 *
 * Day la kiem tra SU TON TAI, khong phai parse TypeScript: doi ten mot id ma
 * quen sua file nay se lam du lieu seed khong ghep duoc voi du lieu that, va
 * kieu sai do khong co trieu chung nao.
 */
function assertIdsStillExist() {
  let source;
  try {
    source = fs.readFileSync(MOCK_DATA_PATH, 'utf8');
  } catch {
    console.warn(
      `  cảnh báo: không đọc được ${path.relative(ROOT, MOCK_DATA_PATH)} — bỏ qua bước kiểm tra id.`,
    );
    return;
  }

  const known = new Set();
  for (const match of source.matchAll(/id:\s*'([^']+)'/g)) known.add(match[1]);

  const used = [
    FIXED_PICKUP.id,
    ...ADDRESSES.map((a) => a.id),
    ...VEHICLES.map((v) => v.id),
    ...PROMOS.map((p) => p.id),
    ...OFFERS.map((o) => o.id),
    ...FOOD_ITEMS.map((f) => f.id),
    ...MOCK_DRIVERS.map((d) => d.id),
  ];

  const missing = used.filter((id) => !known.has(id));
  if (missing.length > 0) {
    fail(
      `Các id sau không còn trong ${path.relative(ROOT, MOCK_DATA_PATH)}: ${missing.join(', ')}.\n` +
        'Id đi thẳng vào properties của event — đổi id làm dữ liệu cũ và mới không ghép được\n' +
        '(CLAUDE.md quy tắc 5). Cập nhật bảng dữ liệu trong scripts/seed-events.js cho khớp.',
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Bang man hinh — ban sao cua lib/shared/screens.ts
// ─────────────────────────────────────────────────────────────

const SCREENS = {
  home: { stepIndex: 0, flow: 'none' },
  address_selection: { stepIndex: 1, flow: 'ride' },
  pickup_confirm: { stepIndex: 2, flow: 'ride' },
  vehicle_selection: { stepIndex: 3, flow: 'ride' },
  promo_selection: { stepIndex: 4, flow: 'ride' },
  ride_confirm: { stepIndex: 5, flow: 'ride' },
  finding_driver: { stepIndex: 6, flow: 'ride' },
  ride_success: { stepIndex: 7, flow: 'ride' },
  food_menu: { stepIndex: 1, flow: 'food' },
  food_item_detail: { stepIndex: 2, flow: 'food' },
  food_cart: { stepIndex: 4, flow: 'food' },
  food_offer_selection: { stepIndex: 5, flow: 'food' },
  food_confirm: { stepIndex: 6, flow: 'food' },
  food_success: { stepIndex: 7, flow: 'food' },
};

const ADD_TO_CART_STEP_INDEX = 3;
const SELECT_FLOW_STEP_INDEX = 0;
const DIRECT_ENTRY_FLOWS = ['ride', 'food'];

/** 26 gia tri — ban sao cua EVENT_NAMES trong lib/shared/types.ts. */
const EVENT_NAMES = new Set([
  'screen_view', 'back', 'back_to_home', 'select_flow',
  'select_address', 'confirm_pickup', 'change_address', 'select_vehicle',
  'select_promo', 'skip_promo', 'confirm_ride',
  'driver_searching', 'driver_assigned', 'cancel_ride',
  'search_item', 'filter_category', 'select_meal', 'select_restaurant',
  'select_item', 'change_quantity', 'add_to_cart',
  'remove_from_cart', 'proceed_to_offer', 'select_offer', 'skip_offer', 'place_order',
]);

// ─────────────────────────────────────────────────────────────
// Tinh tien — ban sao cua lib/shared/pricing.ts
// ─────────────────────────────────────────────────────────────

const INCLUDED_KM = 2;

function calcFare(vehicle, distanceKm) {
  const extra = Math.max(0, distanceKm - INCLUDED_KM);
  return Math.round((vehicle.openingFare + extra * vehicle.pricePerKm) / 1000) * 1000;
}

function calcDiscount(rule, subtotal, shippingFee = 0) {
  if (subtotal < rule.minOrder) return 0;
  const base = rule.appliesTo === 'shipping' ? shippingFee : subtotal;
  if (rule.type === 'fixed') return Math.min(rule.value, base);
  const raw = Math.floor((base * rule.value) / 100);
  return rule.maxDiscount ? Math.min(raw, rule.maxDiscount) : raw;
}

/** `from > to` = cua so vat qua nua dem, vi du (21, 2). */
function isHourInWindow(hour, from, to) {
  return from <= to ? hour >= from && hour < to : hour >= from || hour < to;
}

/**
 * Bon dieu kien duoi day gac QUYEN DUNG chu khong tham gia tinh tien — giong
 * ruleBlock() o pricing.ts. Nho no ma `promo-lunch` chi xuat hien trong du lieu
 * o khung 11-13h va `offer-latenight` chi o khung 21h-2h.
 */
function isRuleAvailable(rule, subtotal, ctx = {}) {
  if (rule.vehicleTypes && (!ctx.vehicleType || !rule.vehicleTypes.includes(ctx.vehicleType))) {
    return false;
  }
  if (rule.minDistanceKm !== undefined && (ctx.distanceKm ?? 0) < rule.minDistanceKm) return false;
  if (rule.activeHours) {
    const { from, to } = rule.activeHours;
    if (ctx.hour === undefined || !isHourInWindow(ctx.hour, from, to)) return false;
  }
  return subtotal >= rule.minOrder;
}

// ─────────────────────────────────────────────────────────────
// Dia ly — ban sao cua lib/shared/route.ts
// ─────────────────────────────────────────────────────────────

const EARTH_RADIUS_KM = 6371;
const toRadians = (deg) => (deg * Math.PI) / 180;

function haversineKm(a, b) {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

const roundKm = (km) => Math.round(km * 10) / 10;

const mapPlaceId = (lat, lon) => `map-${lat.toFixed(5)}-${lon.toFixed(5)}`;

/**
 * Tuyen duong giua hai diem.
 *
 * `straight` dung DUNG duong chim bay (van toc 25 km/h, giong straightRoute()).
 * `osrm` nhan them he so duong 1.25-1.45 — duong that luon dai hon duong chim
 * bay dang ke, va do chinh la ly do `route_source` phai duoc ghi lai.
 */
function makeRoute(from, to) {
  const straightKm = haversineKm(from, to);
  const isFallback = chance(0.08);

  if (isFallback) {
    const distanceKm = roundKm(straightKm);
    return {
      distanceKm,
      durationMin: Math.max(1, Math.round((distanceKm / 25) * 60)),
      source: 'straight',
    };
  }

  const distanceKm = roundKm(straightKm * randFloat(1.25, 1.45));
  const speed = randFloat(18, 30);
  return {
    distanceKm,
    durationMin: Math.max(1, Math.round((distanceKm / speed) * 60)),
    source: 'osrm',
  };
}

// ─────────────────────────────────────────────────────────────
// Chon dia diem — preset 60% / search 30% / map 10%
// ─────────────────────────────────────────────────────────────

/** Mot diem bam bat ky quanh trung tam Ha Noi. */
function randomMapPlace() {
  const lat = Number(randFloat(20.97, 21.09).toFixed(5));
  const lon = Number(randFloat(105.76, 105.9).toFixed(5));
  return {
    id: mapPlaceId(lat, lon),
    label: pick([
      'Ngõ 32 Hoàng Cầu',
      'Đường Nguyễn Trãi',
      'Phố Kim Mã',
      'Ngách 12 Láng Hạ',
      'Đường Giải Phóng',
      'Phố Tôn Đức Thắng',
    ]),
    source: 'map',
    lat,
    lon,
  };
}

function randomDestination() {
  const roll = rand();
  if (roll < 0.6) {
    const addr = pick(ADDRESSES);
    return { id: addr.id, label: addr.label, source: 'preset', lat: addr.lat, lon: addr.lon };
  }
  if (roll < 0.9) {
    const place = pick(SEARCH_PLACES);
    return { id: place.id, label: place.label, source: 'search', lat: place.lat, lon: place.lon };
  }
  return randomMapPlace();
}

/** 75% giu diem don mac dinh — `pickup_id != 'pickup-current'` la ti le doi. */
function randomPickup() {
  if (chance(0.75)) {
    return {
      id: FIXED_PICKUP.id,
      label: FIXED_PICKUP.label,
      source: 'preset',
      lat: FIXED_PICKUP.lat,
      lon: FIXED_PICKUP.lon,
    };
  }
  return randomDestination();
}

// ─────────────────────────────────────────────────────────────
// Thoi gian
// ─────────────────────────────────────────────────────────────

/**
 * Trong so gio TRONG NGAY (gio dia phuong 0-23).
 * Cao diem 7-9h va 17-20h; trua 11-13h; dem gan nhu vang.
 */
const HOUR_WEIGHTS = (() => {
  const w = new Array(24).fill(0.15);
  for (const h of [7, 8, 9, 17, 18, 19, 20]) w[h] = 3;
  for (const h of [11, 12, 13]) w[h] = 2.5;
  for (const h of [6, 10, 14, 15, 16, 21, 22]) w[h] = 1;
  return w;
})();

const HOURS = Array.from({ length: 24 }, (_, i) => i);

/** Ngay dia phuong -> moc UTC. Bo buoc nay thi "gio cao diem" lech 7 tieng. */
function localToUtc(year, month, day, hour, minute, second) {
  return new Date(Date.UTC(year, month, day, hour, minute, second) - TZ_OFFSET_HOURS * 3600_000);
}

/**
 * Sinh danh sach thoi diem bat dau session, trai deu `days` ngay gan nhat.
 * Cuoi tuan x1.5 — nhu nhip that cua mot app goi xe/goi do an.
 */
function planSessionStarts(count, days) {
  const now = new Date();
  const todayLocal = new Date(now.getTime() + TZ_OFFSET_HOURS * 3600_000);

  const dayList = [];
  const dayWeights = [];
  for (let back = days - 1; back >= 0; back -= 1) {
    const d = new Date(
      Date.UTC(
        todayLocal.getUTCFullYear(),
        todayLocal.getUTCMonth(),
        todayLocal.getUTCDate() - back,
      ),
    );
    const weekday = d.getUTCDay();
    dayList.push(d);
    dayWeights.push(weekday === 0 || weekday === 6 ? 1.5 : 1);
  }

  const starts = [];
  for (let i = 0; i < count; i += 1) {
    const day = pickWeighted(dayList, dayWeights);
    const hour = pickWeighted(HOURS, HOUR_WEIGHTS);
    starts.push(
      localToUtc(
        day.getUTCFullYear(),
        day.getUTCMonth(),
        day.getUTCDate(),
        hour,
        randInt(0, 59),
        randInt(0, 59),
      ),
    );
  }

  return starts.sort((a, b) => a - b);
}

// ─────────────────────────────────────────────────────────────
// Bo dung session
//
// Giu dung ba bat bien cua event-taxonomy.md:
//   1. `previous_screen` chi doi khi co screen_view moi — dung yen ban nhieu
//      event thi no giu nguyen.
//   2. `step_index` tra tu SCREENS, tru add_to_cart (luon 3) va select_flow
//      (luon 0).
//   3. `flow: 'none'` CHI o screen_view cua home.
// ─────────────────────────────────────────────────────────────

class Session {
  constructor(sessionId, userId, startAt, batchId) {
    this.sessionId = sessionId;
    this.userId = userId;
    this.at = new Date(startAt.getTime());
    this.batchId = batchId;
    this.previousScreen = null;
    this.currentScreen = null;
    this.events = [];
    /** Dia chi giao cua luong food — null = giu mac dinh (GPS / DEFAULT_PICKUP). */
    this.deliverTo = null;
    /** Gio dia phuong cua session — dung de xet activeHours cua khuyen mai. */
    this.hour = new Date(startAt.getTime() + TZ_OFFSET_HOURS * 3600_000).getUTCHours();
  }

  /** Day dong ho len `sec` giay. Moi event cach nhau it nhat 1 giay. */
  tick(minSec, maxSec) {
    this.at = new Date(this.at.getTime() + Math.max(1, randInt(minSec, maxSec)) * 1000);
  }

  emit(eventName, screenName, properties = {}, override = {}) {
    const spec = SCREENS[screenName];
    this.events.push({
      session_id: this.sessionId,
      user_id: this.userId,
      flow: override.flow ?? spec.flow,
      event_name: eventName,
      screen_name: screenName,
      previous_screen: this.previousScreen,
      step_index: override.stepIndex ?? spec.stepIndex,
      properties,
      platform: 'web',
      created_at: new Date(this.at.getTime()),
      seed_batch: this.batchId,
    });
  }

  /** Dieu huong sang mot man moi: doi previous_screen roi ban screen_view. */
  visit(screenName) {
    this.tick(1, 3);
    this.previousScreen = this.currentScreen;
    this.currentScreen = screenName;
    this.emit('screen_view', screenName);
  }

  /** Thoi gian can nhac trong mot man. 8% la tab bo quen (dwell > 300s). */
  think(minSec, maxSec) {
    if (chance(0.08)) this.tick(320, 900);
    else this.tick(minSec, maxSec);
  }
}

function startFlow(s, flow, directEntry = false) {
  const screen = flow === 'ride' ? 'address_selection' : 'food_menu';
  if (directEntry) {
    s.tick(1, 3);
    s.think(2, 12);
    s.emit(
      'select_flow',
      screen,
      { flow_chosen: flow, entry_source: 'direct_url' },
      { flow, stepIndex: SELECT_FLOW_STEP_INDEX },
    );
    s.visit(screen);
    return;
  }

  s.visit('home');
  s.think(2, 12);
  s.emit('select_flow', 'home', { flow_chosen: flow }, {
    flow,
    stepIndex: SELECT_FLOW_STEP_INDEX,
  });
  s.visit(screen);
}

// ─────────────────────────────────────────────────────────────
// Luong Ride
// ─────────────────────────────────────────────────────────────

/** Trong so buoc bo do — bo nhieu nhat ngay o buoc chon dia chi. */
const RIDE_ABANDON_STEPS = [1, 2, 3, 4, 5];
const RIDE_ABANDON_WEIGHTS = [30, 20, 20, 15, 15];

function emitSelectAddress(s, destination) {
  s.think(5, 40);
  s.emit('select_address', 'address_selection', {
    address_id: destination.id,
    address_label: destination.label,
    address_source: destination.source,
  });
}

function emitConfirmPickup(s, destination, pickup, driverNote) {
  s.think(4, 25);
  s.emit('confirm_pickup', 'pickup_confirm', {
    address_id: destination.id,
    pickup_id: pickup.id,
    pickup_label: pickup.label,
    pickup_source: pickup.source,
    // Chuoi RONG khi khong nhap, khong phai null — de pandas dem
    // `(df.driver_note != '').mean()` ra ngay ti le dung.
    driver_note: driverNote,
  });
}

function emitSelectVehicle(s, vehicle, route) {
  s.think(5, 30);
  s.emit('select_vehicle', 'vehicle_selection', {
    vehicle_id: vehicle.id,
    vehicle_type: vehicle.type,
    // `base_price` chi doc duoc khi co `distance_km` di kem — gia tinh theo km.
    base_price: calcFare(vehicle, route.distanceKm),
    distance_km: route.distanceKm,
  });
}

function buildRideSession(s, directEntry = false) {
  const outcome = pickWeighted(['complete', 'cancel', 'abandon'], [55, 12, 33]);
  const abandonAt = outcome === 'abandon' ? pickWeighted(RIDE_ABANDON_STEPS, RIDE_ABANDON_WEIGHTS) : 99;
  // Bam Back o dung mot buoc, o 18% session — cap so lieu cho nhom 4
  // (back rate, revisit count) cua analysis-spec.md. Khong co buoc 2 trong
  // danh sach: "quay ve doi diem den" da co duong rieng la `change_address`.
  const backAt = chance(0.18) ? pickWeighted([3, 4, 5], [40, 30, 30]) : 0;

  startFlow(s, 'ride', directEntry);

  // ── step 1: chon diem den ──
  if (abandonAt === 1 && chance(0.45)) return; // roi ngay khi vua nhin thay man
  let destination = randomDestination();
  emitSelectAddress(s, destination);
  if (abandonAt === 1) return;

  // ── step 2: xac nhan diem don ──
  s.visit('pickup_confirm');
  if (abandonAt === 2 && chance(0.4)) return;

  if (chance(0.1)) {
    // Doi diem den: quay ve man truoc roi chon lai.
    s.think(3, 15);
    s.emit('change_address', 'pickup_confirm', { address_id: destination.id });
    s.visit('address_selection');
    destination = randomDestination();
    emitSelectAddress(s, destination);
    s.visit('pickup_confirm');
  }

  const pickup = randomPickup();
  const driverNote = chance(0.3) ? pick(DRIVER_NOTES) : '';
  emitConfirmPickup(s, destination, pickup, driverNote);
  if (abandonAt === 2) return;

  // ── step 3: chon xe ──
  const route = makeRoute(pickup, destination);
  s.visit('vehicle_selection');
  if (abandonAt === 3 && chance(0.4)) return;
  let vehicle = pickWeighted(VEHICLES, VEHICLE_WEIGHTS);
  emitSelectVehicle(s, vehicle, route);
  if (abandonAt === 3) return;

  if (backAt === 3) {
    s.think(3, 20);
    s.emit('back', 'vehicle_selection', { to_screen: 'pickup_confirm' });
    s.visit('pickup_confirm');
    emitConfirmPickup(s, destination, pickup, driverNote);
    s.visit('vehicle_selection');
    vehicle = pickWeighted(VEHICLES, VEHICLE_WEIGHTS);
    emitSelectVehicle(s, vehicle, route);
  }

  // ── step 4: khuyen mai ──
  const basePrice = calcFare(vehicle, route.distanceKm);
  s.visit('promo_selection');
  if (abandonAt === 4 && chance(0.4)) return;

  const ctx = { vehicleType: vehicle.type, distanceKm: route.distanceKm, hour: s.hour };
  const usable = PROMOS.filter((p) => isRuleAvailable(p, basePrice, ctx));
  let promo = null;

  s.think(3, 20);
  if (usable.length > 0 && chance(0.65)) {
    promo = pick(usable);
    s.emit('select_promo', 'promo_selection', {
      promo_id: promo.id,
      promo_code: promo.code,
      // So tien giam THUC TE (VND), khong phai phan tram.
      discount_amount: calcDiscount(promo, basePrice),
    });
  } else {
    s.emit('skip_promo', 'promo_selection');
  }
  if (abandonAt === 4) return;

  if (backAt === 4) {
    s.think(3, 18);
    s.emit('back', 'promo_selection', { to_screen: 'vehicle_selection' });
    s.visit('vehicle_selection');
    emitSelectVehicle(s, vehicle, route);
    s.visit('promo_selection');
    s.think(3, 15);
    s.emit('skip_promo', 'promo_selection');
    promo = null;
  }

  // ── step 5: xac nhan ──
  const discountAmount = promo ? calcDiscount(promo, basePrice) : 0;
  const paymentMethod = chance(0.8) ? 'cash' : 'qr';

  // 15 khoa nay duoc dung lai nguyen ven cho `cancel_ride` — taxonomy noi
  // cancel_ride mirror toan bo field cua confirm_ride.
  const rideProps = {
    address_id: destination.id,
    address_label: destination.label,
    address_source: destination.source,
    pickup_id: pickup.id,
    pickup_label: pickup.label,
    distance_km: route.distanceKm,
    duration_min: route.durationMin,
    route_source: route.source,
    vehicle_id: vehicle.id,
    vehicle_type: vehicle.type,
    promo_id: promo ? promo.id : null,
    base_price: basePrice,
    discount_amount: discountAmount,
    final_price: basePrice - discountAmount,
    payment_method: paymentMethod,
  };

  s.visit('ride_confirm');
  if (abandonAt === 5 && chance(0.5)) return;

  if (backAt === 5) {
    s.think(4, 25);
    s.emit('back', 'ride_confirm', { to_screen: 'promo_selection' });
    s.visit('promo_selection');
    s.think(3, 15);
    s.emit('skip_promo', 'promo_selection');
    s.visit('ride_confirm');
    rideProps.promo_id = null;
    rideProps.discount_amount = 0;
    rideProps.final_price = basePrice;
  }

  if (abandonAt === 5) return;

  s.think(4, 25);
  s.emit('confirm_ride', 'ride_confirm', rideProps);

  // ── step 6: tim tai xe ──
  s.visit('finding_driver');
  s.emit('driver_searching', 'finding_driver');

  if (outcome === 'cancel') {
    s.tick(3, 40);
    s.emit('cancel_ride', 'finding_driver', {
      cancel_reason: 'user_cancelled',
      cancel_stage: 'finding_driver',
      ...rideProps,
    });
    return;
  }

  s.tick(2, 3);
  const driver = pick(MOCK_DRIVERS);
  s.emit('driver_assigned', 'finding_driver', {
    driver_id: driver.id,
    driver_name: driver.name,
    driver_phone: driver.phone,
    vehicle_plate: driver.plate,
    eta_min: randInt(3, 8),
  });

  // ── step 7: xong ──
  s.visit('ride_success');
  s.think(3, 30);
  s.emit('back_to_home', 'ride_success');
}

// ─────────────────────────────────────────────────────────────
// Luong Food
// ─────────────────────────────────────────────────────────────

function normalizeVi(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/** 4h-10h sang, 10h-16h trua, con lai toi — giong mealOfHour() o food.ts. */
function mealOfHour(hour) {
  if (hour >= 4 && hour < 10) return 'breakfast';
  if (hour >= 10 && hour < 16) return 'lunch';
  return 'dinner';
}

const cartSize = (cart) => cart.reduce((sum, l) => sum + l.quantity, 0);
const cartTotal = (cart) => cart.reduce((sum, l) => sum + l.item.price * l.quantity, 0);

/** Buoc bo do cua luong food — dong nhat o gio hang (step 4). */
const FOOD_ABANDON_STEPS = [1, 2, 3, 4, 5, 6];
const FOOD_ABANDON_WEIGHTS = [18, 14, 12, 30, 14, 12];

function buildFoodSession(s, directEntry = false) {
  const completes = chance(0.5);
  const abandonAt = completes ? 99 : pickWeighted(FOOD_ABANDON_STEPS, FOOD_ABANDON_WEIGHTS);
  const backAt = chance(0.18) ? pickWeighted([5, 6], [50, 50]) : 0;

  startFlow(s, 'food', directEntry);

  // ── step 1: thuc don ──
  if (abandonAt === 1 && chance(0.45)) return;

  // `discovery_source` ghi bo loc DANG BAT luc bam mon. Bon bo loc loai tru
  // nhau, nen bien nay chi co mot gia tri tai moi thoi diem.
  //
  // `candidates` di kem no va PHAI khop: bam chip "Tráng miệng" roi chon sushi
  // voi `discovery_source: "category"` la mot cau tra loi sai cho dung cau hoi
  // ma khoa nay sinh ra de tra loi — loi kham pha nao dan toi add_to_cart nhieu
  // nhat. App that khong bao gio hien mon ngoai bo loc.
  let discoverySource = 'all';
  let candidates = FOOD_ITEMS;

  if (chance(0.15)) {
    s.think(4, 20);
    const deliverTo = randomDestination();
    s.emit('change_address', 'food_menu', {
      address_id: deliverTo.id,
      address_label: deliverTo.label,
      address_source: deliverTo.source,
    });
    s.deliverTo = deliverTo;
  }

  const discoverySteps = randInt(0, 2);
  for (let i = 0; i < discoverySteps; i += 1) {
    const kind = pickWeighted(['category', 'search', 'restaurant', 'meal'], [30, 30, 20, 20]);
    s.think(4, 25);

    if (kind === 'category') {
      const category = pickWeighted(['main', 'drink', 'dessert'], [60, 25, 15]);
      s.emit('filter_category', 'food_menu', { category });
      discoverySource = 'category';
      candidates = FOOD_ITEMS.filter((it) => it.category === category);
    } else if (kind === 'search') {
      const query = pick(SEARCH_QUERIES);
      const needle = normalizeVi(query);
      const hits = FOOD_ITEMS.filter((it) => normalizeVi(it.name).includes(needle));
      s.emit('search_item', 'food_menu', {
        query,
        // `result_count == 0` la con so dang gia nhat cua event nay: nguoi dung
        // tim mot mon ma thuc don khong co.
        result_count: hits.length,
        restaurant_count: randInt(0, 6),
      });
      // Tim khong ra thi khong co gi de bam — nguoi dung xoa o tim, bo loc ve
      // lai 'all'. De `discovery_source: "search"` voi 0 ket qua la mau thuan.
      discoverySource = hits.length > 0 ? 'search' : 'all';
      candidates = hits.length > 0 ? hits : FOOD_ITEMS;
    } else if (kind === 'restaurant') {
      const restaurant = pick(RESTAURANTS);
      s.emit('select_restaurant', 'food_menu', {
        restaurant_id: restaurant.id,
        restaurant_name: restaurant.name,
        distance_km: roundKm(randFloat(0.3, 6)),
        item_count: randInt(3, 8),
        // Tag OSM tho, nguyen van. Mang rong = quan khong khai bao cuisine,
        // dung nhu mot nua mau quan that o Ha Noi.
        cuisine: restaurant.cuisine,
      });
      discoverySource = 'restaurant';
      // Thuc don mot quan do menuOf() suy tu tag `cuisine` THAT luc chay, khong
      // tai hien duoc o day — giu ca thuc don lam tap chon.
      candidates = FOOD_ITEMS;
    } else {
      const defaultMeal = mealOfHour(s.hour);
      const meal = chance(0.6) ? defaultMeal : pick(['breakfast', 'lunch', 'dinner']);
      s.emit('select_meal', 'food_menu', { meal, is_default: meal === defaultMeal });
      discoverySource = 'meal';
      candidates = FOOD_ITEMS.filter((it) => it.meals.includes(meal));
    }
  }

  if (abandonAt === 1) return;

  // ── step 2 + 3: chon mon va them vao gio ──
  const wanted = pickMany(candidates, randInt(1, 3));
  const cart = [];

  for (let i = 0; i < wanted.length; i += 1) {
    const item = wanted[i];
    const quantity = pickWeighted([1, 2, 3], [65, 25, 10]);

    // 35% them nhanh ngay tren luoi mon, khong mo man chi tiet.
    // Session bo do o buoc 2 BAT BUOC phai mo man chi tiet — khong thi no
    // khong bao gio cham buoc 2 va `max(step_index)` ghi sai diem bo do.
    const quickAdd = abandonAt === 2 && i === 0 ? false : chance(0.35);

    if (!quickAdd) {
      s.think(4, 20);
      s.emit('select_item', 'food_menu', {
        item_id: item.id,
        item_name: item.name,
        price: item.price,
        discovery_source: discoverySource,
      });

      s.visit('food_item_detail');
      if (abandonAt === 2 && i === 0) return;

      if (quantity > 1) {
        s.think(3, 12);
        s.emit('change_quantity', 'food_item_detail', { item_id: item.id, quantity });
      }
    }

    cart.push({ item, quantity });
    s.think(3, 15);

    const props = {
      item_id: item.id,
      item_name: item.name,
      price: item.price,
      quantity,
      cart_size_after: cartSize(cart),
      // Tong tien HANG sau khi them, CHUA gom phi giao va uu dai.
      cart_total_after: cartTotal(cart),
    };
    // `discovery_source` CHI co khi ban tu food_menu. Ban tu food_item_detail
    // thi nguoi dung da roi man menu, bo loc khong con nghia — khoa vang mat.
    if (quickAdd) props.discovery_source = discoverySource;

    s.emit(
      'add_to_cart',
      quickAdd ? 'food_menu' : 'food_item_detail',
      props,
      { stepIndex: ADD_TO_CART_STEP_INDEX },
    );

    if (abandonAt === 3 && i === 0) return;

    // Quay lai thuc don de chon mon tiep.
    if (!quickAdd && i < wanted.length - 1) {
      s.think(2, 8);
      s.emit('back', 'food_item_detail', { to_screen: 'food_menu' });
      s.visit('food_menu');
    }
  }

  if (abandonAt === 2 || abandonAt === 3) return;

  // ── step 4: gio hang ──
  s.visit('food_cart');
  if (abandonAt === 4 && chance(0.5)) return;

  if (chance(0.2) && cart.length > 0) {
    const line = pick(cart);
    const next = Math.max(1, line.quantity + pickWeighted([-1, 1], [40, 60]));
    line.quantity = next;
    s.think(3, 15);
    s.emit('change_quantity', 'food_cart', {
      item_id: line.item.id,
      quantity: next,
      cart_total_after: cartTotal(cart),
    });
  }

  if (chance(0.15) && cart.length > 1) {
    const idx = Math.floor(rand() * cart.length);
    const [removed] = cart.splice(idx, 1);
    s.think(3, 15);
    s.emit('remove_from_cart', 'food_cart', {
      item_id: removed.item.id,
      item_name: removed.item.name,
      quantity_removed: removed.quantity,
      cart_size_after: cartSize(cart),
      cart_total_after: cartTotal(cart),
    });
  }

  if (abandonAt === 4) return;

  const subtotal = cartTotal(cart);
  s.think(3, 20);
  s.emit('proceed_to_offer', 'food_cart', { cart_size: cartSize(cart), cart_total: subtotal });

  // ── step 5: uu dai ──
  s.visit('food_offer_selection');
  if (abandonAt === 5 && chance(0.5)) return;

  if (backAt === 5) {
    s.think(3, 18);
    s.emit('back', 'food_offer_selection', { to_screen: 'food_cart' });
    s.visit('food_cart');
    s.think(3, 15);
    s.emit('proceed_to_offer', 'food_cart', { cart_size: cartSize(cart), cart_total: subtotal });
    s.visit('food_offer_selection');
  }

  const usable = OFFERS.filter((o) => isRuleAvailable(o, subtotal, { hour: s.hour }));
  let offer = null;

  s.think(3, 18);
  if (usable.length > 0 && chance(0.6)) {
    offer = pick(usable);
    s.emit('select_offer', 'food_offer_selection', {
      offer_id: offer.id,
      offer_code: offer.code,
      // SHIPPING_FEE di kem: uu dai `appliesTo: 'shipping'` giam tren phi giao.
      discount_amount: calcDiscount(offer, subtotal, SHIPPING_FEE),
    });
  } else {
    s.emit('skip_offer', 'food_offer_selection');
  }
  if (abandonAt === 5) return;

  // ── step 6: dat don ──
  s.visit('food_confirm');
  if (abandonAt === 6 && chance(0.5)) return;

  if (backAt === 6) {
    s.think(4, 20);
    s.emit('back', 'food_confirm', { to_screen: 'food_offer_selection' });
    s.visit('food_offer_selection');
    s.think(3, 15);
    s.emit('skip_offer', 'food_offer_selection');
    offer = null;
    s.visit('food_confirm');
  }

  if (abandonAt === 6) return;

  const discountAmount = offer ? calcDiscount(offer, subtotal, SHIPPING_FEE) : 0;
  const deliverTo = s.deliverTo ?? {
    label: FIXED_PICKUP.label,
    source: 'preset',
  };

  s.think(4, 20);
  s.emit('place_order', 'food_confirm', {
    item_count: cartSize(cart),
    cart_total: subtotal,
    shipping_fee: SHIPPING_FEE,
    offer_id: offer ? offer.id : null,
    discount_amount: discountAmount,
    final_total: subtotal + SHIPPING_FEE - discountAmount,
    // Event nay phai TU MO TA DU MOT DON HANG — /history dung lai don tu rieng no.
    // KHONG ghi lat/lon: toa do GPS la du lieu vi tri chinh xac, ma phan tich chi
    // can biet CO DOI dia chi hay khong.
    address_label: deliverTo.label,
    address_source: deliverTo.source,
  });

  // ── step 7: xong ──
  s.visit('food_success');
  s.think(3, 30);
  s.emit('back_to_home', 'food_success');
}

// ─────────────────────────────────────────────────────────────
// Sinh toan bo
// ─────────────────────────────────────────────────────────────

function generate(opts, batchId) {
  const starts = planSessionStarts(opts.sessions, opts.days);

  // Nhieu session hon so nguoi dung — co nguoi quay lai nhieu lan. Luy thua 1.6
  // keo lua chon ve phia dau danh sach, tao ra mot nhom nguoi dung "quen mat".
  const userCount = Math.max(5, Math.round(opts.sessions / 5));
  const users = Array.from({ length: userCount }, () => `mock-user-${seededUuid().slice(0, 8)}`);

  const sessions = [];
  let directEntryCount = 0;
  for (const startAt of starts) {
    const userId = users[Math.floor(rand() ** 1.6 * users.length)];
    const s = new Session(seededUuid(), userId, startAt, batchId);

    // 8% session rac: mo trang chu roi dong ngay. drop_junk_sessions() cua
    // metrics.py se loai chung — dung muc dich, de buoc loc do co viec ma lam.
    if (chance(0.08)) {
      s.visit('home');
      sessions.push(s);
      continue;
    }

    const flowRoll = chance(0.6);
    const directFlow =
      directEntryCount < DIRECT_ENTRY_FLOWS.length
        ? DIRECT_ENTRY_FLOWS[directEntryCount]
        : null;
    directEntryCount += directFlow ? 1 : 0;

    if (directFlow === 'ride') buildRideSession(s, true);
    else if (directFlow === 'food') buildFoodSession(s, true);
    else if (flowRoll) buildRideSession(s);
    else buildFoodSession(s);

    sessions.push(s);
  }

  return sessions;
}

// ─────────────────────────────────────────────────────────────
// Tu kiem tra
//
// Chay TRUOC moi lan ghi. Mot event sai bat bien khong lam app do — no chi lam
// funnel sai, va sai o Firestore thi phai xoa ca dot seed di lam lai.
// ─────────────────────────────────────────────────────────────

/** Khoa mang so tien — deu phai la SO NGUYEN VND (event-taxonomy.md muc 1). */
const MONEY_KEYS = [
  'base_price', 'discount_amount', 'final_price', 'price',
  'cart_total', 'cart_total_after', 'shipping_fee', 'final_total',
];

function validate(sessions) {
  const problems = [];
  const note = (session, event, message) =>
    problems.push(`${session.sessionId.slice(0, 8)} · ${event.event_name} · ${message}`);

  for (const s of sessions) {
    let expectedPrevious = null;
    let lastVisited = null;
    let lastAt = 0;
    let enteredFlow = null;
    let sawSelectFlow = false;

    for (const e of s.events) {
      if (!EVENT_NAMES.has(e.event_name)) note(s, e, `event_name lạ`);
      if (!SCREENS[e.screen_name]) note(s, e, `screen_name lạ: ${e.screen_name}`);

      // step_index — tra tu SCREENS, tru hai ngoai le da ghi o taxonomy muc 1.
      const expectedStep =
        e.event_name === 'add_to_cart'
          ? ADD_TO_CART_STEP_INDEX
          : e.event_name === 'select_flow'
            ? SELECT_FLOW_STEP_INDEX
            : SCREENS[e.screen_name].stepIndex;
      if (e.step_index !== expectedStep) {
        note(s, e, `step_index ${e.step_index}, đáng lẽ ${expectedStep}`);
      }

      // flow 'none' CHI o screen_view cua home.
      if (e.flow === 'none' && !(e.event_name === 'screen_view' && e.screen_name === 'home')) {
        note(s, e, `flow "none" ở ngoài screen_view@home`);
      }
      if (e.event_name === 'select_flow') {
        if (e.flow === 'none') note(s, e, 'select_flow mang flow "none"');
        sawSelectFlow = true;
      }

      // previous_screen doi DUY NHAT khi co screen_view moi.
      if (e.event_name === 'screen_view') {
        expectedPrevious = lastVisited;
        lastVisited = e.screen_name;
      }
      if (e.previous_screen !== expectedPrevious) {
        note(s, e, `previous_screen ${e.previous_screen}, đáng lẽ ${expectedPrevious}`);
      }

      // Nhom 3 (dwell) va nhom 6 (replay) phu thuoc thu tu thoi gian.
      const at = e.created_at.getTime();
      if (at < lastAt) note(s, e, 'created_at lùi về quá khứ');
      lastAt = at;

      for (const key of MONEY_KEYS) {
        const value = e.properties[key];
        if (value !== undefined && !Number.isInteger(value)) {
          note(s, e, `${key} = ${value} không phải số nguyên VNĐ`);
        }
      }

      if (e.flow !== 'none') enteredFlow = e.flow;
    }

    // Vao luong ma thieu select_flow = funnel khong co buoc 0, moi ti le tinh
    // tu mau so do deu sai (co the vuot 100%).
    if (enteredFlow && !sawSelectFlow) {
      problems.push(`${s.sessionId.slice(0, 8)} · vào luồng ${enteredFlow} mà thiếu select_flow`);
    }
  }

  return problems;
}

// ─────────────────────────────────────────────────────────────
// Thong ke va in thu
// ─────────────────────────────────────────────────────────────

function summarize(sessions) {
  const docs = sessions.reduce((sum, s) => sum + s.events.length, 0);
  const byFlow = { ride: 0, food: 0, junk: 0 };
  const count = { confirmRide: 0, cancelRide: 0, rideSuccess: 0, placeOrder: 0 };

  for (const s of sessions) {
    const names = new Set(s.events.map((e) => e.event_name));
    const flows = new Set(s.events.map((e) => e.flow));

    if (flows.has('ride')) byFlow.ride += 1;
    else if (flows.has('food')) byFlow.food += 1;
    else byFlow.junk += 1;

    if (names.has('confirm_ride')) count.confirmRide += 1;
    if (names.has('cancel_ride')) count.cancelRide += 1;
    if (names.has('back_to_home') && flows.has('ride')) count.rideSuccess += 1;
    if (names.has('place_order')) count.placeOrder += 1;
  }

  return { docs, byFlow, count };
}

function printSummary(sessions, opts) {
  const { docs, byFlow, count } = summarize(sessions);
  const pct = (n, d) => (d === 0 ? '—' : `${((n / d) * 100).toFixed(1)}%`);

  const first = sessions[0].events[0].created_at;
  const last = sessions[sessions.length - 1].events[0].created_at;

  console.log('\n── Tổng quan ──────────────────────────────────');
  console.log(`  Session            ${sessions.length}`);
  console.log(`  Document           ${docs}  (~${(docs / sessions.length).toFixed(1)} event/session)`);
  console.log(`  Khoảng thời gian   ${opts.days} ngày`);
  console.log(`    từ   ${first.toISOString()}`);
  console.log(`    đến  ${last.toISOString()}`);
  console.log(`  Luồng ride         ${byFlow.ride}`);
  console.log(`  Luồng food         ${byFlow.food}`);
  console.log(`  Session rác (1 event, sẽ bị metrics.py lọc)  ${byFlow.junk}`);
  console.log('\n── Kết cục ────────────────────────────────────');
  // `analysis-spec.md` định nghĩa hoàn thành funnel ride = CÓ `confirm_ride`.
  // Session bị huỷ vẫn bắn `confirm_ride` trước rồi mới `cancel_ride`, nên nó
  // nằm TRONG con số đầu tiên — tách ra hai dòng dưới để không đọc nhầm.
  console.log(`  Ride có confirm_ride  ${count.confirmRide}  (${pct(count.confirmRide, byFlow.ride)})`);
  console.log(`    ├─ huỷ ở finding_driver  ${count.cancelRide}  (${pct(count.cancelRide, byFlow.ride)})`);
  console.log(`    └─ tới ride_success      ${count.rideSuccess}  (${pct(count.rideSuccess, byFlow.ride)})`);
  console.log(`  Food có place_order   ${count.placeOrder}  (${pct(count.placeOrder, byFlow.food)})`);

  // Phan bo theo gio dia phuong — de kiem tra "gio cao diem" khong bi lech mui.
  const hours = new Array(24).fill(0);
  for (const s of sessions) {
    const local = new Date(s.events[0].created_at.getTime() + TZ_OFFSET_HOURS * 3600_000);
    hours[local.getUTCHours()] += 1;
  }
  const peak = Math.max(...hours);
  console.log('\n── Session theo giờ (giờ Việt Nam) ────────────');
  for (let h = 0; h < 24; h += 1) {
    const bar = '█'.repeat(Math.round((hours[h] / peak) * 40));
    console.log(`  ${String(h).padStart(2, '0')}h ${String(hours[h]).padStart(4)} ${bar}`);
  }
}

function printTimeline(session, title) {
  console.log(`\n── ${title} ───────────────────────────────────`);
  console.log(`  session_id ${session.sessionId}`);
  console.log(`  user_id    ${session.userId}`);
  const start = session.events[0].created_at.getTime();
  for (const e of session.events) {
    const offset = Math.round((e.created_at.getTime() - start) / 1000);
    const props = Object.keys(e.properties).length
      ? JSON.stringify(e.properties)
      : '{}';
    console.log(
      `  +${String(offset).padStart(4)}s  step ${e.step_index}  ${e.flow.padEnd(4)}  ` +
        `${e.event_name.padEnd(18)} @${(e.screen_name ?? '').padEnd(20)} ` +
        `prev=${String(e.previous_screen).padEnd(20)} ${props}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Firestore
// ─────────────────────────────────────────────────────────────

/**
 * Credential Firestore — thu HAI duong, theo thu tu.
 *
 *   1. serviceAccountKey.json o goc repo.
 *   2. Ba bien FIREBASE_* trong .env.local — DUNG NGUON MA app DANG DUNG.
 *
 * Duong 2 ton tai vi mot ly do rat cu the: ai chay duoc `npm run dev` thi da co
 * credential roi. Bat ho tai them mot service account key nua chi de chay script
 * nay la tao ra mot file bi mat thu hai phai quan ly, cho cung mot quyen truy cap.
 *
 * `process.loadEnvFile` la built-in cua Node (tu 20.12) — KHONG them thu vien
 * nao (CLAUDE.md quy tac 8), va no parse dung gia tri nhieu dong trong ngoac kep,
 * cho nen khong phai tu viet parser .env (cho de vo nhat voi mot PEM).
 */
function readCredential() {
  const { cert } = require('firebase-admin/app');

  if (fs.existsSync(KEY_PATH)) {
    return { credential: cert(require(KEY_PATH)), source: path.relative(ROOT, KEY_PATH) };
  }

  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) {
    fail(
      'Không tìm thấy credential Firebase ở cả hai nơi:\n' +
        `  1. ${path.relative(ROOT, KEY_PATH)}  (service account key JSON)\n` +
        `  2. ${path.relative(ROOT, envPath)}  (3 biến FIREBASE_*)\n\n` +
        'Cách nhanh nhất: chép .env.example thành .env.local rồi điền giá trị\n' +
        '(setup.md Phase 1) — cùng file mà `npm run dev` đang dùng.\n' +
        'Muốn xem trước dữ liệu mà chưa cần credential thì chạy với --dry-run.',
    );
  }

  if (typeof process.loadEnvFile !== 'function') {
    fail(
      `Node ${process.version} quá cũ để đọc ${path.relative(ROOT, envPath)} ` +
        '(cần process.loadEnvFile, có từ Node 20.12).\n' +
        `Nâng Node lên, hoặc đặt service account key JSON vào:\n  ${KEY_PATH}`,
    );
  }

  process.loadEnvFile(envPath);

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  const missing = [
    !projectId && 'FIREBASE_PROJECT_ID',
    !clientEmail && 'FIREBASE_CLIENT_EMAIL',
    !privateKey && 'FIREBASE_PRIVATE_KEY',
  ].filter(Boolean);

  if (missing.length > 0) {
    fail(
      `${path.relative(ROOT, envPath)} thiếu biến: ${missing.join(', ')}.\n` +
        'Xem setup.md Phase 1.',
    );
  }

  return {
    credential: cert({
      projectId,
      clientEmail,
      // Giu dong replace nay giong lib/server/db/firebase-admin.ts: file .env
      // cua may nay luu newline that, nhung may khac co the luu dang literal `\n`.
      // Thieu no se loi: error:1E08010C:DECODER routines::unsupported
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
    source: path.relative(ROOT, envPath),
  };
}

function connect() {
  // `firebase-admin` la dependency cua chinh du an, nam o node_modules o
  // node_modules/ o goc — script khong them dependency nao (CLAUDE.md quy tac 8).
  let appModule;
  let firestoreModule;
  try {
    appModule = require('firebase-admin/app');
    firestoreModule = require('firebase-admin/firestore');
  } catch {
    fail("Không import được 'firebase-admin'. Chạy `npm install` ở thư mục gốc rồi thử lại.");
  }

  const { getApps, initializeApp } = appModule;
  const { getFirestore, Timestamp } = firestoreModule;

  const { credential, source } = readCredential();
  console.log(`Credential Firebase lấy từ: ${source}`);

  // getApps() truoc initializeApp — cung ly do voi lib/server/db/firebase-admin.ts.
  const app = getApps()[0] ?? initializeApp({ credential });

  return { db: getFirestore(app), Timestamp };
}

async function write(sessions, batchId) {
  const { db, Timestamp } = connect();
  const collection = db.collection(EVENTS_COLLECTION);

  const docs = [];
  for (const s of sessions) {
    for (const e of s.events) {
      docs.push({ ...e, created_at: Timestamp.fromDate(e.created_at) });
    }
  }

  console.log(`\nĐang ghi ${docs.length} document vào collection "${EVENTS_COLLECTION}"…`);

  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const chunk = docs.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    for (const doc of chunk) batch.set(collection.doc(), doc);
    await batch.commit();
    process.stdout.write(`\r  ${Math.min(i + BATCH_LIMIT, docs.length)}/${docs.length}`);
  }

  console.log(`\n\nXong. seed_batch = ${batchId}`);
  console.log(`Xoá lại bằng:  node scripts/seed-events.js --clear --batch ${batchId}`);
}

/**
 * Xoa du lieu seed.
 *
 * Meo quan trong: `.orderBy('seed_batch')` chi tra ve document CO field do.
 * Event do nguoi that click khong co `seed_batch` nen nam ngoai ket qua mot cach
 * tu nhien — khong can dieu kien `!=` nao, va khong co cach nao xoa nham.
 */
async function clear(opts) {
  const { db } = connect();
  const collection = db.collection(EVENTS_COLLECTION);

  const query = opts.batch
    ? collection.where('seed_batch', '==', opts.batch).limit(BATCH_LIMIT)
    : collection.orderBy('seed_batch').limit(BATCH_LIMIT);

  const target = opts.batch ? `đợt seed "${opts.batch}"` : 'TOÀN BỘ document có field seed_batch';

  if (!opts.yes) {
    if (!process.stdin.isTTY) {
      fail('Cần --yes khi chạy không tương tác (stdin không phải terminal).');
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((resolve) => {
      rl.question(`\nXoá ${target} trong collection "${EVENTS_COLLECTION}"? [y/N] `, resolve);
    });
    rl.close();
    if (!/^y(es)?$/i.test(answer.trim())) {
      console.log('Đã huỷ, không xoá gì.');
      return;
    }
  }

  let deleted = 0;
  for (;;) {
    const snapshot = await query.get();
    if (snapshot.empty) break;

    const batch = db.batch();
    for (const doc of snapshot.docs) batch.delete(doc.ref);
    await batch.commit();

    deleted += snapshot.size;
    process.stdout.write(`\r  đã xoá ${deleted}`);

    if (snapshot.size < BATCH_LIMIT) break;
  }

  console.log(`\n\nXong. Đã xoá ${deleted} document. Event do click tay không bị ảnh hưởng.`);
}

// ─────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.clear) {
    await clear(opts);
    return;
  }

  assertIdsStillExist();

  rand = mulberry32(opts.seed);
  const batchId = `seed-${new Date().toISOString().replace(/[:.]/g, '-')}`;

  const sessions = generate(opts, batchId);

  const problems = validate(sessions);
  if (problems.length > 0) {
    console.error(`\n${problems.length} event vi phạm event-taxonomy.md — không ghi gì:\n`);
    for (const p of problems.slice(0, 20)) console.error(`  ${p}`);
    if (problems.length > 20) console.error(`  … và ${problems.length - 20} lỗi nữa`);
    process.exit(1);
  }

  printSummary(sessions, opts);
  console.log(`\n  Tự kiểm tra: ${sessions.reduce((n, s) => n + s.events.length, 0)} event đạt.`);

  if (opts.dryRun) {
    const rideSample = sessions.find((s) => s.events.some((e) => e.event_name === 'back_to_home' && e.flow === 'ride'));
    const foodSample = sessions.find((s) => s.events.some((e) => e.event_name === 'place_order'));
    if (rideSample) printTimeline(rideSample, 'Mẫu: một session ride hoàn chỉnh');
    if (foodSample) printTimeline(foodSample, 'Mẫu: một session food hoàn chỉnh');
    console.log('\n--dry-run: không ghi gì vào Firestore.\n');
    return;
  }

  await write(sessions, batchId);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
