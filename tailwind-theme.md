# tailwind-theme.md — GSM ride-booking simulation

Cầu nối giữa khối token trong `DESIGN.md` và class Tailwind dùng khi code. **Không được tự sinh giá trị màu/spacing/radius mới** — mọi giá trị phải truy được về token.

## 0. Ba mâu thuẫn trong file token — đã chốt cách xử lý

Khối YAML và phần văn xuôi trong `DESIGN.md` lệch nhau ở 3 chỗ. Quy tắc chung: **khối YAML là nguồn sự thật** (nó là phần máy đọc được, phần văn xuôi là mô tả).

| Chỗ lệch | YAML | Văn xuôi | Chốt |
|---|---|---|---|
| `colors.canvas-soft` | `#eafafa` | `#efefef` | **`#eafafa`** — xám ám cyan hợp với tinh thần "dịu mắt, một tông" hơn xám trung tính |
| `colors.canvas-softer` | `#f2fcfc` | `#f3f3f3` | **`#f2fcfc`** — cùng lý do |
| `components.text-input.rounded` | `{rounded.none}` | `{rounded.md}` 8px | **8px** — ô nhập vuông góc 0px lạc lõng giữa hệ pill; phần văn xuôi mô tả đúng ý đồ |

## 0b. Cảnh báo tương phản — cần quyết định khi build

`primary #00B4B8` + chữ trắng cho tỉ lệ tương phản khoảng **2.6:1**, dưới ngưỡng WCAG AA (4.5:1 cho chữ thường). Ba lựa chọn:

1. **Dùng `primary-dark #048589` làm nền nút** (~4.2:1) — gần đạt AA, giữ đúng họ màu. ← khuyến nghị
2. Giữ `#00B4B8` với chữ **`ink`** đen (~8:1) — đạt AAA nhưng lệch nhận diện Green SM.
3. Giữ nguyên trắng trên `#00B4B8` — đúng thương hiệu nhất, chấp nhận không đạt AA.

Mặc định khi build: **lựa chọn 1**. Nếu mentor ưu tiên bám sát nhận diện thì đổi sang 3 và ghi chú trong báo cáo.

---

## 1. Khai báo theme (Tailwind v4)

Dự án dùng Tailwind v4 — cấu hình bằng `@theme` trong CSS, **không** còn `tailwind.config.ts`. Chỉ có `apps/web/postcss.config.mjs` khai báo plugin `@tailwindcss/postcss`.

```css
/* apps/web/app/globals.css */
@import "tailwindcss";

@theme {
  /* ── colors ── */
  --color-primary:          #00B4B8;
  --color-primary-dark:     #048589;
  --color-on-primary:       #ffffff;
  --color-ink:              #000000;
  --color-body:             #5e5e5e;
  --color-mute:             #afafaf;
  --color-hairline-mid:     #4b4b4b;
  --color-canvas:           #ffffff;
  --color-canvas-soft:      #eafafa;
  --color-canvas-softer:    #f2fcfc;
  --color-surface-pressed:  #cdeeee;
  --color-link:             #0000ee;
  --color-on-dark:          #ffffff;

  /* ── radius ── */
  --radius-md:       8px;
  --radius-lg:      12px;
  --radius-xl:      16px;
  --radius-pill:   999px;
  --radius-pill-tab: 36px;

  /* ── spacing (ghi đè thang mặc định bằng thang token) ── */
  --spacing-xxs:  4px;
  --spacing-xs:   6px;
  --spacing-sm:   8px;
  --spacing-md:  12px;
  --spacing-lg:  16px;
  --spacing-xl:  20px;
  --spacing-2xl: 24px;
  --spacing-3xl: 32px;

  /* ── fonts ── */
  --font-display: var(--font-inter), system-ui, "Helvetica Neue", Arial, sans-serif;
  --font-text:    var(--font-inter), system-ui, "Helvetica Neue", Arial, sans-serif;
}
```

Thang spacing token (`xxs…3xl`) **bổ sung** chứ không thay thế thang số của Tailwind. Dùng `p-lg`, `gap-md` khi giá trị có trong token; các con số khác chỉ dùng khi không có token tương ứng.

## 2. Font

Hai face gốc `UberMove` / `UberMoveText` là font độc quyền, không dùng được. `DESIGN.md` đã chỉ định bản thay thế: **Inter** — weight 700 cho display, 400/500 cho text.

```ts
// apps/web/app/layout.tsx
import { Inter } from 'next/font/google';
const inter = Inter({ subsets: ['latin', 'vietnamese'], variable: '--font-inter' });
```

Bắt buộc có subset `vietnamese` — thiếu nó thì "Bánh mì", "Đặt xe" sẽ rơi về font hệ thống và lệch hẳn khỏi phần còn lại.

## 3. Bảng typography

Tailwind v4 không sinh sẵn class cho typography token, nên khai báo thành component class:

