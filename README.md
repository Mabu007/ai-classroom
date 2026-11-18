# Speech Gym

**Train your voice. Sharpen your mind.**

Speech Gym is a private, adult-only speaking practice app, replacing the previous AI Classroom interface. Discover curated experiences, speak to fictional characters, receive transcript-grounded feedback, and retry with a specific next rep.

**Production:** https://official-ai-classroom.vercel.app (legacy hostname until a Speech Gym domain is configured).

## Experience

1. Sign in or register, and confirm you are 18 or older.
2. Browse 18 original curated experiences across eight categories.
3. Pick one. The character's opening is curated, free of model latency, and played using browser speech synthesis.
4. Grant microphone access. Browser Speech Recognition transcribes the participant. Use Type instead on unsupported browsers.
5. Character responses use the configured server-side OpenRouter model. If it is unavailable, the app clearly identifies a GUIDED PROMPT instead of fabricating an AI response.
6. Finish after six turns or end early. Coaching uses only observable transcript evidence, with a transparent non-AI fallback.
7. Retry or view your results in My Sessions.

No raw microphone audio is saved by Speech Gym. Browser speech recognition may rely on the browser provider's speech services. The transcribed speech is sent to an AI provider to generate responses and feedback. Transcript storage is off by default and opt-in via Profile.

## Architecture

- Frontend: React, TypeScript, Vite, responsive CSS artwork (original silhouettes; no external celebrity imagery).
- Authentication: Firebase Auth email/password.
- Server: Vercel Function api/speech-gym.ts with verified Firebase ID tokens, Zod validation and Firebase Admin.
- Catalogue: shared/catalog.mjs with versioned challenge definitions and fictional personas.
- AI: Vercel AI SDK and OpenRouter, bounded responses with explicit guided fallback.
- Voice: browser Speech Recognition plus speech synthesis, user-initiated microphone permissions, typed fallback, and mic activity meter.
- Storage: speechGymProfiles, speechGymSessions and speechGymUsage Firestore collections, server access only. No direct browser writes.
- Coaching: server/speech-coach.mjs, transcript-grounded, no objective confidence or accent score.

## Configuration

Node.js 22.x, Firebase Email/Password Auth and Firestore enabled.
Server environment: FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, optionally FIREBASE_PROJECT_ID, OPENROUTER_API_KEY and OPENROUTER_MODEL. An alternative is FIREBASE_SERVICE_ACCOUNT_JSON.

Browser Firebase identifiers: VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID for local Vite. Vercel production can supply FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN and FIREBASE_APP_ID through the safe public api/firebase-config endpoint.

Never expose service-account or AI model keys to the frontend.

Local commands: npm install, npm test, npm run typecheck, npm run build.
Use vercel dev to run both the API and frontend with environment variables. Running vite alone does not serve the Vercel API.

## Safeguards

- Private adult-only beta with 18+ self-attestation; minors are not supported before guardian consent and age-appropriate safeguards.
- Fictional characters only. No public profiles, social feeds or multiplayer.
- No raw audio recordings. Saved transcripts are optional and off by default.
- Up to six participant turns and 15 session starts per UTC day; generation outputs are bounded.
- Delete individual sessions or speaking history through the Profile and My Sessions interface.
- Account deletion removes the login and Speech Gym records. Existing AI Classroom historical records may require separate deletion.
- No paid services were subscribed to. The preconfigured AI provider may incur API usage depending on its model plan.
- Actual speech capture and speech synthesis vary by browser; Chrome and Edge offer the best chances of native speech recognition.

## Testing and remaining QA

Node unit tests validate catalogue coverage, unique versioned challenges, bounded context, and defensible review observations. Builds must pass tests, TS checks and Vite bundling.

Still required for production readiness: an authenticated Chromium/mobile voice workout test (microphone, six turns, evaluation and retry), multi-browser microphone permission tests, provider-specific AI quality tests, and explicit Firestore rules deployment confirmation. The original GitHub browser runner did not allocate a runner, so no automated real-mic acceptance result should be claimed.

## Migration

This is a functional product pivot, not a CSS-only redesign. Old classroom-specific source code and API routes have been retired from new releases, but historical Firebase accounts and data were not deleted. The old source remains recoverable in Git history.

North star: **Open → Choose → Speak → Get coached → Retry**.
