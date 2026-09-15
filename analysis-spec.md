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
| `overall_conversion` | `reach(n) / reach(0)` — tỉ lệ so với tổng số vào Home |
| `drop_off` | `1 - step_conversion` |

Kết quả cần đọc được thành câu kiểu: *"68% người chọn xong địa chỉ tiếp tục xác nhận điểm đón; tụt mạnh nhất ở bước chọn khuyến mãi (chỉ 41% đi tiếp)."*

**Bước chuẩn để so sánh giữa 2 luồng:** luồng ride có 6 bước sau Home, food có 7 (do `add_to_cart` là một bước riêng). Khi so sánh trực tiếp, dùng `overall_conversion` tới bước kết thúc, không so từng `step_index` với nhau.

## Nhóm 2 — Hoàn thành & bỏ dở

| Chỉ số | Định nghĩa |
|---|---|
| `completion_rate` | session có `confirm_ride` (ride) / `place_order` (food), chia cho số session vào luồng đó |
| `abandon_step` | với session chưa hoàn thành: `max(step_index)` — bước cuối cùng chạm tới |
| `abandon_distribution` | phân bố `abandon_step` → biết người dùng bỏ nhiều nhất ở màn nào |

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
| `vehicle_split` | `prop_vehicle_type` trong `select_vehicle` |
| `address_popularity` | `prop_address_id` trong `select_address` |
| `promo_usage` vs `skip_rate` | `select_promo` so với `skip_promo` |
| `top_items` | `prop_item_id` trong `add_to_cart`, cộng theo `prop_quantity` |
| `avg_cart_size` / `avg_cart_total` | `prop_cart_size` / `prop_cart_total` trong `proceed_to_offer` |
| `offer_usage` vs `skip_rate` | `select_offer` so với `skip_offer` |
| `avg_discount` | trung bình `prop_discount_amount` của các đơn hoàn thành |

## Nhóm 6 — Replay một phiên

Với một `session_id` bất kỳ, in ra dòng thời gian đầy đủ để kiểm tra dữ liệu có đúng như thao tác thật không:

```
00.0s  home                 screen_view
02.3s  home                 select_flow          {flow_chosen: ride}
02.4s  address_selection    screen_view
07.8s  address_selection    select_address       {address_id: addr-home}
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
