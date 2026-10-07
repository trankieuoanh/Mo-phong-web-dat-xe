# POWERBI_D1.md — nối Power BI với dữ liệu của app

```
 D1 (events + 11 bảng dim_/fact_)
        │  qua API của chính app (Vercel)
        ├─ GET /api/events?flat=1&from=…&to=…      ← event hành vi, incremental refresh theo ngày
        └─ GET /api/analytics/<table>?limit&after  ← 11 bảng mô phỏng (dim_*, fact_*), phân trang
                     │
                     ▼
               Power BI (Import)
```

Power BI **không có connector D1 trực tiếp**, nên đọc qua hai API ở trên. Không dùng BigQuery, không dùng CSV. Dữ liệu trong D1 là nguồn duy nhất: event mới của app xuất hiện ở lần refresh kế tiếp.

> **Chưa kiểm trong Power BI thật.** Hai API và đường phân trang đã kiểm bằng `curl`/script (`docs/migration-verification.md`). Các đoạn Power Query (M) dưới đây viết theo tài liệu Power BI nhưng **chưa chạy trên Power BI Desktop/Service** — nếu có lỗi cú pháp, báo lại để chỉnh.

## 1. Chuẩn bị

| Việc | Chi tiết |
|---|---|
| URL gốc | `https://<app>.vercel.app` (hoặc `http://localhost:3000` khi dev; Power BI Service **không** gọi được localhost) |
| Token (nếu bật) | Biến `ANALYTICS_TOKEN` trên Vercel. Có giá trị → mọi request đọc cần header `Authorization: Bearer <token>`; để trống → mở. Nên bật khi deploy công khai vì `events` chứa số điện thoại thật |
| Quyền truy cập nguồn | *Get Data → Web*, khi hỏi credentials chọn **Anonymous** (token đi trong header của M, không phải credential của Power BI) |
| Tham số khuyến nghị | Tạo parameter `BaseUrl` (Text) và `ApiToken` (Text) để không dán cứng vào từng truy vấn |

## 2. Bảng `events` — Import + incremental refresh

Vì sao: `GET /api/events` không lọc ≈ **3,56 MB** (9.160 event), sát giới hạn ~4,5 MB của hàm Vercel và sẽ vượt khi dữ liệu tăng. Incremental refresh chia theo ngày (mỗi request một khoảng nhỏ) và chỉ tải lại 1–2 ngày gần nhất.

1. *Manage Parameters → New*: `RangeStart` và `RangeEnd`, kiểu **Date/Time** (tên và kiểu **bắt buộc đúng**), giá trị tạm bất kỳ.
2. Truy vấn `events` (Advanced Editor):

```m
let
    Source = Json.Document(Web.Contents(BaseUrl, [
        RelativePath = "api/events",
        Query = [
            flat = "1",
            from = DateTime.ToText(RangeStart, "yyyy-MM-dd'T'HH:mm:ss'Z'"),
            to   = DateTime.ToText(RangeEnd,   "yyyy-MM-dd'T'HH:mm:ss'Z'")
        ],
        Headers = [Authorization = "Bearer " & ApiToken]
    ])),
    AsTable   = Table.FromList(Source, Splitter.SplitByNothing(), {"e"}, null, ExtraValues.Error),
    Columns   = if Table.RowCount(AsTable) = 0 then {} else Record.FieldNames(AsTable{0}[e]),
    Expanded  = if Table.RowCount(AsTable) = 0 then AsTable else Table.ExpandRecordColumn(AsTable, "e", Columns),
    Typed     = if Table.RowCount(Expanded) = 0 then Expanded else Table.TransformColumnTypes(Expanded, {{"created_at", type datetimezone}, {"step_index", Int64.Type}}),
    // API coi `to` là BAO GỒM (<=); Power BI cần nửa mở [RangeStart, RangeEnd) → lọc lại để không trùng ở biên.
    InRange   = if Table.RowCount(Typed) = 0 then Typed else Table.SelectRows(Typed, each
                    DateTimeZone.RemoveZone(DateTimeZone.SwitchZone([created_at], 0)) >= RangeStart and
                    DateTimeZone.RemoveZone(DateTimeZone.SwitchZone([created_at], 0)) <  RangeEnd)
in
    InRange
```

3. *Incremental refresh policy* trên bảng: **lưu 90 ngày** (khớp dải dữ liệu seed), **làm mới 1–2 ngày gần nhất**; bỏ chọn "Detect data changes" (API không có cột `updated_at`; event append-only nên không cần).
4. Xuất bản lên Power BI Service, đặt lịch refresh (30–60 phút là đủ; sau khi D1 có event mới thì lần refresh kế tiếp lấy được).

**Điều kiện:** incremental refresh trên Service cần giấy phép **Pro / Premium Per User / Premium**. Ở Desktop miễn phí chỉ làm mới toàn bộ (vẫn rẻ: server cache 5 phút + đồng bộ tăng dần, D1 cho 5 triệu dòng đọc/ngày) — khi đó đặt tạm `RangeStart`/`RangeEnd` rộng và nhớ giới hạn 4,5 MB.

