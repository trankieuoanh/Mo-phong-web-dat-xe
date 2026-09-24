# roadmap.md — GSM ride-booking simulation

Kế hoạch 6 tuần. Mỗi tuần có **Definition of Done kiểm chứng được** — không phải "làm xong phần X" mà là "chạy lệnh này, thấy kết quả này".

| Tuần | Trọng tâm | Definition of Done |
|---|---|---|
| **1** | Phase 0 + nền UI | `npm run dev` lên; `curl localhost:3000/api/health` trả `{"status":"ok"}`; màn Home render panel đặt xe + bản đồ đúng token |
| **2** | Firestore + luồng Ride | Click hết 5 bước ride → mở Firebase console thấy đủ document, `step_index` 0→6 đúng `event-taxonomy.md` |
| **3** | Luồng Food + giỏ hàng | Thêm/xoá/sửa số lượng, đặt đơn xong → `place_order` có `final_total` khớp với số hiển thị trên màn |
| **4** | `GET /api/events` + hoàn thiện UI | `curl "localhost:3000/api/events?session_id=..."` trả đúng thứ tự bước; app dùng tốt ở khổ 390px |
| **5** | Phân tích | `python metrics.py` sinh đủ file trong `output/`; funnel đọc ra được thành câu tiếng Việt có nghĩa |
| **6** | Sinh dữ liệu + báo cáo | ≥ 30 session mỗi luồng; slide/báo cáo có biểu đồ funnel + 3 nhận định UX |

---

## Tuần 1 — Nền

**Khung đã dựng sẵn** (`app/`, `components/`, `lib/shared/`, `lib/server/`, `analysis/`), gồm cả `globals.css` với `@theme` + typography, `types.ts`, `screens.ts`, `mock-data.ts`, `pricing.ts`, `/api/health`, và 13 page stub đã nối đúng tracking. Việc còn lại của tuần 1:

1. `npm install && npm run dev` — kiểm tra theo `setup.md` Phase 0.
2. Hoàn thiện giao diện màn Home theo `DESIGN.md`.
3. Rà `lib/shared/mock-data.ts` xem đã khớp `mock-data.md` chưa.

> **Chốt `event-taxonomy.md` với mentor trong tuần này.** Sửa taxonomy sau khi đã sinh dữ liệu đồng nghĩa với vứt dữ liệu cũ. Nhớ hỏi mentor về `flow: "none"` ở màn Home (mục 1 của taxonomy).

## Tuần 2 — Firestore + Ride

1. Firebase project + `.env.local` (theo `setup.md` Phase 1).
2. Kiểm tra `POST /api/events` ghi được document thật.
3. Hoàn thiện UI 6 màn luồng ride — **phần tracking đã nối sẵn, không sửa khi làm UI**.
4. Kiểm tra guard: mở thẳng `/ride/confirm` ở tab mới phải bị đá về `/ride/address` và không sinh event nào.

**Kiểm tra bắt buộc cuối tuần 2:** đi hết luồng một lần rồi đếm document trong console. Số `screen_view` phải **đúng bằng** số màn đã đi qua. Nếu gấp đôi → hook chưa chặn React Strict Mode (xem `screen-map.md` mục 4).

## Tuần 3 — Food

1. Hoàn thiện UI 6 màn luồng food, kể cả `/food/item/[itemId]`.
2. Kiểm tra `calcDiscount` trong `lib/shared/pricing.ts` cho đủ 3 offer, nhất là `offer-freeship`.
3. Hai màn success — xác nhận session được reset (mở DevTools xem `gsm_session_id` đổi).

## Tuần 4 — Đọc dữ liệu + hoàn thiện

1. Kiểm tra `GET /api/events` với đủ 4 tổ hợp param: `session_id` / `flow` / `from` / `to`.
2. Tạo composite index khi Firestore báo lỗi kèm link (message lỗi được trả nguyên văn, chứa link).
3. Rà lại toàn bộ UI theo `tailwind-theme.md` — không còn giá trị hardcode ngoài token.
4. Test khổ 390px và 430px.
5. `npm run build` và `npm run typecheck` sạch lỗi.

## Tuần 5 — Phân tích

1. `analysis/fetch_events.py` → `events.csv`.
2. `analysis/metrics.py` → 6 nhóm chỉ số trong `analysis-spec.md`.
3. Biểu đồ funnel + phân bố điểm bỏ dở.
4. Công cụ replay một phiên (Nhóm 6) — dùng để kiểm chứng tracking đúng.

## Tuần 6 — Dữ liệu + báo cáo

**Kế hoạch sinh dữ liệu** (quan trọng nhất, dễ bị làm qua loa nhất):

| Kiểu phiên | Ride | Food |
|---|---|---|
| Hoàn thành trọn vẹn | 12 | 12 |
| Bỏ ở bước giữa (rải đều các bước) | 10 | 10 |
| Có quay lại sửa lựa chọn rồi mới hoàn thành | 5 | 5 |
| Vào Home rồi thoát luôn | 3 | 3 |
| **Tổng** | **30** | **30** |

Chia cho vài người click (bạn + bạn cùng nhóm) để `user_id` khác nhau. Mỗi phiên nhớ mở tab mới hoặc bấm "Về trang chủ" để `session_id` được reset.

Sau đó: chạy phân tích, viết báo cáo gồm biểu đồ funnel 2 luồng, điểm rớt lớn nhất, và 3 nhận định UX rút ra được.

---

## Rủi ro về thời gian

`DESIGN.md` đã cảnh báo: phạm vi hiện tại là **2 luồng đầy đủ** (13 màn) chứ không phải 1 luồng + placeholder. Nếu đến hết Tuần 3 mà luồng Food chưa xong, cắt theo thứ tự ưu tiên sau:

1. Bỏ `/food/item/[itemId]` — thêm thẳng vào giỏ từ màn menu. Mất bước funnel số 2 của luồng food nhưng vẫn giữ được `add_to_cart`.
2. Bỏ sửa số lượng trong giỏ, chỉ cho xoá.
3. Rút menu từ 8 món xuống 4.

**Không cắt** phần phân tích (Tuần 5) — đó mới là nội dung dự án. Thà một luồng gọn mà phân tích tử tế, còn hơn hai luồng đẹp mà không có chỉ số nào.
