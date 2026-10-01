'use client';

/**
 * screen_name: `food_menu` — step 1
 * Event: screen_view, search_item, filter_category, select_meal,
 *        select_restaurant, select_item, add_to_cart (them nhanh),
 *        change_address, back.
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
 *
 * VIEC DOI DIA CHI GIAO KHONG PHAI MOT MAN HINH: no hoan doi than panel ngay tai
 * day (Pattern J cua /ride/pickup), vi cung ly do tren.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  FOOD_CATEGORIES,
  FOOD_ITEMS,
  MEALS,
  MEAL_LABELS,
  calcFoodTotals,
  getFoodItem,
  CUISINE_LABELS,
  cuisinesOf,
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
  type Restaurant,
} from '@/lib/shared';
import { BackButton } from '@/components/BackButton';
import { EmptyState } from '@/components/EmptyState';
import { FoodThumb } from '@/components/FoodThumb';
import { Icon } from '@/components/Icon';
import { PlacePicker } from '@/components/PlacePicker';
import { PrimaryButton } from '@/components/PrimaryButton';
import { RestaurantCard } from '@/components/RestaurantCard';
import { ScreenShell } from '@/components/ScreenShell';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { useApp } from '@/lib/app-context';
import { formatVnd } from '@/lib/format';
import { useCurrentPlace } from '@/lib/use-current-place';
import { useRestaurants } from '@/lib/use-restaurants';
import { trackAddToCart, trackEvent, useFlowEntryView } from '@/lib/track';

/**
 * Bon bo loc gom vao MOT state thay vi bon state roi rac — nho vay khong bao gio
 * co hai bo loc cung bat va choi nhau, va `discovery_source` chi la mot phep doc
 * truong `kind`.
 */
type Filter =
  | { kind: 'all' }
  | { kind: 'category'; category: FoodCategory }
  | { kind: 'search'; query: string }
  | { kind: 'restaurant'; place: Restaurant }
  | { kind: 'meal'; meal: Meal };

/** Duoi nguong nay thi chua dang ghi lai mot luot tim. */
const MIN_SEARCH_LENGTH = 2;

/** Doi nguoi dung ngung go roi moi ban MOT `search_item`, thay vi mot event/phim. */
const SEARCH_EVENT_DELAY_MS = 600;

/**
 * So mon hien khi da chon mot quan. Mac dinh cua menuOf la 3, va luoi tut tu
 * 29 the xuong 3 the trong nhu mot loi tai du lieu chu khong nhu mot thuc don.
 */
const MENU_SIZE = 6;

function matchesQuery(item: FoodItem, query: string): boolean {
  const needle = normalizeVi(query);
  if (!needle) return true;
  // Tim ca theo kieu bep: go "mon nhat" ra sushi/ramen. Mon KHONG con truong
  // `restaurant` — ten quan gio den tu OpenStreetMap chu khong tu mock-data.
  return (
    normalizeVi(item.name).includes(needle) ||
    normalizeVi(CUISINE_LABELS[item.cuisine]).includes(needle)
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
      return menuOf(filter.place, MENU_SIZE);
    case 'meal':
      return FOOD_ITEMS.filter((i) => i.meals.includes(filter.meal));
    default:
      return FOOD_ITEMS;
  }
}

/**
 * Nhan kieu bep de hien thi, suy tu tag `cuisine` THAT cua quan.
 * Tra `undefined` khi quan khong khai bao hoac khai bao gia tri ta khong nhan
 * ra — khi do dong phu chi con khoang cach.
 */
function cuisineLabelOf(place: Restaurant): string | undefined {
  const kinds = cuisinesOf(place.cuisine);
  return kinds.length ? kinds.map((k) => CUISINE_LABELS[k]).join(', ') : undefined;
}

function sourceOf(filter: Filter): DiscoverySource {
  return filter.kind;
}

