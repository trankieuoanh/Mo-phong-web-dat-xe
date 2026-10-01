/**
 * Ghi `users/{phone}` sau khi dang nhap — BEST EFFORT.
 *
 * Firestore het quota hay mat mang thi van cho dang nhap: doc `users` chi la
 * so sach (lan dau / lan cuoi dang nhap), khong phai dieu kien xac thuc.
 */
import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { USERS_COLLECTION, getDb } from '../db/firebase-admin';

export async function recordLogin(phone: string): Promise<void> {
  const ref = getDb().collection(USERS_COLLECTION).doc(phone);
  // Hai lenh ghi, khong doc: `create` chi thanh cong lan dau (giu created_at),
  // `set merge` cap nhat last_login_at. Tiet kiem luot doc — thu dang het.
  await ref
    .create({ phone, created_at: FieldValue.serverTimestamp() })
    .catch(() => {});
  await ref.set({ phone, last_login_at: FieldValue.serverTimestamp() }, { merge: true });
}
