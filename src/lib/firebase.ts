import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};
export const configured = Object.values(config).every(Boolean);
// No demo data is silently substituted for missing credentials.
const app = initializeApp(configured ? config : { apiKey: 'unset', authDomain: 'unset.invalid', projectId: 'unset', appId: 'unset' });
export const auth = getAuth(app);
export const db = getFirestore(app);