export default function FoodMenuPage() {
  useFlowEntryView('food_menu');
  const router = useRouter();
  const { cart, addToCart, food, setFood } = useApp();
  const toast = useToast();

  const [filter, setFilter] = useState<Filter>({ kind: 'all' });
  const [query, setQuery] = useState('');
  /** Pattern J: true thi than panel doi sang PlacePicker, khong doi route. */
  const [pickingOrigin, setPickingOrigin] = useState(false);

  /**
   * Bua doan theo gio hien tai. Doc gio trong useEffect, KHONG luc render:
   * Next van prerender client component o server, ma gio server (UTC) lech gio
   * may (UTC+7) — day dung la bay hydration mismatch ghi o dau lib/session.ts.
   * Luot render dau chua co bua nao sang, dung y.
   */
  const [defaultMeal, setDefaultMeal] = useState<Meal | null>(null);
  useEffect(() => setDefaultMeal(mealOfHour(new Date().getHours())), []);

  /**
   * Dia chi giao: uu tien cai nguoi dung da tu chon, roi moi den GPS.
   * `useCurrentPlace` luon tra ve mot Place (lui ve DEFAULT_PICKUP khi bi tu
   * choi), nen `origin` khong bao gio undefined.
   */
  const current = useCurrentPlace();
  const origin = food.origin ?? current.place;

  /**
   * Ghi vi tri GPS vao context ngay khi co.
   *
   * Thieu doan nay la mot BUG THAT da tung lam man xac nhan noi doi: `origin` o
   * day lui ve `current.place`, nhung `food.origin` van rong, nen man
   * `food_confirm` (chi doc context) hien dia chi mac dinh hardcode va ghim ban
   * do sai cho — trong khi man menu hien dung vi tri nguoi dung. Hai man noi hai
   * dia chi khac nhau cho cung mot don.
   *
   * Chi ghi khi nguoi dung CHUA tu chon: lua chon tay luon thang GPS.
   */
  useEffect(() => {
    if (food.origin) return;
    if (current.status !== 'ready') return;
    setFood({ origin: current.place });
  }, [food.origin, current.status, current.place, setFood]);

  /**
   * MOT hook, hai vai tro: o tim trong thi la dai "Gan ban", co tu khoa thi la
   * ket qua tim quan theo ten. Gop lai duoc vi ca hai deu la "quan quanh
   * `origin`, sap theo khoang cach" — tach doi se thanh hai hang doi cung ban
   * ra Nominatim, ma OSM gioi han 1 request/giay cho CA ung dung.
   */
  const {
    restaurants,
    status: restaurantStatus,
    retry: retryRestaurants,
  } = useRestaurants(origin, query);

  const items = itemsFor(filter);
  const totals = calcFoodTotals(cart, null, getFoodItem);

  const searching = query.trim().length >= MIN_SEARCH_LENGTH;

  /**
   * `search_item` bat sau khi ngung go. Debounce o day de GOP EVENT, khong phai
   * de giam tai mang — viec loc mon chay hoan toan o client.
   *
   * `lastSearchRef` chan ban trung: Strict Mode cua `next dev` chay effect hai
   * lan, va go roi xoa roi go lai dung tu cu cung khong dang mot event moi.
   *
   * `restaurantCountRef` de so quan KHONG nam trong mang phu thuoc: neu de
   * `restaurants.length` vao day thi ket qua tim quan ve muon se lam effect chay
   * lai va ban them mot `search_item` thu hai cho cung mot tu khoa.
   */
  const lastSearchRef = useRef('');
  const restaurantCountRef = useRef(0);
  restaurantCountRef.current = restaurants.length;

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
          // dung tim mot mon ma thuc don khong co. Van chi dem MON, de ghep
          // duoc voi du lieu sinh truoc khi o tim biet tim ca quan.
          result_count: itemsFor({ kind: 'search', query: trimmed }).length,
          // So quan THAT khop tu khoa, doc tai thoi diem ban. Co the la 0 neu
          // Nominatim chua kip tra loi trong 600ms — do la mot con so xap xi va
          // duoc chap nhan, vi thay the la ban event muon khong xac dinh.
          restaurant_count: restaurantCountRef.current,
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

  function chooseRestaurant(place: Restaurant) {
    setQuery('');
    setFilter({ kind: 'restaurant', place });
    // Len context de ten quan song qua dieu huong — man chi tiet mon va man
    // confirm deu can no.
    setFood({ restaurantId: place.id, restaurantName: place.label });
    trackEvent({
      eventName: 'select_restaurant',
      screenName: 'food_menu',
      properties: {
        restaurant_id: place.id,
        restaurant_name: place.label,
        // Khoang cach tinh tu dia chi giao THAT, khong phai tu hang so — neu
        // khong thi con so trong event khong khop con so tren the quan.
        distance_km: roundKm(haversineKm(origin, place)),
        // Cung MENU_SIZE voi luoi ben duoi: event noi 3 ma man hinh hien 6 la
        // hai nguon su that.
        item_count: menuOf(place, MENU_SIZE).length,
        // Tag `cuisine` THAT tu OSM, nguyen van. Rong = quan khong khai bao —
        // nua so quan roi vao dien nay, va do cung la mot con so dang do.
        cuisine: place.cuisine,
      },
    });
  }

  function chooseOrigin(place: Place) {
    setPickingOrigin(false);
    if (place.id === origin.id) return;

    setFood({ origin: place });
    trackEvent({
      eventName: 'change_address',
      screenName: 'food_menu',
      properties: {
        address_id: place.id,
        address_label: place.label,
        address_source: place.source,
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
    // Phan hoi nhin thay duoc. Khong co dong nay thi bam "+" khong doi gi tren
    // man hinh — nut "Xem gio hang" o day panel nam duoi hang nghin pixel.
    toast.show(`Đã thêm ${item.name}`);
  }

  const pickedRestaurant = filter.kind === 'restaurant' ? filter.place : null;

  const shell = {
    variant: 'wide' as const,
    section: 'Đặt đồ ăn',
    tabs: ['Đặt món', 'Đang diễn ra', 'Đơn đã lưu'],
  };

  // Pattern J — doi dia chi giao ngay trong than panel, KHONG phai route moi.
  if (pickingOrigin) {
    return (
      <ScreenShell
        {...shell}
        title="Giao tới đâu?"
        maxWidth="max-w-[1120px]"
        trailing={
          <button
            type="button"
            onClick={() => setPickingOrigin(false)}
            className="t-body-sm-strong min-h-11 rounded-pill bg-canvas-soft px-lg py-sm text-ink transition-colors hover:bg-surface-pressed"
          >
            Huỷ
          </button>
        }
      >
        <PlacePicker
          placeholder="Nhập địa chỉ giao hàng"
          presetHeading="Địa chỉ gợi ý"
          selectedId={origin.id}
          onPick={chooseOrigin}
          origin={origin}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      {...shell}
      title="Đặt đồ ăn"
      leading={
        <span className="[&_button]:size-11">
          <BackButton from="food_menu" to="home" href="/" />
        </span>
      }
      footer={
        totals.itemCount > 0 ? (
          <PrimaryButton onClick={() => router.push('/food/cart')}>
            Xem giỏ hàng ({totals.itemCount}) · {formatVnd(totals.cartTotal)}
          </PrimaryButton>
        ) : undefined
      }
    >
      <div className="flex flex-col">
      {/* Giao tới — Pattern I cua /ride/pickup. */}
      <div className="order-1 flex items-center gap-lg rounded-xl bg-canvas-soft p-lg">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-canvas text-primary-dark">
          <Icon name="pin" size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="t-caption block text-mute">Giao tới</span>
          <span className="t-body-md-strong block truncate">{origin.label}</span>
          <span className="t-caption block truncate text-body">
            {current.status === 'locating' && !food.origin
              ? 'Đang xác định vị trí của bạn…'
              : current.status === 'fallback' && !food.origin
                ? 'Chưa bật vị trí — đang dùng địa chỉ mặc định'
                : origin.address}
          </span>
        </span>
        <button
          type="button"
          onClick={() => setPickingOrigin(true)}
          className="t-body-sm-strong min-h-11 shrink-0 rounded-pill bg-canvas px-lg py-sm text-primary-dark transition-colors hover:bg-surface-pressed"
        >
          Đổi
        </button>
      </div>

      {/* Ô tìm — cùng thủ pháp với PlacePicker (text-input, tailwind-theme.md mục 4). */}
      <div className="order-2 mt-lg flex items-center gap-md rounded-md bg-canvas-soft p-lg">
        <Icon name="search" size={20} className="text-body" />
        <input
          type="text"
          value={query}
          onChange={(e) => changeQuery(e.target.value)}
          placeholder="Tìm món hoặc quán"
          aria-label="Tìm món ăn hoặc quán ăn"
          className="t-body-md min-w-0 flex-1 bg-transparent text-ink placeholder:text-mute"
        />
        {query ? (
          <button
            type="button"
            aria-label="Xoá ô tìm"
            onClick={() => changeQuery('')}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-canvas text-body hover:bg-surface-pressed"
          >
            <Icon name="close" size={14} />
          </button>
        ) : null}
      </div>

      {/* Gợi ý theo bữa. Chip khớp giờ hiện tại có thêm dòng "gợi ý cho bạn". */}
      <div className="order-3 mt-lg flex flex-wrap items-center gap-sm">
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

      {/* Nhà hàng THẬT quanh địa chỉ giao, sắp theo khoảng cách tăng dần.
          Ba trạng thái tách bạch: đang tải / lỗi / có dữ liệu. Bản cũ gộp cả ba
          thành "không render gì", nên hạ tầng lỗi trông y hệt "không có quán". */}
      <div className="order-7 mt-lg md:order-4">
        <p className="t-body-sm mb-sm text-body">
          {searching ? 'Quán ăn khớp từ khoá' : 'Gần bạn'}
        </p>

        {restaurantStatus === 'loading' ? (
          <div className="flex gap-sm overflow-hidden">
            <Skeleton count={4} className="h-[76px] w-[240px] shrink-0" />
          </div>
        ) : restaurantStatus === 'error' ? (
          <EmptyState
            icon="shop"
            title="Không tải được danh sách quán"
            description="Bốn cách tìm món còn lại vẫn dùng được bình thường."
            action={
              <PrimaryButton variant="subtle" fullWidth={false} onClick={retryRestaurants}>
                Thử lại
              </PrimaryButton>
            }
          />
        ) : restaurants.length === 0 ? (
          <p className="t-body-sm text-body">
            {searching ? 'Không có quán nào khớp từ khoá này.' : 'Chưa tìm thấy quán nào quanh đây.'}
          </p>
        ) : (
          <div className="flex snap-x gap-sm overflow-x-auto pb-xxs">
            {restaurants.map((place) => (
              <RestaurantCard
                key={place.id}
                restaurant={place}
                distanceKm={haversineKm(origin, place)}
                selected={pickedRestaurant?.id === place.id}
                onSelect={() => chooseRestaurant(place)}
              />
            ))}
          </div>
        )}
      </div>

      {/* category-button — tailwind-theme.md muc 4 */}
      <div className="order-4 mb-lg mt-lg flex gap-sm overflow-x-auto pb-xxs md:order-5">
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
        <p className="t-body-sm order-5 mb-lg text-body md:order-6">
          Món tại <span className="t-body-sm-strong text-ink">{pickedRestaurant.label}</span>
          {cuisineLabelOf(pickedRestaurant) ? ` · ${cuisineLabelOf(pickedRestaurant)}` : ''}
          {pickedRestaurant.phone ? ` · ${pickedRestaurant.phone}` : ''}
        </p>
      ) : null}

      <div className="order-6 md:order-7">
      {items.length === 0 ? (
        <EmptyState
          icon="search"
          title="Không tìm thấy món phù hợp"
          description="Thử một từ khoá khác, hoặc xem lại toàn bộ thực đơn."
          action={
            <PrimaryButton
              variant="subtle"
              fullWidth={false}
              onClick={() => {
                setQuery('');
                setFilter({ kind: 'all' });
              }}
            >
              Xoá bộ lọc
            </PrimaryButton>
          }
        />
      ) : (
        <ul className="flex snap-x snap-mandatory gap-md overflow-x-auto pb-xxs sm:grid sm:grid-cols-2 sm:overflow-x-visible sm:pb-0 xl:grid-cols-3">
          {items.map((item) => (
            /* CA THE la mot nut. Ban cu de hang gia nam NGOAI nut, nen hover
               sang len ca the nhung nua duoi bam khong an. Nut "+" dat chong
               len goc thay vi long trong nut kia — HTML khong cho long button. */
            <li
              key={item.id}
              className="relative flex w-[240px] shrink-0 snap-start flex-col overflow-hidden rounded-xl bg-canvas-soft transition-colors hover:bg-surface-pressed focus-within:bg-surface-pressed sm:w-auto"
            >
              <button
                type="button"
                onClick={() => selectItem(item)}
                className="flex flex-1 flex-col p-lg text-left"
              >
                <FoodThumb item={item} />

                <span className="t-body-md-strong mt-lg block">{item.name}</span>
                {/* Dang loc theo quan thi hien ten quan DANG CHON — neu khong,
                    bam "Pho Thai Tu" roi thay the ghi "Phuc Long" la mau thuan
                    ngay tren man hinh. */}
                <span className="t-body-sm mt-xxs block text-body">
                  {pickedRestaurant?.label ?? CUISINE_LABELS[item.cuisine]}
                </span>
                {/* `pr-11` chua cho nut "+" ben canh: truoc day nut do nam de
                    len dong gia, va mot gia dai bi che mat duoi hinh tron. */}
                <span className="t-body-md-strong mt-lg block pr-11">
                  {formatVnd(item.price)}
                </span>
              </button>

              {/* Nut "+" la ANH EM cua nut mo chi tiet, khong long ben trong —
                  HTML khong cho long button, va nho vay bam "+" khong bao gio
                  lo kich hoat viec dieu huong. */}
              <button
                type="button"
                aria-label={`Thêm ${item.name} vào giỏ`}
                onClick={() => quickAdd(item)}
                className="absolute right-lg bottom-lg grid size-11 shrink-0 place-items-center rounded-full bg-canvas text-primary-dark transition-colors hover:bg-primary-dark hover:text-on-primary active:scale-90"
              >
                <Icon name="plus" size={20} />
              </button>
            </li>
          ))}
        </ul>
      )}
      </div>
    </div>
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
      aria-pressed={active}
      className={`t-body-sm-strong min-h-11 shrink-0 rounded-pill bg-canvas-soft px-lg py-sm text-ink transition-colors hover:bg-surface-pressed ${
        active ? 'ring-2 ring-primary' : ''
      }`}
    >
      {children}
    </button>
  );
}
