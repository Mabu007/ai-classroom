import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

type FirebaseWebConfig = { apiKey: string; authDomain: string; projectId: string; appId: string };
type RuntimeGlobal = typeof globalThis & { __AI_CLASSROOM_FIREBASE_CONFIG__?: FirebaseWebConfig };

const config: FirebaseWebConfig = (globalThis as RuntimeGlobal).__AI_CLASSROOM_FIREBASE_CONFIG__ ?? {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? ''
};
export const configured = Object.values(config).every(Boolean);
if (!configured) throw new Error('Firebase public configuration must be provided before loading the classroom.');
const app = getApps().length ? getApp() : initializeApp(config);
export const auth = getAuth(app);
export const db = getFirestore(app);
