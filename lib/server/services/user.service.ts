/**
 * Ghi `users` sau khi dang nhap — BEST EFFORT.
 *
 * D1 het han muc hay mat mang thi van cho dang nhap: dong `users` chi la so sach
 * (lan dau / lan cuoi dang nhap), khong phai dieu kien xac thuc.
 */
import 'server-only';
import { d1Query } from '../db/d1';

export async function recordLogin(phone: string): Promise<void> {
  const now = `${new Date().toISOString().slice(0, 23)}000Z`;
  // Mot lenh: chen moi (created_at = lan dau), hoac chi cap nhat last_login_at neu da co.
  await d1Query(
    `INSERT INTO users (phone, created_at, last_login_at) VALUES (?, ?, ?)
     ON CONFLICT(phone) DO UPDATE SET last_login_at = excluded.last_login_at`,
    [phone, now, now],
  );
}
