# db-design.md — GSM ride-booking simulation

## Nguyên tắc thiết kế
Firestore là **NoSQL document database** — không có bảng/cột cố định như Postgres. Dữ liệu tổ chức theo **collection** (giống "thư mục") chứa nhiều **document** (giống 1 file JSON). Project này chỉ cần **1 collection**: `events`.

Vì Firestore document vốn đã linh hoạt (thêm field nào cũng được, không cần khai báo trước), ta **không cần** kỹ thuật "cột `properties` JSONB" như ở thiết kế Postgres trước theo đúng nghĩa kỹ thuật — nhưng vẫn nên gom các field đặc thù theo từng flow vào 1 field `properties` dạng map, để giữ cấu trúc gọn và dễ đọc, nhất quán giữa 2 luồng.

## Cấu trúc document trong collection `events`
```
events (collection)
 └─ {auto-id} (document)
     ├─ session_id: string
     ├─ user_id: string
     ├─ flow: "ride" | "food" | "none"   // "none" chi o man home
     ├─ event_name: string
     ├─ screen_name: string
     ├─ previous_screen: string | null
     ├─ step_index: number
     ├─ platform: string          // "web"
     ├─ properties: map           // field đặc thù theo loại event
     └─ created_at: timestamp     // Firestore server timestamp
```

## Ví dụ document — luồng Đặt xe
```json
{
  "session_id": "abc-123",
  "user_id": "mock-user-1",
  "flow": "ride",
  "event_name": "select_vehicle",
  "screen_name": "vehicle_selection",
  "previous_screen": "pickup_confirm",
  "step_index": 3,
  "platform": "web",
  "properties": { "vehicle_type": "bike" },
  "created_at": "2026-09-15T10:12:03Z"
}
```

## Ví dụ document — luồng Food
```json
{
  "session_id": "abc-124",
  "user_id": "mock-user-2",
  "flow": "food",
  "event_name": "add_to_cart",
  "screen_name": "food_item_detail",
  "previous_screen": "food_menu",
  "step_index": 3,
  "platform": "web",
  "properties": {
    "item_id": "banh-mi-01",
    "item_name": "Bánh mì thịt nướng",
    "price": 35000,
    "quantity": 1,
    "cart_size_after": 1,
    "cart_total_after": 35000
  },
  "created_at": "2026-09-15T10:14:20Z"
}
```

> Giá trị `screen_name`, `previous_screen`, `step_index` và cấu trúc `properties` của **mọi** event được quy định trong `event-taxonomy.md` — đó là nguồn sự thật, file này chỉ minh hoạ hình dạng document.

`platform` do `apps/api` tự gắn, **không** nằm trong request body (xem `api-endpoints.md`).

## Cách ghi 1 document (trong `apps/api/src/services/event.service.ts`, dùng Admin SDK)
```js
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const db = getFirestore();
await db.collection('events').add({
  session_id: 'abc-123',
  user_id: 'mock-user-1',
  flow: 'ride',
  event_name: 'select_vehicle',
  screen_name: 'vehicle_selection',
  previous_screen: 'pickup_confirm',
  step_index: 3,
  platform: 'web',
  properties: { vehicle_type: 'bike' },
  created_at: FieldValue.serverTimestamp(),
});
```
`.add()` tự sinh document id — không cần tự tạo id như `event_id` ở bản Postgres trước.

## Cách đọc lại theo session (dùng cho phân tích/replay)
```js
const snapshot = await db.collection('events')
  .where('session_id', '==', 'abc-123')
  .orderBy('step_index')
  .get();

const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
```

## Lưu ý về index
Firestore tự tạo index đơn giản (theo 1 field), nhưng khi query kết hợp `where` + `orderBy` trên 2 field khác nhau (như ví dụ trên), hoặc nhiều `where` cùng lúc (lọc theo `flow` và khoảng `created_at`), Firestore sẽ **yêu cầu tạo composite index** — lần đầu chạy sẽ báo lỗi kèm link để tạo index đó ngay trên console, không cần tự đoán trước.

## Về danh sách 17 trường của mentor (chưa confirm)
Khi có list thật, chỉ cần thêm field vào object khi ghi document — không có bước "migrate schema" như SQL (`ALTER TABLE`). Field nào dùng để lọc/sắp xếp thường xuyên thì để ở top-level document (như `flow`, `session_id`), field đặc thù ít dùng để lọc thì gom vào `properties`.

Cụ thể phải sửa: `EventPayload` trong `packages/shared/src/types.ts`, rồi `apps/api/src/validators/event.validator.ts` (whitelist hiện chỉ lấy đúng 8 field — field mới không thêm vào đây sẽ bị loại im lặng).

Quy trình chi tiết khi list được chốt: xem `event-taxonomy.md` mục 6.