**Cột có sẵn** (`flat=1`): `id, session_id, user_id, flow, event_name, screen_name, previous_screen, step_index, platform, created_at, seed_batch` + các cột `prop_<khoá>` trải từ `properties` (mọi dòng cùng tập cột, khoá thiếu là `null`). Lưu ý:
- `created_at` là **UTC**; đổi giờ VN trong Power BI: `DateTimeZone.SwitchZone([created_at], 7)`.
- **Lọc dữ liệu thật/giả:** `seed_batch` rỗng = người thật click; có giá trị = event do `seed-events.js` sinh (trải 90 ngày quá khứ). Báo cáo hành vi thật nên lọc `seed_batch = null`.
- `user_id`: số điện thoại E.164 (người đã đăng nhập) hoặc `anon-<uuid>` (khách). Một `session_id` thường có cả hai (xem `analysis-spec.md`). Số điện thoại là **dữ liệu cá nhân** — ẩn cột này trong báo cáo chia sẻ.
- Các cột chỉ có giá trị ở đúng event sinh ra chúng (ví dụ `prop_final_price` chỉ ở `confirm_ride`/`cancel_ride`) → lọc theo `event_name` trước khi cộng.

## 3. 11 bảng phân tích — `GET /api/analytics/<table>`

Một URL cho mỗi bảng: `dim_region`, `dim_hex`, `dim_promo`, `dim_promo_cap_history`, `dim_date`, `dim_merchant`, `dim_user`, `fact_promo_budget`, `fact_ride`, `fact_food`, `fact_promo_burn`. Phản hồi `{ "rows": [...], "next_cursor": "..." | null }`; mặc định 2.000 dòng/trang (tối đa 5.000); cột boolean là `true/false`.

Hàm dùng chung (tạo truy vấn `GetTable`, rồi mỗi bảng gọi `GetTable("dim_user")`):

```m
(table as text) as table =>
let
    GetPage = (cursor as nullable text) as record =>
        let
            q = [limit = "2000"] & (if cursor = null then [] else [after = cursor])
        in
            Json.Document(Web.Contents(BaseUrl, [
                RelativePath = "api/analytics/" & table,
                Query = q,
                Headers = [Authorization = "Bearer " & ApiToken]
            ])),
    Pages = List.Generate(
        () => GetPage(null),
        each _ <> null,
        each if [next_cursor] = null then null else GetPage([next_cursor]),
        each [rows]
    ),
    AllRows  = List.Combine(Pages),
    AsTable  = Table.FromList(AllRows, Splitter.SplitByNothing(), {"r"}, null, ExtraValues.Error),
    Columns  = if Table.RowCount(AsTable) = 0 then {} else Record.FieldNames(AsTable{0}[r])
in
    if Table.RowCount(AsTable) = 0 then AsTable else Table.ExpandRecordColumn(AsTable, "r", Columns)
```

- **Dữ liệu mock tĩnh**, nạp một lần: không cần incremental refresh. Trong D1 hiện: 9 bảng đủ; `fact_food` 7.232 dòng và `fact_promo_burn` 3.000 dòng là **tập con mock** (quyết định của chủ dự án — `scripts/lib/mock-subset.js`). Muốn đủ: `node scripts/migrate-firebase-to-d1.js --all-rows` (cần ≥ 2 ngày hạn mức ghi).
- Bảng `fact_*` có `from`/`to` (theo `session_start` hoặc `event_datetime`, UTC) nếu muốn incremental refresh như `events`.
- Thời điểm (`session_start`, `event_datetime`) là **UTC ISO**; file CSV gốc là giờ VN (+07:00) — đã đổi khi nạp.

### Mô hình quan hệ gợi ý (sao)
`fact_ride` / `fact_food` / `fact_promo_burn` → các dim qua: `user_id → dim_user`, `hex_id`/`dropoff_hex_id`/`merchant_hex_id → dim_hex`, `merchant_id → dim_merchant` (food), `date_key → dim_date`, `promo_code → dim_promo`, `cap_version_id → dim_promo_cap_history`; `dim_hex.region_id → dim_region`; `fact_promo_budget (month_start, service, hex_id, segment)` nối `dim_hex` qua `hex_id`. `fact_promo_burn.session_id` trỏ tới `fact_ride` **hoặc** `fact_food` tuỳ cột `service` (không phải khoá ngoại cứng). Bảng `events` **không** nối với các bảng trên — user giả `U00001…` và SĐT thật là hai thế giới khác nhau.

## 4. Sự cố thường gặp

| Triệu chứng | Nguyên nhân / cách xử |
|---|---|
| `401` / "Cần Authorization: Bearer" | `ANALYTICS_TOKEN` đã đặt trên Vercel nhưng M thiếu/sai `Headers`. Kiểm `ApiToken` |
| "dynamic data source" / không refresh được trên Service | Phải dùng `RelativePath` + `Query` của `Web.Contents` (như mẫu), không nối chuỗi vào URL |
| Thiếu vài dòng ở biên hai ngày | Quên bước lọc `>= RangeStart and < RangeEnd`, hoặc lệch múi giờ — `from/to` của API là **UTC** |
| `500 Could not read …` | D1 từ chối (hết hạn mức ngày — reset 07:00 giờ VN) hoặc cấu hình `CLOUDFLARE_*` trên Vercel sai; xem log function |
| Phản hồi bị cắt/lỗi ở `events` không lọc | Vượt ~4,5 MB của hàm Vercel → dùng `from`/`to` (mục 2) |
| Muốn kiểm nhanh API trước khi vào Power BI | `node scripts/smoke-production.js https://<app>.vercel.app [--token T]` |
