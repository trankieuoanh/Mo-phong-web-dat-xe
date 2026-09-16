/**
 * Ghi & doc collection `events`. Xem db-design.md va api-endpoints.md.
 */
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { CreateEventResponse, EventPayload } from '@gsm/shared';
import { EVENTS_COLLECTION, getDb } from '../db/firebase-admin.js';
import type { EventQuery } from '../validators/event.validator.js';

export async function createEvent(payload: EventPayload): Promise<CreateEventResponse> {
  const ref = await getDb()
    .collection(EVENTS_COLLECTION)
    .add({
      ...payload,
      // Hai field nay do SERVER tu gan — client gui len cung da bi validator loai.
      platform: 'web',
      created_at: FieldValue.serverTimestamp(),
    });

  return {
    event_id: ref.id,
    // XAP XI, lech vai mili-giay: serverTimestamp() chua co gia tri that luc .add() tra ve.
    // Gia tri chuan dung cho phan tich la field `created_at` trong Firestore.
    // Khong doc lai document — ton them 1 read ma client cung bo qua response.
    created_at: new Date().toISOString(),
  };
}

export async function listEvents(query: EventQuery): Promise<Record<string, unknown>[]> {
  let ref = getDb().collection(EVENTS_COLLECTION) as FirebaseFirestore.Query;

  if (query.sessionId) ref = ref.where('session_id', '==', query.sessionId);
  if (query.userId) ref = ref.where('user_id', '==', query.userId);
  if (query.flow) ref = ref.where('flow', '==', query.flow);
  if (query.from) ref = ref.where('created_at', '>=', Timestamp.fromDate(query.from));
  if (query.to) ref = ref.where('created_at', '<=', Timestamp.fromDate(query.to));

  /**
   * Loc theo session thi sap theo buoc (dung cho replay mot phien);
   * loc theo user thi sap TRONG BO NHO (xem duoi); con lai sap theo thoi gian.
   *
   * Vi sao user_id khong dung orderBy cua Firestore: mot where('==') cong mot
   * orderBy tren field KHAC se bi Firestore tu choi va bat tao composite index —
   * tuc nguoi chay du an phai bam link, doi index build, roi moi demo duoc.
   * Du lieu mot nguoi dung chi vai tram document nen sap trong JS re hon nhieu
   * so voi bat cau hinh them sau khi clone. Xem api-endpoints.md muc 3.
   */
  const sortInMemory = Boolean(query.userId) && !query.sessionId;
  if (!sortInMemory) {
    ref = query.sessionId ? ref.orderBy('step_index') : ref.orderBy('created_at');
  }

  const snapshot = await ref.get();

  const events = snapshot.docs.map((doc) => {
    const data = doc.data();
    const createdAt = data.created_at;
    return {
      id: doc.id,
      ...data,
      // Timestamp cua Firestore serialize ra JSON thanh {_seconds, _nanoseconds} —
      // pandas va jq deu khong doc duoc. Doi sang chuoi ISO ngay tai day.
      created_at: createdAt instanceof Timestamp ? createdAt.toDate().toISOString() : null,
    };
  });

  if (sortInMemory) {
    // created_at co the la null voi document vua ghi (serverTimestamp chua ket
    // thuc). Day chung xuong cuoi thay vi de String(null) xen vao giua.
    events.sort((a, b) => String(a.created_at ?? '￿').localeCompare(String(b.created_at ?? '￿')));
  }

  return events;
}
