# POWERBI_BIGQUERY.md — nối Power BI với BigQuery

```
Firestore events → sync (15 phút) → BigQuery fact_events → vw_events_powerbi → Power BI
```

Chuẩn bị BigQuery: xem `docs/BIGQUERY_SETUP.md`. Power BI đọc **`vw_events_powerbi`** (đã phẳng hoá `properties`), giữ `fact_events` cho ai cần JSON thô.

## Kết nối

1. Power BI Desktop → *Get Data* → **Google BigQuery**.
2. Đăng nhập tài khoản Google có quyền xem dataset (hoặc dùng service account chỉ-đọc riêng, quyền `BigQuery Data Viewer` trên dataset + `BigQuery Job User` ở project).
3. Chọn **Project** → dataset `gsm_analytics` → tick `vw_events_powerbi`.
4. Chọn chế độ dữ liệu (bên dưới) → *Load*.

## Import hay DirectQuery?

**Khuyến nghị: Import + scheduled refresh** (Power BI Service, ví dụ mỗi 30–60 phút).
- Dữ liệu cỡ chục nghìn dòng, Import nhanh và mọi phép đo DAX chạy được.
- Sync đã là near-real-time (trễ ≤ ~15–20 phút) nên refresh dày hơn không cải thiện được gì.
- DirectQuery mỗi lần bấm slicer là một truy vấn BigQuery bị tính tiền; chỉ đáng khi dữ liệu quá lớn để Import.

Không gọi đây là "real-time": tổng độ trễ = chu kỳ sync + chu kỳ refresh.

## Cột nên dùng của `vw_events_powerbi`

| Nhóm | Cột |
|---|---|
| Định danh | `event_id`, `session_id`, `user_id` (SĐT — cân nhắc ẩn) |
| Funnel | `flow`, `event_name`, `screen_name`, `previous_screen`, `step_index` |
| Thời gian | `created_at` (UTC), `created_date_vn` (giờ VN) |
| Lọc thật/giả | `is_seed` (lọc `FALSE` để chỉ lấy người thật), `seed_batch` |
| Ride | `vehicle_type`, `payment_method`, `distance_km`, `duration_min`, `base_price`, `discount_amount`, `final_price`, `route_source`, `address_label`, `pickup_label`, `promo_id`, `cancel_reason` |
| Food | `item_count`, `cart_total`, `shipping_fee`, `final_total`, `offer_id`, `restaurant_id`, `cuisine` |

Các cột ride/food chỉ có giá trị ở đúng loại event sinh ra chúng (ví dụ `final_price` chỉ ở `confirm_ride`/`cancel_ride`), còn lại là NULL — hãy lọc theo `event_name` trước khi cộng.
Cần khoá `properties` khác? Thêm `JSON_VALUE(properties, '$.<khoá>')` vào `scripts/bigquery/create-view-powerbi.sql` rồi chạy `npm run bigquery:init` (chỉ thay view, không đụng dữ liệu). Khoá phải có trong `event-taxonomy.md`.

## Lưu ý

- Nhớ lọc `is_seed = FALSE` khi báo cáo hành vi thật; dữ liệu seed trải 90 ngày quá khứ.
- Bảng `pbi_*` trong Firestore (nạp từ CSV `powerBI/`) là luồng khác, **không** nằm trong pipeline này.
