import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminServices } from '../server/firebase-admin.js';

// Temporary, non-mutating deployment diagnostic; remove after a single verification.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET required.' });
  const key = process.env.FIREBASE_API_KEY ?? process.env.VITE_FIREBASE_API_KEY;
  if (!key) return res.status(503).json({ error: 'Web config unavailable.' });

  async function probe(method: 'signUp' | 'signInWithPassword', password: string) {
    try {
      const response = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:' + method + '?key=' + encodeURIComponent(key), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'ai-classroom-diagnostic-never-a-real-user@invalid.example',
          password,
          returnSecureToken: true
        }),
        signal: AbortSignal.timeout(7000)
      });
      const data = await response.json() as { error?: { message?: string } };
      return { httpStatus: response.status, firebaseError: String(data.error?.message ?? 'UNEXPECTED_SUCCESS').split(' ')[0] };
    } catch {
      return { httpStatus: 0, firebaseError: 'UPSTREAM_UNAVAILABLE' };
    }
  }
  const [register, login] = await Promise.all([probe('signUp', 'x'), probe('signInWithPassword', 'this-is-not-a-real-password')]);
  let admin = 'unknown'; let firestore = 'unknown';
  try {
    const services = adminServices();
    await services.adminAuth.listUsers(1);
    admin = 'ok';
    await services.store.collection('classrooms').limit(1).get();
    firestore = 'ok';
  } catch {
    admin = admin === 'ok' ? 'ok' : 'unavailable';
    firestore = 'unavailable';
  }
  res.status(200).json({ register, login, admin, firestore });
}
