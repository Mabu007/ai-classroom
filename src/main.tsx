import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/app.css';
import 'katex/dist/katex.min.css';

type FirebaseWebConfig = { apiKey: string; authDomain: string; projectId: string; appId: string };
type RuntimeGlobal = typeof globalThis & { __AI_CLASSROOM_FIREBASE_CONFIG__?: FirebaseWebConfig };

const root = createRoot(document.getElementById('root')!);

async function start() {
  try {
    // Local development can use VITE_* values; deployed projects can use server runtime config.
    let config: FirebaseWebConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
      appId: import.meta.env.VITE_FIREBASE_APP_ID ?? ''
    };
    if (!Object.values(config).every(Boolean)) {
      const response = await fetch('/api/firebase-config', { cache: 'no-store' });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = body && typeof body === 'object' && 'error' in body
          ? String((body as { error: unknown }).error)
          : 'Unable to load the classroom configuration.';
        throw new Error(message);
      }
      config = body as FirebaseWebConfig;
    }
    if (!config || !Object.values(config).every(value => typeof value === 'string' && !!value)) {
      throw new Error('Firebase configuration is incomplete.');
    }
    (globalThis as RuntimeGlobal).__AI_CLASSROOM_FIREBASE_CONFIG__ = config;
    // Import only after the Firebase config is available; App imports Firebase modules.
    const { default: App } = await import('./App');
    root.render(<React.StrictMode><App /></React.StrictMode>);
  } catch (error) {
    console.error('Classroom startup failed:', error instanceof Error ? error.message : 'Unknown error');
    root.render(
      <main className="center-state" role="alert">
        <h1>Classroom temporarily unavailable</h1>
        <p>We couldn't connect to the classroom right now. Please try again.</p>
        <button className="btn primary" onClick={() => window.location.reload()}>Try again</button>
      </main>
    );
  }
}
void start();
