# AI Classroom

A shared AI classroom for South African Grade 10 Mathematics. One server-authoritative AI teacher broadcasts bounded teaching steps, spoken instructions and ordered whiteboard events to every participating learner.

## Implemented first slice

- React 19 + TypeScript + Vite responsive classroom, sign-in/register and parent-managed learner profiles.
- Firebase Authentication, Firestore listeners, restrictive rules and server-verified ID tokens.
- Administrator-controlled Grade 10 factorisation room with join, raise hand, moderated question queue, and one-step-at-a-time AI teaching using Vercel AI SDK + OpenRouter.
- Excalidraw scene reconstruction from validated ordered classroom events; browser speech synthesis, replay/mute, equation preview using KaTeX.
- Server-authoritative event sequence, request validation, lesson leases to avoid duplicate AI model calls, deterministic factorisation answer checking, and per-classroom usage limits.
- No payment processing, no raw voice storage, no generated mock AI responses.

## Getting started

Requirements: Node.js 22+, a Firebase project with Email/Password Auth and Firestore enabled, and an OpenRouter API key/model that supports structured output via the AI SDK. **The project is not plug-and-play without credentials.**

```bash
npm install
cp .env.example .env.local
# Fill VITE_FIREBASE_* values in .env.local
npm run dev
```

For local Vercel API functions, use the Vercel CLI (`vercel dev`) after setting server-side environment variables. `vite` on its own serves only the frontend (it does not serve `/api/classroom`).

Configure the backend environment:

- `FIREBASE_SERVICE_ACCOUNT_JSON` — service-account JSON in a server-only variable. Use the Firebase Admin SDK's managed service identity only in supported hosting environments.
- `OPENROUTER_API_KEY` — server-only credential.
- `OPENROUTER_MODEL` — choose a currently available model that supports structured output; free access is **not guaranteed**.
- `ADMIN_EMAILS` — comma-separated, **verified** Firebase Auth email accounts allowed to create and teach rooms. Or provision an `admin` custom claim securely.

Deploy `firestore.rules` to the intended Firebase project with the Firebase CLI after reviewing them. Rules must be active before users join classrooms. Frontend Firebase config is public, but the service account and AI key must **never** be prefixed with `VITE_` or committed.

## Demo walkthrough

1. Verify an admin email listed in `ADMIN_EMAILS`, then sign in and open **Admin**.
2. Create a Grade 10 Mathematics classroom; click **Start lesson**.
3. Log in to different parent accounts in separate browsers; create a learner profile for each and join the classroom.
4. As admin, choose **Teach next step**. The server calls a real model, validates the teaching action and writes one ordered event. All participants receive it via Firestore and see the same Excalidraw scene. Clients may render the speech with their own browser voices.
5. A learner raises a hand or asks a text question. The admin clicks the next step to let the AI answer queued questions before progressing.
6. Continue to the exercise; each learner submits `(x+2)(x+3)` or another answer. The deterministic checker provides feedback. Continue for the summary.

The admin explicitly advances steps, so the platform does not silently burn inference quota or operate a long-running worker on Vercel.

## Architecture

```
Browser → Firebase Auth → authenticated /api/classroom → Firebase Admin / Firestore
                                  ↓
                         Vercel AI SDK → OpenRouter
                                  ↓
                      Zod-validated teacher actions
                                  ↓
             transactional ordered classroom event log
                                  ↓
              all joined browsers → Excalidraw + speech
```

Firestore `classrooms/{id}/events/{paddedSequence}` maintains a replayable append-only log. `members/{uid}` records authorization; parent-owned child profiles are not visible to other parents. Room writes, question processing, assessment writes and AI orchestration are server-only.

## Important gaps before production

- Requires live credentials, Firebase rules deployment, `npm install` and browser-level integration verification. These have **not** been completed by this scaffold.
- Students hear local browser-generated speech, which is **not sample-synchronised** and varies across devices. No premium Fish Audio integration yet.
- Parent dashboard is limited to learner profiles; private tutoring, usage ledger, subscriptions and payments are not yet implemented.
- The seeded mathematics exercise is a narrow example. Content needs review against an authoritative CAPS source before marketing official curriculum coverage.
- Concurrency, rate limiting, content moderation, Firestore security-rules emulation, deletion/retention policies and POPIA-specific legal review need further work. The current lease prevents duplicate *completed* lesson steps but is not a substitute for durable task processing.
- Grade 10 lesson endpoints and AI teacher responses require professional pedagogical and safeguarding review before children use the system.

## Local checks

```bash
npm test
npm run typecheck
npm run build
```

No automatic deployment or paid service usage is performed by this repository.


## Vercel environment variables and signup

The Vercel app may use server-only variables FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN,
FIREBASE_APP_ID and FIREBASE_CLIENT_EMAIL. The public /api/firebase-config route
exposes ONLY browser-safe Firebase configuration. The project ID is inferred from
the standard *.firebaseapp.com auth domain or service-account client email.
Alternatively, local development may set VITE_FIREBASE_*.

Firebase Admin uses FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_CLIENT_EMAIL +
FIREBASE_PRIVATE_KEY (+ optional FIREBASE_PROJECT_ID). Private keys must stay
server-side. Encrypted/sensitive variables are not readable in browser JavaScript.

1. In Firebase Console, enable **Authentication → Sign-in method → Email/Password**.
2. Add the production domain to **Authentication → Settings → Authorized domains**.
3. Create a Cloud Firestore database, and deploy the included firestore.rules.
4. For classroom administration, configure ADMIN_EMAILS to the verified owner account.
5. On Vercel, use a public Production deployment; keep Preview protected if desired.
6. Confirm GET /api/firebase-config returns HTTP 200 (public Firebase web config).
   Do not share this endpoint's returned API key in support screenshots.
7. Create a parent account, sign out, sign back in, and use Forgot password to test
   the email workflow. Do not use real children's data during testing.

Updating Vercel variables normally requires a new production deployment to take
effect. If registration reports auth/operation-not-allowed, enable Email/Password
in Firebase Console. If it reports auth/unauthorized-domain, add the Vercel
production hostname to authorized domains in Firebase Console.
