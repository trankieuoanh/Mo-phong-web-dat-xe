# analysis-spec.md — GSM ride-booking simulation

Định nghĩa các chỉ số script Python phải tính. Đây là **sản phẩm cuối** của dự án — app mô phỏng chỉ là công cụ sinh dữ liệu.

## Nạp dữ liệu

`fetch_events.py` đọc toàn bộ collection `events` bằng `firebase-admin`, đổ ra `output/events.csv`:

```python
rows = [{'event_id': d.id, **d.to_dict()} for d in db.collection('events').stream()]
df = pd.DataFrame(rows)
df['created_at'] = pd.to_datetime(df['created_at'], utc=True).dt.tz_convert('Asia/Ho_Chi_Minh')
props = pd.json_normalize(df['properties'])     # properties.vehicle_type → cột phẳng
df = pd.concat([df.drop(columns=['properties']), props.add_prefix('prop_')], axis=1)
```

`properties.entry_source` được đọc thành cột phẳng `prop_entry_source`. Cột này có thể vắng ở dữ liệu cũ; khi đó các `select_flow` tiếp tục dùng quy tắc legacy để phân biệt flow switch. Seed mặc định bao gồm các phiên direct cho cả Ride và Food, đồng thời giữ các phiên chọn luồng từ `/` để so sánh.

Tách bước tải và bước tính: `fetch_events.py` chạm mạng, `metrics.py` chỉ đọc CSV. Nhờ vậy sửa công thức không phải gọi lại Firestore mỗi lần.

**Lọc trước khi tính** — bỏ các session rác:
- Session chỉ có đúng 1 event (mở trang rồi đóng ngay).
- Session không có event nào với `step_index >= 1` (không vào luồng nào).

---

## Nhóm 1 — Funnel (chỉ số chính)

Với mỗi `flow`, đếm **số session riêng biệt** chạm tới từng `step_index`:

```python
funnel = (df[df.flow == 'ride']
          .groupby('step_index')['session_id'].nunique()
          .sort_index())
```

| Chỉ số | Công thức |
|---|---|
| `reach` | số session chạm tới bước n |
| `step_conversion` | `reach(n) / reach(n-1)` — tỉ lệ đi tiếp từ bước ngay trước |
| `overall_conversion` | `reach(n) / reach(0)` — tỉ lệ so với số session **chọn luồng này** (bước 0 = `select_flow`; `entry_source == 'direct_url'` vẫn là entry hợp lệ, không tạo thêm bước) |
| `drop_off` | `1 - step_conversion` |

Kết quả cần đọc được thành câu kiểu: *"68% người chọn xong địa chỉ tiếp tục xác nhận điểm đón; tụt mạnh nhất ở bước chọn khuyến mãi (chỉ 41% đi tiếp)."*

**Bước chuẩn để so sánh giữa 2 luồng:** luồng ride có 6 bước sau Home, food có 7 (do `add_to_cart` là một bước riêng). Khi so sánh trực tiếp, dùng `overall_conversion` tới bước kết thúc, không so từng `step_index` với nhau.

## Nhóm 2 — Hoàn thành & bỏ dở

| Chỉ số | Định nghĩa |
|---|---|
| `completion_rate` | session có `confirm_ride` (ride) / `place_order` (food), chia cho số session vào luồng đó |
| `abandon_step` | với session chưa hoàn thành: `max(step_index)` — bước cuối cùng chạm tới |
| `abandon_distribution` | phân bố `abandon_step` → biết người dùng bỏ nhiều nhất ở màn nào |

> **Bước 0 là event `select_flow`, không phải màn `home`.** Nó luôn mang `step_index: 0` kể cả khi bắn ở `address_selection` hay `food_menu` (người dùng bấm tab đổi luồng ở sidebar) — xem `event-taxonomy.md` mục 1.
>
> **Phân biệt flow switch và direct entry:** `completion_rate` loại session có `select_flow` ở `screen_name != 'home'` khỏi mẫu số của luồng, vì đó là dấu hiệu nhảy luồng. Nếu event có `prop_entry_source == 'direct_url'`, đây là bước 0 hợp lệ của luồng được mở bằng URL trực tiếp và session vẫn được giữ trong cohort. Event cũ không có `entry_source` tiếp tục dùng quy tắc `screen_name != 'home'`; các bước funnel không đổi.

## Nhóm 3 — Thời gian

Sắp theo `session_id` + `created_at`, lấy hiệu giữa các `screen_view` liên tiếp:

```python
sv = df[df.event_name == 'screen_view'].sort_values(['session_id', 'created_at'])
sv['dwell_sec'] = sv.groupby('session_id')['created_at'].diff().shift(-1).dt.total_seconds()
```

| Chỉ số | Ghi chú |
|---|---|
| `median_dwell_per_screen` | **Median**, không phải mean — vài phiên bị bỏ mở tab sẽ kéo mean lệch hoàn toàn |
| `total_flow_duration` | `max(created_at) - min(created_at)` của các session hoàn thành |

Loại bỏ `dwell_sec > 300` (5 phút) khỏi thống kê: đó là tab bỏ quên, không phải thời gian cân nhắc thật.

## Nhóm 4 — Hành vi quay lại & sửa đổi

| Chỉ số | Cách tính |
|---|---|
| `back_rate_per_screen` | số event `back` trên mỗi màn / số `screen_view` của màn đó |
| `change_address_rate` | số `change_address` / số `screen_view` của `pickup_confirm` |
| `cart_edit_rate` | (`remove_from_cart` + `change_quantity` tại `food_cart`) / số session vào `food_cart` |
| `revisit_count` | số màn có nhiều hơn 1 `screen_view` trong cùng một session — dấu hiệu người dùng do dự |

