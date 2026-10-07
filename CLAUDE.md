# CLAUDE.md


## Dự án là gì

Mô phỏng web đặt xe kiểu Green SM (GSM) với hai luồng — **Đặt xe** và **Food** — nhằm **thu thập event hành vi người dùng** rồi phân tích bằng Python/pandas. App chỉ là công cụ sinh dữ liệu; sản phẩm cuối là các chỉ số funnel trong `analysis-spec.md`.

Không có backend thật, không đặt xe thật, không thanh toán. Mọi lựa chọn trong app chỉ sinh ra một document event.

## Bản đồ tài liệu — đọc file nào khi làm gì

| Đang làm | Đọc |
|---|---|
| Bất kỳ việc gì liên quan tới event | **`event-taxonomy.md`** ← hợp đồng dữ liệu, nguồn sự thật |
| Dựng màn hình, routing, state, giỏ hàng | `screen-map.md` |
| Dựng giao diện 6 màn luồng đặt xe | `ride-flow-design.md` |
| Dựng giao diện 6 màn luồng food | `food-flow-design.md` |
| Giao diện phải trông như thế nào | `sample_ui/` — 7 ảnh chụp web Green SM thật |
| Hiểu code giao diện: file nào làm gì, component nào dùng ở đâu | `fe-structure.md` |
| Hiểu code server: route handler, validator, service, luồng một request | `be-structure.md` |
| Cần nội dung địa chỉ / món ăn / khuyến mãi | `mock-data.md` |
| Viết CSS, chọn màu/cỡ chữ/bo góc | `tailwind-theme.md` (giá trị gốc ở `DESIGN.md`) |
| Viết API route | `api-endpoints.md` |
| Cấu trúc database (D1; Firestore cũ) | `db-design.md`, `docs/d1-schema-design.md` |
| **Chạy dự án**, cấu hình D1, biến môi trường, **tra lỗi** | `setup.md` |
| Viết script Python | `analysis-spec.md` |
| Nối Power BI | `docs/POWERBI_D1.md` |
| Migration Firebase → D1, cutover, kiểm chứng | `docs/d1-schema-design.md`, `docs/cutover-runbook.md`, `docs/migration-verification.md`, `docs/firebase-audit.md` |
| Không biết nên làm gì tiếp | `roadmap.md` |
| Lý do chọn công nghệ | `techstack.md`, `ARCHITECTURE.md` |

## Lệnh

Chạy từ **thư mục gốc**. Một project Next.js duy nhất, một process:

```bash
npm install
npm run dev        # next dev :3000 — CẢ giao diện lẫn /api/*
npm run build      # kiểm tra lỗi TypeScript + webpack TRƯỚC khi demo
npm run lint
npm run typecheck
```

Trình duyệt vào **`localhost:3000`**. `/api/*` là route handler của chính app này (`app/api/**/route.ts`) — **không có server thứ hai, không có proxy, không có cổng 4000**.

`npm run build` không phải bước thừa: hai lỗi hay gặp nhất (đuôi `.js` trong import, và import nhầm `lib/server` vào Client Component) **chỉ lộ ra ở `build`, không lộ ở `dev`**.

Không có test tự động — `techstack.md` đã chốt là kiểm thử bằng cách click tay qua từng luồng.

## Quy tắc không được vi phạm

1. **Credential database (token Cloudflare D1) chỉ sống trong `lib/server/`, và không gì ngoài `app/api/**` được import từ đó.** Database là **Cloudflare D1, gọi qua REST** (`lib/server/db/d1.ts`) — app chạy trên Vercel nên không dùng binding. Hàng rào là gói **`server-only`**: `lib/server/db/d1.ts` và các service đều mở đầu bằng `import 'server-only'`, nên kéo chúng vào một Client Component là **build đỏ ngay**. Đừng gỡ dòng đó ra. Mọi SQL phải **tham số hoá** (`?` + params), không nối chuỗi. Kiểm tra:
   ```bash
   grep -rn "lib/server" app components lib --include=*.ts --include=*.tsx \
     | grep -v "^app/api/" | grep -v "^lib/server/"     # phải rỗng
   ```
