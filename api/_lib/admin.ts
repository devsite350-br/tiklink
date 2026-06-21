// Firebase Admin SDK initialization for Vercel Serverless Functions.
//
// The service account is provided via the FIREBASE_SERVICE_ACCOUNT env var.
// It may be either raw JSON or (recommended) base64-encoded JSON so it survives
// being pasted into the Vercel dashboard without newline issues.
import { cert, getApps, initializeApp, App, ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const loadServiceAccount = (): ServiceAccount => {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not set');
  }
  const text = raw.trim().startsWith('{')
    ? raw
    : Buffer.from(raw, 'base64').toString('utf8');
  return JSON.parse(text) as ServiceAccount;
};

let app: App;
if (getApps().length) {
  app = getApps()[0];
} else {
  app = initializeApp({ credential: cert(loadServiceAccount()) });
}

export const adminApp = app;
export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
export { FieldValue } from 'firebase-admin/firestore';
