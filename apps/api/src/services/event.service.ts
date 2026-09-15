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
  if (query.flow) ref = ref.where('flow', '==', query.flow);
  if (query.from) ref = ref.where('created_at', '>=', Timestamp.fromDate(query.from));
  if (query.to) ref = ref.where('created_at', '<=', Timestamp.fromDate(query.to));

  // Loc theo session thi sap theo buoc (dung cho replay mot phien);
  // con lai sap theo thoi gian.
  ref = query.sessionId ? ref.orderBy('step_index') : ref.orderBy('created_at');

  const snapshot = await ref.get();

  return snapshot.docs.map((doc) => {
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
}