2. **Không dùng tiền tố `NEXT_PUBLIC_`** cho bất kỳ biến Cloudflare/Firebase nào (`CLOUDFLARE_API_TOKEN`, `ANALYTICS_TOKEN`…). Ngoại lệ có chủ ý duy nhất: `STADIA_API_KEY` (không tiền tố) được server đọc rồi giao cho trình duyệt qua `GET /api/tiles`, vì thẻ `<img>` tile bắt buộc có key trong URL — nó **không phải bí mật**, nên phải giới hạn key theo domain ở trang quản trị Stadia — tiền tố đó nhúng giá trị vào bundle trình duyệt. Quy tắc này **quan trọng hơn trước**: biến giờ nằm ở `.env.local` của chính project Next.js, tức đúng nơi tiền tố đó có hiệu lực thật, và không còn package tách biệt nào đỡ giùm.
3. **`trackEvent` trả `void`, không phải Promise.** Không bao giờ `await` trước khi điều hướng. Chi tiết ở `screen-map.md` mục 4.
4. **Không tự sinh giá trị màu/spacing/radius mới.** Mọi giá trị phải truy được về token trong `DESIGN.md` qua bảng ở `tailwind-theme.md`.
5. **Không đổi `id` trong `mock-data.md`** (`addr-home`, `banh-mi-01`, `veh-bike`…). Chúng đi thẳng vào `properties` của event; đổi id làm dữ liệu cũ và mới không ghép được.
6. **Thêm event mới phải cập nhật `event-taxonomy.md` trước khi code**, kèm `lib/shared/types.ts` (union + mảng `EVENT_NAMES`) và `lib/shared/screens.ts` nếu là màn mới.
7. **Không tự gõ `step_index` trong page.** `trackEvent` tra bảng `SCREENS` ở `lib/shared/screens.ts`. Chỉ hai ngoại lệ được truyền tay, và cả hai đã gói sẵn thành helper trong `lib/track.ts`: `trackAddToCart` (`step_index` luôn = 3) và `trackSelectFlow` (`step_index` luôn = 0, `flow` = luồng vừa chọn — `screen_name` là `home`, `address_selection` hoặc `food_menu`). Bấm tab luồng từ một màn **ngoài funnel** cũng bắn event này, khi đó `screen_name` là màn **đích** vì màn đang đứng không có tên nào để ghi — luật đầy đủ ở `selectFlowScreenFor()` trong `components/shell/flow-nav.ts`.
8. **Không thêm thư viện** ngoài những gì `techstack.md` đã chốt: Next.js, React, Tailwind, server-only (`firebase-admin` chỉ còn là devDependency của `scripts/migrate-firebase-to-d1.js`, sẽ gỡ sau cutover). (Express, cors, tsx và concurrently đã bị gỡ cùng lúc với việc gộp — nếu thấy chúng ở đâu thì đó là tàn dư.) Không Redux/Zustand (dùng Context), không axios (dùng `fetch`), không thư viện UI component, **không thư viện icon** (dùng `components/Icon.tsx`), **không thư viện bản đồ** — `MapCanvas.tsx` render tile OpenStreetMap bằng thẻ `<img>`, gọi OSRM bằng `fetch`, và tự viết cả phép chiếu Web Mercator hai chiều lẫn thao tác kéo/bấm-chọn-vị-trí, nên không cần Leaflet.
9. **Năm route ngoài funnel không được gọi `useScreenView` hay `trackEvent`:** `/history`, `/account`, `/support`, `/terms`, `/login`. Chúng cố ý không có trong `SCREENS` — `/history` chỉ ĐỌC lại event đã có, ba route kia là màn tĩnh của sidebar. Thêm event vào đó là làm bẩn mọi tỉ lệ conversion. Kiểm tra: `grep -rn "trackEvent(\|useScreenView(" app/{history,account,support,terms,login}` → phải rỗng.
10. **Bản đồ phải giữ dòng ghi công `© OpenStreetMap`.** Điều khoản dùng tile yêu cầu, không phải chi tiết thẩm mỹ. Kiểm tra: `grep -n "OpenStreetMap" components/MapCanvas.tsx`.
11. **Đăng nhập bằng số điện thoại + mã SMS 6 số chỉ bắt buộc khi bấm Đặt xe / Đặt đơn** (`api-endpoints.md` mục 5) — qua `requireLogin()` trong `lib/app-context.tsx`, hiện `LoginModal`; khách duyệt mọi trang tự do, **không có `middleware.ts`**. Có cookie `gsm_auth` thì `user_id` = số điện thoại E.164 do **server** gán ở `POST /api/events` (đừng tin `user_id` client gửi); không cookie thì chỉ nhận `anon-<id>`, và `confirm_ride`/`place_order` bị 401. `signIn` **không** reset session. Form đăng nhập không được gọi `trackEvent`. Gửi SMS chỉ qua `getSmsSender()` (`SMS_PROVIDER=mock` mặc định); nhà cung cấp thật gọi bằng `fetch`, không thêm SDK. `AUTH_SECRET` không bao giờ mang tiền tố `NEXT_PUBLIC_`.
12. **không bao giờ được commit code**

