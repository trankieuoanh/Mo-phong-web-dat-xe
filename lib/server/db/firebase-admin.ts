/**
 * Noi DUY NHAT trong toan monorepo cam credential Firestore.
 *
 * apps/web khong co `firebase-admin` trong dependencies, nen khong import
 * duoc file nay du co co tinh — xem CLAUDE.md quy tac 1.
 */
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
        'Copy apps/api/.env.example thanh apps/api/.env roi dien gia tri (xem setup.md Phase 1).',
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
  // `tsx watch` chay lai module nhieu lan trong cung mot tien trinh.
  // Goi initializeApp() thang se nem "The default Firebase app already exists"
  // ngay lan sua file thu hai.
  return getApps()[0] ?? initializeApp({ credential: cert(readCredentials()) });
}

/**
 * Khoi tao tre (lazy): GET /api/health phai tra loi duoc ngay ca khi chua co
 * credential. Do la ca muc dich cua route do — xac nhan server song TRUOC khi
 * Firebase vao cuoc, de loi Express va loi Firebase khong tron vao nhau.
 */
export function getDb(): Firestore {
  if (!firestore) firestore = getFirestore(getApp());
  return firestore;
}
