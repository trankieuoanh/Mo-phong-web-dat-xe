/**
 * Noi DUY NHAT trong toan du an cam credential Firestore.
 *
 * `import 'server-only'` o ngay duoi day KHONG phai trang tri. Truoc day giao
 * dien va backend la hai package rieng, nen hang rao la vat ly: package giao
 * dien khong co `firebase-admin` trong dependencies, muon import file nay cung
 * khong noi. Gop ve mot project thi hang rao do bien mat — moi thu nam chung
 * mot module graph.
 *
 * `server-only` dung lai dung hang rao ay o mot cho khac: file nao keo module
 * nay vao mot Client Component se HONG NGAY LUC BUILD, khong phai lo ra luc
 * chay. Xem CLAUDE.md quy tac 1.
 */
import 'server-only';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

export const EVENTS_COLLECTION = 'events';

let firestore: Firestore | null = null;

function readCredentials() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  const missing = [
    !projectId && 'FIREBASE_PROJECT_ID',
    !clientEmail && 'FIREBASE_CLIENT_EMAIL',
    !privateKey && 'FIREBASE_PRIVATE_KEY',
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(
      `Thieu bien moi truong Firebase: ${missing.join(', ')}. ` +
        'Copy .env.example thanh .env.local roi dien gia tri (xem setup.md Phase 1).',
    );
  }

  return {
    projectId: projectId!,
    clientEmail: clientEmail!,
    // Trong file .env ky tu xuong dong nam o dang literal `\n`.
    // Thieu dong replace nay se loi: error:1E08010C:DECODER routines::unsupported
    privateKey: privateKey!.replace(/\\n/g, '\n'),
  };
}

function getApp(): App {
  // Hot-reload cua `next dev` chay lai module nhieu lan trong cung mot tien
  // trinh. Goi initializeApp() thang se nem "The default Firebase app already
  // exists" ngay lan sua file thu hai. (Ly do nay truoc day la `tsx watch`;
  // doi runtime nhung cai bay thi y nguyen.)
  return getApps()[0] ?? initializeApp({ credential: cert(readCredentials()) });
}

/**
 * Khoi tao tre (lazy): GET /api/health phai tra loi duoc ngay ca khi chua co
 * credential. Do la ca muc dich cua route do — xac nhan app song TRUOC khi
 * Firebase vao cuoc, de hai loai loi khong tron vao nhau.
 */
export function getDb(): Firestore {
  if (!firestore) firestore = getFirestore(getApp());
  return firestore;
}
