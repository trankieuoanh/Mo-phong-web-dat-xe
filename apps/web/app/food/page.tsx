'use client';

/**
 * screen_name: `food_menu` — step 1
 * Event: screen_view, search_item, filter_category, select_meal,
 *        select_restaurant, select_item, add_to_cart (them nhanh), back.
 *
 * Luu y `add_to_cart` mang step_index = 3 DU BAN O DAY — no la hanh dong,
 * khong phai man hinh. Dung helper trackAddToCart de khong go nham.
 *
 * BON CACH TIM MON, LOAI TRU NHAU. Tat ca deu song tren chinh man nay chu khong
 * phai mot route rieng: them mot man la danh so lai toan bo `step_index` cua
 * luong food va lam du lieu cu khong ghep duoc voi du lieu moi.
 *
 * Moi bo loc deu BAN EVENT, ke ca chip loai mon (truoc day im lang). Mot nut bam
 * duoc ma khong ghi lai la mot khoang mu; va neu ba bo loc moi co so lieu con
 * chip cu thi khong, ta khong so sanh duoc cach nao hieu qua hon — dung cau hoi
 * ma `discovery_source` sinh ra de tra loi (event-taxonomy.md muc 4).
 */

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_PICKUP,
  FOOD_CATEGORIES,
  FOOD_ITEMS,
  MEALS,
  MEAL_LABELS,
  calcFoodTotals,
  getFoodItem,
  haversineKm,
  mealOfHour,
  menuOf,
  normalizeVi,
  roundKm,
  type DiscoverySource,
  type FoodCategory,
  type FoodItem,
  type Meal,
  type Place,
} from '@gsm/shared';
import { BackButton } from '@/components/BackButton';
import { Icon } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenShell } from '@/components/ScreenShell';
import { useApp } from '@/lib/app-context';
import { formatVnd } from '@/lib/format';
import { useRestaurants } from '@/lib/use-restaurants';
import { trackAddToCart, trackEvent, useScreenView } from '@/lib/track';

/**
 * Bon bo loc gom vao MOT state thay vi bon state roi rac — nho vay khong bao gio
 * co hai bo loc cung bat va choi nhau, va `discovery_source` chi la mot phep doc
 * truong `kind`.
 */
type Filter =
  | { kind: 'all' }
  | { kind: 'category'; category: FoodCategory }
  | { kind: 'search'; query: string }
  | { kind: 'restaurant'; place: Place }
  | { kind: 'meal'; meal: Meal };

/** Duoi nguong nay thi chua dang ghi lai mot luot tim. */
const MIN_SEARCH_LENGTH = 2;

/** Doi nguoi dung ngung go roi moi ban MOT `search_item`, thay vi mot event/phim. */
const SEARCH_EVENT_DELAY_MS = 600;

function matchesQuery(item: FoodItem, query: string): boolean {
  const needle = normalizeVi(query);
  if (!needle) return true;
  // Tim ca theo ten quan goc: go "phuc long" ra tra sua la ky vong hop ly.
  return (
    normalizeVi(item.name).includes(needle) || normalizeVi(item.restaurant).includes(needle)
  );
}

/**
 * Danh sach mon ung voi mot bo loc. Tach thanh ham RIENG de cho hien thi va cho
 * `result_count` trong event dung CHUNG mot phep tinh — hai cho tu tinh la con
 * so trong event khong khop con so tren man hinh.
 */
function itemsFor(filter: Filter): FoodItem[] {
  switch (filter.kind) {
    case 'category':
      return FOOD_ITEMS.filter((i) => i.category === filter.category);
    case 'search':
      return FOOD_ITEMS.filter((i) => matchesQuery(i, filter.query));
    case 'restaurant':
      return menuOf(filter.place.id);
    case 'meal':
      return FOOD_ITEMS.filter((i) => i.meals.includes(filter.meal));
    default:
      return FOOD_ITEMS;
  }
}

function sourceOf(filter: Filter): DiscoverySource {
  return filter.kind;
}