## Cấu trúc thư mục — MỘT project Next.js

```
package.json              một package duy nhất, không còn workspaces
tsconfig.json             strict, paths → @/*
next.config.ts            (trống — app gọi D1 bằng fetch, không cần serverExternalPackages)
.env.local                CLOUDFLARE_* (D1) + AUTH_SECRET + SMS_PROVIDER (+ ANALYTICS_TOKEN tuỳ chọn) (gitignored)

app/
  layout.tsx              AppProvider + font Inter (subset vietnamese)
  page.tsx                Home — màn đặt xe mặc định (screen_name `home`)
  globals.css             @theme + class typography
  ride/{address,pickup,vehicle,promo,confirm,success}/page.tsx
  ride/finding-driver/page.tsx
  food/page.tsx  (menu — 4 bộ lọc)  food/item/[itemId]/page.tsx
  food/{cart,offer,confirm,success}/page.tsx
  history/page.tsx        NGOÀI FUNNEL — lịch sử chuyến đi, chỉ đọc, không bắn event
  account/page.tsx        NGOÀI FUNNEL — Tài khoản phụ (trạng thái rỗng)
  support/page.tsx        NGOÀI FUNNEL — Trung tâm hỗ trợ (4 thẻ tĩnh)
  terms/page.tsx          NGOÀI FUNNEL — Điều khoản & Chính sách (4 thẻ tĩnh)
  login/page.tsx          NGOÀI FUNNEL — đăng nhập SĐT + mã SMS 6 số

  api/                    ← SERVER. Không dòng nào ở đây xuống trình duyệt.
    health/route.ts       GET  — không chạm D1, trả lời được khi chưa có credential
    auth/{send-code,verify,me,logout}/route.ts — đăng nhập SĐT (api-endpoints.md mục 5)
    events/route.ts       POST (ghi 1 event) + GET (đọc theo session/user/flow)
    analytics/[table]/route.ts  GET — 11 bảng dim_*/fact_* từ D1 (Power BI), phân trang keyset
    places/route.ts       GET  — tìm địa chỉ thật (Photon)
    reverse/route.ts      GET  — toạ độ → địa chỉ (Photon). 200 + `null` KHÔNG phải lỗi
    restaurants/route.ts  GET  — quán ăn thật (Overpass). maxDuration = 30
    route/route.ts        GET  — tuyến đường thật (OSRM)
    tiles/route.ts        GET  — dò nhà cung cấp tile, referer lấy từ CHÍNH request

components/               ScreenShell, Panel, PrimaryButton, BackButton, FlowGuard,
                          MapCanvas, PlacePicker, Icon, GsmLogo, Toast,
                          FoodThumb, QuantityStepper, SummaryRow, RestaurantCard,
                          EmptyState, Skeleton, InfoCardGrid, DiscountCodeInput
  shell/                  AppShell, SideRail (2 mục đầu là TAB chuyển luồng), TopBar,
                          UserMenu, CartButton, flow-nav.ts (luật đổi luồng dùng chung)

lib/
  session.ts              session_id / user_id / resetSession
  track.ts                trackEvent + trackAddToCart + trackSelectFlow + useScreenView
  app-context.tsx         state ride + cart + food (origin, quán đã chọn)
  use-place-search.ts     hook gọi GET /api/places (debounce 400ms + abort)
  use-restaurants.ts      hook gọi GET /api/restaurants — quán gần + tìm theo tên
  use-current-place.ts    hook GPS, lùi về DEFAULT_PICKUP khi bị từ chối
  use-tile-providers.ts   hook gọi GET /api/tiles — lọc nhà cung cấp tile đã hỏng
  reverse-place.ts        toạ độ → Place có tên, qua GET /api/reverse
  use-route.ts            hook gọi GET /api/route → {route, status, retry}; CHỈ tuyến OSRM thật (không đường lùi)
  use-vehicle-simulation.ts  xe chạy dọc tuyến thật (nội suy theo độ dài), dùng cho đặt xe và giao đồ ăn
  format.ts               formatVnd

  shared/                 DÙNG CHUNG client + server. KHÔNG import gì từ lib/server.
    types.ts              Flow, EventName, ScreenName, EventPayload
    screens.ts            SCREENS — bảng route/step_index/flow
    mock-data.ts          dữ liệu tĩnh
    food.ts               normalizeVi, mealOfHour, menuOf — logic tìm món
    places.ts             Place, PlaceSource, DEFAULT_PICKUP, PRESET_PLACES
    route.ts              RouteResult, haversineKm, isRoadRoute, pointAlong/bearingDeg (hình học tuyến)
    tiles.ts              TILE_PROVIDERS + PROBE_TILE
    phone.ts              normalizeVnPhone, formatVnPhone, AUTH_COOKIE, OTP_COOKIE
    pricing.ts            calcFare (giá theo km), calcDiscount, calcRideTotals,
                          calcFoodTotals

  server/                 CHỈ app/api/** được import. Mọi file mở đầu `import 'server-only'`.
    db/d1.ts              token Cloudflare D1 (REST) — nơi DUY NHẤT; SQL luôn tham số hoá
    validators/           event.validator.ts  ← whitelist 8 field
                          place.validator.ts, route.validator.ts, auth.validator.ts, analytics.validator.ts
    services/             event.service.ts    ← INSERT/SELECT bảng events; platform + created_at do server gán
                          photon.service.ts   ← Photon (địa chỉ + reverse)
                          overpass.service.ts ← Overpass (quán ăn thật)
                          route.service.ts    ← OSRM (tuyến đường)
                          tiles.service.ts    ← dò tile, phát hiện watermark API key
                          upstream.ts         ← hàng đợi + cache dùng chung
                          otp.service.ts      ← mã 6 số — cookie gsm_otp ký HMAC, KHÔNG database
                          user.service.ts     ← upsert bảng users (khoá = SĐT), best effort
                          analytics.service.ts ← 11 bảng dim_*/fact_* (danh sách trắng, phân trang keyset)
                          read-auth.ts        ← ANALYTICS_TOKEN tuỳ chọn cho các route đọc
                          auth-token.ts       ← cookie gsm_auth ký HMAC
                          sms.service.ts      ← SmsSender, mock / nhà cung cấp thật

public/                   ảnh món ăn + CREDITS.md
sample_ui/                7 ảnh chụp web Green SM thật — tham chiếu khi dựng UI
                          (dieu_khoan_va_chinh_sach.png là trang MARKETING, không
                          phải màn trong app — chỉ lấy nội dung, bỏ vỏ)
analysis/                 Python — đọc THẲNG D1 qua REST (urllib), không gọi qua app
scripts/                  chạy tay, không phải code của app: seed-events.js, test-d1.js, cutover-check.js,
                          smoke-production.js, migrate-firebase-to-d1.js (nạp CSV + chép Firestore → D1),
                          lib/ (d1-rest.js, mock-subset.js), e2e/ (kịch bản Firefox)
migrations/               *.sql — schema D1 (wrangler d1 migrations apply gsm-db). wrangler.jsonc chỉ cho lệnh này
docs/                     d1-schema-design, cutover-runbook, migration-verification, firebase-audit, POWERBI_D1
```