Chỉ số này trả lời câu hỏi UX cụ thể: **màn nào khiến người dùng phải quay lại sửa?**

## Nhóm 5 — Lựa chọn nội dung

| Chỉ số | Nguồn |
|---|---|
| `vehicle_split` | `prop_vehicle_type` trong `select_vehicle` — gom theo `vehicle_type` (2 nhóm) chứ không theo `vehicle_id` (6 hạng xe); lấy event **cuối cùng** của mỗi session vì người dùng có thể đổi ý nhiều lần |
| `address_popularity` | `prop_address_id` trong `select_address` — đây là **điểm đến** phổ biến. Chỉ gom nhóm được trong phạm vi `address_source == 'preset'` (5 giá trị `addr-*`); hai nhánh `'search'` và `'map'` đều có tập id mở nên xếp hạng theo `prop_address_label` thay vì id |
| `search_usage_rate` | tỉ lệ `select_address` có `prop_address_source == 'search'` — **người dùng có thực sự cần ô tìm không**, hay 5 gợi ý đã đủ |
| `map_pick_rate` | tỉ lệ `select_address` có `prop_address_source == 'map'` — **người dùng có thích tự bấm trên bản đồ không**. Ba nhánh `preset` / `search` / `map` cộng lại bằng 100%, nên đọc ba con số cùng lúc mới ra bức tranh "người ta chọn địa chỉ bằng cách nào" |
| `pickup_change_rate` | tỉ lệ `confirm_pickup` có `prop_pickup_id != 'pickup-current'` — tỉ lệ người đổi khỏi điểm đón do GPS đề xuất |
| `avg_distance_km` | trung bình `prop_distance_km` trong `confirm_ride`. **Lọc `prop_route_source == 'osrm'` trước** — xem cảnh báo bên dưới |
| `abandon_rate_by_distance` | chia `prop_distance_km` của `select_vehicle` thành khoảng (0–5, 5–15, >15 km) rồi tính tỉ lệ session **không** có `confirm_ride` trong từng khoảng. Trả lời: *chuyến càng xa (càng đắt) thì càng dễ bỏ dở?* |
| `route_fallback_rate` | tỉ lệ `confirm_ride` có `prop_route_source == 'straight'` — **chỉ số sức khoẻ hạ tầng, không phải hành vi người dùng**. Cao nghĩa là OSRM hay chết trong đợt thu thập, và mọi số liệu quãng đường của đợt đó kém tin cậy |
| `promo_usage` vs `skip_rate` | `select_promo` so với `skip_promo` |
| `top_items` | `prop_item_id` trong `add_to_cart`, cộng theo `prop_quantity` |
| `avg_cart_size` / `avg_cart_total` | `prop_cart_size` / `prop_cart_total` trong `proceed_to_offer` |
| `offer_usage` vs `skip_rate` | `select_offer` so với `skip_offer` |
| `avg_discount` | trung bình `prop_discount_amount` của các đơn hoàn thành |

> **Hai cảnh báo khi dùng `prop_base_price` và `prop_distance_km`:**
>
> 1. **`base_price` không còn so sánh trực tiếp được giữa các session.** Nó từng là giá cố định của hạng xe; giờ nó là hàm của (hạng xe, quãng đường). Muốn so giá thì phải chuẩn hoá — ví dụ `base_price / distance_km` — hoặc chỉ so trong cùng một khoảng quãng đường.
> 2. **`distance_km` trộn hai loại nếu không lọc `route_source`.** `'osrm'` là quãng đường đường bộ thật; `'straight'` là đường chim bay, luôn ngắn hơn đáng kể. Gộp chung sẽ kéo trung bình xuống một cách vô hình.

## Nhóm 6 — Replay một phiên

Với một `session_id` bất kỳ, in ra dòng thời gian đầy đủ để kiểm tra dữ liệu có đúng như thao tác thật không:

```
00.0s  home                 screen_view
02.3s  home                 select_flow          {flow_chosen: ride}     # step 0
02.4s  address_selection    screen_view
07.8s  address_selection    select_address       {address_id: addr-home}
...
```

Khi mở trực tiếp `/ride/address` hoặc `/food`, thứ tự hợp đồng là:

```
00.0s  address_selection    select_flow          {flow_chosen: ride, entry_source: direct_url}  # step 0
00.1s  address_selection    screen_view
...
```

Đây vừa là công cụ trình bày cho mentor, vừa là cách **kiểm chứng taxonomy**: nếu dòng thời gian đọc không khớp với thao tác vừa làm, tracking đang sai.

---

## Đầu ra

```
analysis/output/
  events.csv                 # dữ liệu thô
  funnel_ride.csv
  funnel_food.csv
  summary.csv                # mọi chỉ số một dòng một chỉ số
  funnel_ride.png            # biểu đồ cột ngang, giảm dần theo bước
  funnel_food.png
  abandon_distribution.png
  dwell_per_screen.png
```

Biểu đồ dùng `matplotlib`, một màu `#048589` (primary-dark) cho toàn bộ cột để đồng bộ với nhận diện app, không dùng bảng màu mặc định.

## Ngưỡng dữ liệu tối thiểu

Muốn các tỉ lệ có nghĩa, cần ít nhất **30 session mỗi luồng**, trong đó có cả session cố tình bỏ dở ở các bước khác nhau. Sinh dữ liệu toàn phiên hoàn thành sẽ cho funnel phẳng 100% và không nói lên điều gì — kế hoạch sinh dữ liệu ở `roadmap.md` Tuần 6.