export default function FoodMenuPage() {
  useScreenView('food_menu');
  const router = useRouter();
  const { cart, addToCart } = useApp();

  const [filter, setFilter] = useState<Filter>({ kind: 'all' });
  const [query, setQuery] = useState('');

  /**
   * Bua doan theo gio hien tai. Doc gio trong useEffect, KHONG luc render:
   * Next van prerender client component o server, ma gio server (UTC) lech gio
   * may (UTC+7) — day dung la bay hydration mismatch ghi o dau lib/session.ts.
   * Luot render dau chua co bua nao sang, dung y.
   */
  const [defaultMeal, setDefaultMeal] = useState<Meal | null>(null);
  useEffect(() => setDefaultMeal(mealOfHour(new Date().getHours())), []);

  const { restaurants, status: restaurantStatus } = useRestaurants(DEFAULT_PICKUP);

  const items = itemsFor(filter);
  const totals = calcFoodTotals(cart, null, getFoodItem);

  /**
   * `search_item` bat sau khi ngung go. Debounce o day de GOP EVENT, khong phai
   * de giam tai mang — viec loc chay hoan toan o client tren 8 mon co san.
   *
   * `lastSearchRef` chan ban trung: Strict Mode cua `next dev` chay effect hai
   * lan, va go roi xoa roi go lai dung tu cu cung khong dang mot event moi.
   */
  const lastSearchRef = useRef('');
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_SEARCH_LENGTH || trimmed === lastSearchRef.current) return;

    const timer = setTimeout(() => {
      lastSearchRef.current = trimmed;
      trackEvent({
        eventName: 'search_item',
        screenName: 'food_menu',
        properties: {
          query: trimmed,
          // `result_count === 0` la con so dang gia nhat cua event nay: nguoi
          // dung tim mot mon ma thuc don khong co.
          result_count: itemsFor({ kind: 'search', query: trimmed }).length,
        },
      });
    }, SEARCH_EVENT_DELAY_MS);

    return () => clearTimeout(timer);
  }, [query]);

  function changeQuery(value: string) {
    setQuery(value);
    // O tim trong = quay ve xem tat ca, khong phai "tim chuoi rong".
    setFilter(value.trim() ? { kind: 'search', query: value } : { kind: 'all' });
  }

  function chooseCategory(category: FoodCategory | 'all') {
    setQuery('');
    setFilter(category === 'all' ? { kind: 'all' } : { kind: 'category', category });
    trackEvent({
      eventName: 'filter_category',
      screenName: 'food_menu',
      properties: { category },
    });
  }

  function chooseMeal(meal: Meal) {
    setQuery('');
    setFilter({ kind: 'meal', meal });
    trackEvent({
      eventName: 'select_meal',
      screenName: 'food_menu',
      properties: {
        meal,
        // Tach "he thong doan dung" khoi "nguoi dung phai tu sua".
        is_default: meal === defaultMeal,
      },
    });
  }

  function chooseRestaurant(place: Place) {
    setQuery('');
    setFilter({ kind: 'restaurant', place });
    trackEvent({
      eventName: 'select_restaurant',
      screenName: 'food_menu',
      properties: {
        restaurant_id: place.id,
        restaurant_name: place.label,
        distance_km: roundKm(haversineKm(DEFAULT_PICKUP, place)),
        item_count: menuOf(place.id).length,
      },
    });
  }

  function selectItem(item: FoodItem) {
    trackEvent({
      eventName: 'select_item',
      screenName: 'food_menu',
      properties: {
        item_id: item.id,
        item_name: item.name,
        price: item.price,
        discovery_source: sourceOf(filter),
      },
    });
    router.push(`/food/item/${item.id}`);
  }

  function quickAdd(item: FoodItem) {
    // Phai copy CA DONG, khong chi copy mang: [...cart] van giu nguyen tham chieu
    // toi object CartLine dang nam trong state, mutate no se lam addToCart ben duoi
    // cong them mot lan nua (so luong tang 2 thay vi 1).
    const nextCart = cart.some((l) => l.itemId === item.id)
      ? cart.map((l) => (l.itemId === item.id ? { ...l, quantity: l.quantity + 1 } : l))
      : [...cart, { itemId: item.id, quantity: 1 }];
    const after = calcFoodTotals(nextCart, null, getFoodItem);

    trackAddToCart('food_menu', {
      item_id: item.id,
      item_name: item.name,
      price: item.price,
      quantity: 1,
      cart_size_after: after.itemCount,
      cart_total_after: after.cartTotal,
      discovery_source: sourceOf(filter),
    });
    addToCart(item.id, 1);
  }

  const pickedRestaurant = filter.kind === 'restaurant' ? filter.place : null;

  return (
    <ScreenShell
      variant="wide"
      section="Đặt đồ ăn"
      tabs={['Đặt món', 'Đang diễn ra', 'Đơn đã lưu']}
      title="Đặt đồ ăn"
      leading={<BackButton from="food_menu" to="home" href="/" />}
      footer={
        totals.itemCount > 0 ? (
          <PrimaryButton onClick={() => router.push('/food/cart')}>
            Xem giỏ hàng ({totals.itemCount}) · {formatVnd(totals.cartTotal)}
          </PrimaryButton>
        ) : undefined
      }
    >
      {/* Ô tìm — cùng thủ pháp với PlacePicker (text-input, tailwind-theme.md mục 4). */}
      <div className="flex items-center gap-md rounded-md bg-canvas-soft p-lg">
        <Icon name="search" size={20} className="text-body" />
        <input
          type="text"
          value={query}
          onChange={(e) => changeQuery(e.target.value)}
          placeholder="Tìm món hoặc quán"
          aria-label="Tìm món ăn"
          className="t-body-md min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-mute"
        />
        {query ? (
          <button
            type="button"
            aria-label="Xoá ô tìm"
            onClick={() => changeQuery('')}
            className="grid size-6 shrink-0 place-items-center rounded-full bg-canvas text-body hover:bg-surface-pressed"
          >
            <Icon name="close" size={14} />
          </button>
        ) : null}
      </div>

      {/* Gợi ý theo bữa. Chip khớp giờ hiện tại có thêm dòng "gợi ý cho bạn". */}
      <div className="mt-lg flex flex-wrap items-center gap-sm">
        <span className="t-body-sm mr-xxs text-body">Gợi ý bữa</span>
        {MEALS.map((meal) => (
          <Chip
            key={meal}
            active={filter.kind === 'meal' && filter.meal === meal}
            onClick={() => chooseMeal(meal)}
          >
            {MEAL_LABELS[meal]}
            {meal === defaultMeal ? (
              <span className="t-caption ml-xxs text-primary-dark">· bây giờ</span>
            ) : null}
          </Chip>
        ))}
      </div>

      {/* Nhà hàng thật quanh điểm đón, sắp theo khoảng cách tăng dần.
          Hạ tầng lỗi thì ẩn hẳn dải này — ba cách tìm món còn lại vẫn dùng được. */}
      {restaurantStatus === 'ready' && restaurants.length > 0 ? (
        <div className="mt-lg">
          <p className="t-body-sm mb-sm text-body">Gần bạn</p>
          <div className="flex gap-sm overflow-x-auto pb-xxs">
            {restaurants.map((place) => (
              <button
                key={place.id}
                type="button"
                onClick={() => chooseRestaurant(place)}
                className={`flex shrink-0 items-center gap-sm rounded-pill bg-canvas-soft px-lg py-sm text-left text-ink transition-colors hover:bg-surface-pressed ${
                  pickedRestaurant?.id === place.id ? 'ring-2 ring-primary' : ''
                }`}
              >
                <Icon name="bag" size={16} className="text-primary-dark" />
                <span className="t-body-sm-strong">{place.label}</span>
                <span className="t-caption text-mute">
                  {roundKm(haversineKm(DEFAULT_PICKUP, place))} km
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* category-button — tailwind-theme.md muc 4 */}
      <div className="mb-lg mt-lg flex gap-sm overflow-x-auto pb-xxs">
        <Chip active={filter.kind === 'all'} onClick={() => chooseCategory('all')}>
          Tất cả
        </Chip>
        {FOOD_CATEGORIES.map((c) => (
          <Chip
            key={c.id}
            active={filter.kind === 'category' && filter.category === c.id}
            onClick={() => chooseCategory(c.id)}
          >
            {c.label}
          </Chip>
        ))}
      </div>

      {pickedRestaurant ? (
        <p className="t-body-sm mb-lg text-body">
          Món tại <span className="t-body-sm-strong text-ink">{pickedRestaurant.label}</span>
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="t-body-sm py-3xl text-center text-body">
          Không tìm thấy món phù hợp
        </p>
      ) : (
        /* Luoi nhieu cot — tan dung chieu rong cua web desktop.
           Ban mobile cu la mot cot doc (screen-map.md muc 6). */
        <ul className="grid gap-md sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col overflow-hidden rounded-xl bg-canvas-soft transition-colors hover:bg-surface-pressed"
            >
              <button
                type="button"
                onClick={() => selectItem(item)}
                className="flex flex-1 flex-col p-lg text-left"
              >
                {/* Khung anh 4:3 voi ky tu dau ten mon — khong dung anh that
                    (mock-data.md muc 4, tailwind-theme.md muc 7). */}
                <span className="grid aspect-[4/3] w-full place-items-center rounded-xl bg-canvas">
                  <span className="t-display-lg text-primary-dark">{item.name.charAt(0)}</span>
                </span>

                <span className="t-body-md-strong mt-lg block">{item.name}</span>
                {/* Dang loc theo quan thi hien ten quan DANG CHON — neu khong,
                    bam "Pho Thai Tu" roi thay the ghi "Phuc Long" la mau thuan
                    ngay tren man hinh. */}
                <span className="t-body-sm mt-xxs block text-body">
                  {pickedRestaurant?.label ?? item.restaurant}
                </span>
              </button>

              <div className="flex items-center justify-between gap-md px-lg pb-lg">
                <span className="t-body-md-strong">{formatVnd(item.price)}</span>
                <button
                  type="button"
                  aria-label={`Thêm ${item.name} vào giỏ`}
                  onClick={() => quickAdd(item)}
                  className="grid size-11 shrink-0 place-items-center rounded-full bg-canvas text-primary-dark transition-colors hover:bg-primary-dark hover:text-on-primary"
                >
                  <Icon name="plus" size={20} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </ScreenShell>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`t-body-sm-strong shrink-0 rounded-pill bg-canvas-soft px-lg py-sm text-ink transition-colors hover:bg-surface-pressed ${
        active ? 'ring-2 ring-primary' : ''
      }`}
    >
      {children}
    </button>
  );
}