```css
/* apps/web/app/globals.css, sau @theme */
@layer components {
  .t-display-xxl    { font: 700 52px/64px var(--font-display); }
  .t-display-xl     { font: 700 36px/44px var(--font-display); }
  .t-display-lg     { font: 700 32px/40px var(--font-display); }
  .t-display-md     { font: 700 24px/32px var(--font-display); }
  .t-display-sm     { font: 700 20px/28px var(--font-display); }
  .t-body-lg        { font: 500 18px/24px var(--font-text); }
  .t-body-md        { font: 400 16px/24px var(--font-text); }
  .t-body-md-strong { font: 500 16px/20px var(--font-text); }
  .t-body-sm        { font: 400 14px/20px var(--font-text); }
  .t-body-sm-strong { font: 500 14px/16px var(--font-text); }
  .t-caption        { font: 400 12px/20px var(--font-text); }
  .t-button-large   { font: 500 18px/24px var(--font-text); }
  .t-button-md      { font: 500 16px/20px var(--font-text); }
}
```

**Không letter-spacing.** `DESIGN.md` nêu rõ hệ chữ không bao giờ giãn/siết chữ.

### Cỡ chữ dùng ở đâu trong app này
| Vai trò trong app | Class |
|---|---|
| Tiêu đề màn hình ("Bạn muốn đón ở đâu?") | `.t-display-md` (24px) |
| Nhãn 2 nút lớn ở Home | `.t-display-sm` (20px) |
| Tên địa chỉ / tên món / tên khuyến mãi | `.t-body-md-strong` |
| Địa chỉ đầy đủ, mô tả món, điều kiện khuyến mãi | `.t-body-sm` + màu `body` |
| Giá tiền trong dòng | `.t-body-md-strong` |
| Tổng tiền cuối ở màn xác nhận | `.t-display-sm` |
| Nhãn nút hành động chính | `.t-button-md` |
| Ghi chú mờ, phí giao hàng | `.t-caption` + màu `mute` |

`display-xxl` 52px và `display-xl` 36px thuộc về landing marketing của Green SM — **không dùng** trong luồng đặt xe khổ điện thoại.

## 4. Component → class Tailwind

| Token component | Dùng cho màn nào | Class |
|---|---|---|
| `button-primary` | Nút hành động chính mỗi bước | `bg-primary-dark text-on-primary t-button-md rounded-pill px-2xl py-md` |
| `button-secondary` | Nút phụ ("Đổi địa chỉ") | `bg-canvas text-ink t-button-md rounded-pill px-2xl py-md border border-surface-pressed` |
| `button-subtle` | "Bỏ qua khuyến mãi" | `bg-canvas-soft text-ink t-button-md rounded-pill px-lg py-md` |
| `card-content` | Card tóm tắt ở màn xác nhận | `bg-canvas text-ink rounded-xl p-2xl` |
| `card-soft-tinted` | Card lựa chọn **đang được chọn** | `bg-canvas-soft text-ink rounded-xl p-2xl` |
| `request-form-input-row` | Dòng địa chỉ / loại xe / khuyến mãi trong danh sách | `bg-canvas-soft text-ink rounded-md p-lg` |
| `category-button` | Chip lọc món (`main`/`drink`/`dessert`) | `bg-canvas-soft text-ink t-body-sm-strong rounded-pill px-lg py-sm` |
| `icon-button-circular` | Nút Back ở góc, nút +/− số lượng | `bg-canvas-soft text-ink rounded-full` |
| `nav-bar` | Thanh tiêu đề mỗi màn | `bg-canvas text-ink t-body-md-strong px-3xl py-lg` |

**Trạng thái được chọn** (địa chỉ/xe/khuyến mãi đang chọn): thêm `ring-2 ring-primary` lên card, **không** đổi nền sang cyan đặc — `DESIGN.md` giữ cyan riêng cho nút chuyển đổi, mỗi khung nhìn chỉ nên có một điểm cyan đặc.

**Trạng thái bấm xuống**: `active:bg-surface-pressed`.

**Bị disable** (khuyến mãi chưa đủ điều kiện): `opacity-50 cursor-not-allowed`, kèm dòng lý do bằng `.t-caption text-mute`.

## 5. Đổ bóng

`DESIGN.md` quy định mặc định là **phẳng, không bóng**. Trong dự án này chỉ dùng đúng một mức:

```css
.shadow-level-2 { box-shadow: rgba(0,0,0,0.16) 0px 4px 16px 0px; }
```
Chỉ áp cho **thanh nút hành động dính đáy màn hình** — để tách nó khỏi nội dung cuộn phía sau. Card trong danh sách giữ phẳng.

## 6. Hình dạng

- Mọi phần tử tương tác: `rounded-pill` (999px) — chữ ký hình học của thương hiệu.
- Card và ô nhập: `rounded-xl` (16px), ô nhập nhỏ `rounded-md` (8px).
- Ngoại lệ duy nhất: `button-large-rounded` dùng `rounded-xl` — chỉ dùng cho nút xác nhận cuối luồng nếu muốn nút to hơn bình thường.
- **Không** dùng `rounded-full` cho card vuông; chỉ cho nút tròn chứa icon.

## 7. Khung ảnh món ăn

`mock-data.md` quy định không dùng ảnh thật. Khung giữ đúng tỉ lệ 4:3 mà `DESIGN.md` yêu cầu:

```html
<div class="aspect-[4/3] bg-canvas-soft rounded-xl grid place-items-center">
  <span class="t-display-md text-primary-dark">B</span>
</div>
```
