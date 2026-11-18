import { cert, getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import type { ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function projectIdFromEmail(email: string) {
  return email.match(/@([a-z0-9-]+)\.iam\.gserviceaccount\.com$/i)?.[1];
}

function initialize() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    return initializeApp({ credential: cert(JSON.parse(json) as ServiceAccount) });
  }
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim()
    || (clientEmail ? projectIdFromEmail(clientEmail) : undefined);
  if (clientEmail && privateKey && projectId) {
    return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
  }
  // Google Application Default Credentials only work when the host provides them.
  return initializeApp({ credential: applicationDefault(), projectId: process.env.GCLOUD_PROJECT });
}

export function adminServices() {
  if (!getApps().length) initialize();
  return { adminAuth: getAuth(), store: getFirestore() };
}

export function isAdmin(user: { email?: string; email_verified?: boolean; admin?: boolean }) {
  if (user.admin === true) return true;
  const emails = (process.env.ADMIN_EMAILS ?? '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
  return !!user.email_verified && !!user.email && emails.includes(user.email.toLowerCase());
}