Vì cả giao diện lẫn route handler đều nhập `EventName` và `SCREENS` từ `lib/shared`, danh sách hợp lệ ở hai phía **không thể lệch nhau**.

**Ba thư mục con của `lib/` có ba luật khác nhau** — đây là thứ dễ nhầm nhất sau khi gộp:

| | Ai được import | Chạy ở đâu |
|---|---|---|
| `lib/*.ts` (track, session, hook…) | client | trình duyệt |
| `lib/shared/` | **cả hai** | cả hai |
| `lib/server/` | **chỉ `app/api/**`** | chỉ server |

## Quy ước code

- TypeScript, không dùng `any` cho dữ liệu event — union type trong `lib/shared/types.ts` tồn tại để bắt lỗi gõ sai tên event.
- Mọi page của 2 luồng là `'use client'`. Logic server **chỉ** nằm trong `app/api/**` và `lib/server/` — không có server-side logic nào lẫn vào page.
- **Import tương đối không bao giờ ghi đuôi `.js`.** Webpack của Next không resolve `.ts` từ đuôi `.js`, và lỗi này **chỉ hiện ở `npm run build`, không hiện ở `npm run dev`**. (Code trong `lib/server/` từng chạy bằng `tsx` nên ghi đuôi `.js`; toàn bộ đã được gỡ khi gộp. Đừng thêm lại.)
- **UI toàn bộ bằng tiếng Việt** ("Đặt xe", "Thêm vào giỏ", "Xác nhận"). Tên biến, tên hàm, tên field bằng tiếng Anh.
- Field trong event và khoá trong `properties`: `snake_case`. Biến trong TypeScript: `camelCase`. Helper `trackEvent` chịu trách nhiệm chuyển đổi.
- Tiền luôn là **số nguyên VNĐ** trong dữ liệu (`35000`), chỉ format khi hiển thị (`35.000đ`) bằng `Intl.NumberFormat('vi-VN')`.
- **Desktop-first** — khung tham chiếu là web Green SM trên máy tính (ảnh mẫu ở `sample_ui/`). `AppShell` = rail icon trái + top bar; `ScreenShell` chọn bố cục `split` (panel 480px + bản đồ) hoặc `wide` (một cột canh giữa). Chi tiết ở `screen-map.md` mục 6.
- Không dùng emoji trong UI — dùng `components/Icon.tsx` (SVG viết tay, ăn `currentColor`).

