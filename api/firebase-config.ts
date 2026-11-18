import type { VercelRequest, VercelResponse } from '@vercel/node';

function projectIdFromEmail(email: string): string {
  const match = email.match(/@([a-z0-9-]+)\.iam\.gserviceaccount\.com$/i);
  return match?.[1] ?? '';
}

function projectIdFromDomain(domain: string): string {
  const match = domain.match(/^([a-z0-9-]+)\.(?:firebaseapp\.com|web\.app)$/i);
  return match?.[1] ?? '';
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET required.' });

  // These are Firebase WEB identifiers intended to be available in a browser.
  // Never include private keys, Firebase Admin credentials, or model API keys.
  const authDomain = (process.env.FIREBASE_AUTH_DOMAIN ?? process.env.VITE_FIREBASE_AUTH_DOMAIN ?? '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  const config = {
    apiKey: (process.env.FIREBASE_API_KEY ?? process.env.VITE_FIREBASE_API_KEY ?? '').trim(),
    authDomain,
    projectId: (process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID ?? '').trim()
      || projectIdFromDomain(authDomain)
      || projectIdFromEmail(process.env.FIREBASE_CLIENT_EMAIL ?? ''),
    appId: (process.env.FIREBASE_APP_ID ?? process.env.VITE_FIREBASE_APP_ID ?? '').trim()
  };
  if (!Object.values(config).every(Boolean)) {
    return res.status(503).json({ error: 'Firebase public configuration is incomplete. Check this project’s environment variables.' });
  }
  return res.status(200).json(config);
}