## Các cái bẫy đã biết

- **React Strict Mode nhân đôi `screen_view`.** `next dev` chạy effect hai lần; không chặn bằng `useRef` thì mọi số liệu funnel sai gấp đôi. Xem `screen-map.md` mục 4.
- **Hạn mức ghi D1 Free = 100.000 dòng/ngày, và mỗi index tính thêm 1 lượt ghi/dòng** (một event = 4). Hết hạn mức thì D1 từ chối cả ghi lẫn đọc. Đừng nạp dữ liệu lớn (`migrate-firebase-to-d1.js --all-rows`, `seed-events.js`) lúc có người dùng. Xem `docs/d1-schema-design.md` mục 8.
- **Chạy `npm run build` khi `npm run dev` đang chạy làm dev hỏng** (`.next` bị ghi đè → toàn bộ 500). Dừng dev, `rm -rf .next` rồi chạy lại.
- **Đuôi `.js` trong import tương đối làm hỏng `npm run build` — nhưng `npm run dev` vẫn chạy ngon.** Đây là cái bẫy thay thế cho cái bẫy "gọi thẳng cổng 4000" của bản hai process. Luôn chạy `npm run build` trước khi tin là xong. Cùng loại với nó: `firebase-admin` phải nằm trong `serverExternalPackages` ở `next.config.ts`, thiếu thì webpack cố bundle và build hỏng.

## Kiểm tra sau mỗi thay đổi liên quan tới tracking

Đi hết một luồng, rồi:
```bash
curl "localhost:3000/api/events?session_id=<id>" | jq '.[] | {event_name, screen_name, step_index}'
```
Số `screen_view` phải **đúng bằng** số màn đã đi qua, và `step_index` phải khớp bảng trong `event-taxonomy.md`.
