# Google-only authentication

**Date:** 2026-06-12
**Status:** Approved design, pending implementation

## Problem

Registration and password reset depend on emailed verification codes sent
through Brevo, whose account/sender setup has been unreliable friction on
Vercel. The app runs on a `vercel.app` subdomain, so providers that require a
verified custom domain (Resend, Postmark, Mailgun, SES) are not options. All
real users are on Gmail.

## Decision

Replace credentials auth entirely with Google sign-in. This removes the email
dependency (codes, resets, Brevo) instead of patching around it. Alternatives
considered and rejected:

- **Switch to Resend** — requires a custom domain we don't have; without one it
  can only send to the account owner's address.
- **Google alongside credentials** — keeps the broken email path alive for
  registration/reset; no benefit given the user base is Google-only.

## Architecture

### Provider & session (`src/auth.ts`, `src/auth.config.ts`)

- `src/auth.ts` replaces the Credentials provider with Auth.js v5's `Google`
  provider. Env vars use the Auth.js conventions `AUTH_GOOGLE_ID` and
  `AUTH_GOOGLE_SECRET` (auto-detected, no explicit config needed).
- Session strategy stays **JWT** — no DB adapter. Rolling-session settings in
  `auth.config.ts` are unchanged.
- The `jwt` callback is overridden in `src/auth.ts` (the DB-capable side of the
  split config): on initial sign-in (`user` present), it **finds-or-creates** a
  `users` document by lowercased email and sets `token.id` to the Mongo
  `_id` hex string. All downstream consumers (`session` callback,
  `authActionClient`'s `ctx.userId`, repositories) keep working unchanged.
- `src/proxy.ts` keeps using the DB-free `authConfig` — it only verifies the
  JWT, which already carries `id`. Its `AUTH_PAGES` list shrinks to
  `["/login"]`.
- Existing account migration is automatic: signing in with Google using the
  same email matches the existing `users` doc by email, so all cars/visits
  (keyed by that `_id`) are preserved. No data migration runs.

### Repository (`src/lib/repositories/users.ts`)

- `UserDoc` becomes `{ _id, email, name }`. `passwordHash` and `emailVerified`
  are removed from the type; stale fields on existing documents are simply
  ignored (no cleanup migration).
- New `findOrCreateUserByEmail(input: { email; name }): Promise<string>` —
  lowercases the email, returns the existing doc's id or inserts a new doc.
  Uses an upsert (or insert with duplicate-key fallback, matching the current
  `registerAction` pattern) so concurrent first sign-ins are safe.
- Removed: `createUser`, `markEmailVerified`, `updateUserPassword`.
- `deleteUserCascade` drops the `deleteCodeForUser` call (collection gone).

### Actions (`src/actions/auth.ts`)

Shrinks to three exports:

- `loginWithGoogleAction` — server action invoked by the login button; calls
  `signIn("google", { redirectTo: "/" })`. (Plain server action, no
  `actionClient` needed — no input, no structured result.)
- `logoutAction` — unchanged.
- `deleteAccountAction` — unchanged apart from the cascade simplification.

Removed: `registerAction`, `loginAction`, `verifyEmailAction`,
`resendVerificationCodeAction`, `requestPasswordResetAction`,
`resetPasswordAction`, and all their result types.

### UI

- `/login` page: replaces the email/password form with a single
  **Continue with Google** button inside the existing `(auth)` layout —
  a form whose action is `loginWithGoogleAction`. Reads the `error` search
  param (a Promise — awaited) and renders a translated generic error message
  when present.
- Deleted pages: `/register`, `/verify`, `/forgot` (and their routes from
  `AUTH_PAGES`).
- Deleted components (+ tests): `login-form.tsx` (replaced),
  `register-form.tsx`, `verify-form.tsx`, `verify-form.test.tsx`,
  `forgot-form.tsx`, `forgot-form.test.tsx`.

### Deleted modules

- `src/lib/email.ts`, `src/lib/email.test.ts`
- `src/lib/verification.ts`, `src/lib/verification.test.ts`
- `src/lib/verification-flow.ts`, `src/lib/verification-flow.test.ts`
- `src/lib/repositories/verification-codes.ts`
- `src/lib/schemas/auth.ts` (all five schemas; prune related cases from
  `schemas.test.ts`)

### i18n (`src/messages/en.json`, `src/messages/uk.json`)

- Remove all keys used only by register/verify/forgot/code flows
  (subjects/bodies for emails, code validation, cooldown strings, etc.).
- Add keys for the Google button and the login error message
  (e.g. `auth.continueWithGoogle`, `auth.googleSignInFailed`).
- The two files keep identical key sets (existing convention).

### Environment

- **Added:** `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` (local `.env.local` and
  Vercel). `AUTH_SECRET` already exists.
- **Removable after deploy:** `BREVO_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME`.

## Error handling

- Google OAuth failure or user cancel → Auth.js redirects to
  `/login?error=...`; the login page shows one generic translated error line.
  No per-error-code branching (YAGNI).
- DB failure inside the `jwt` callback find-or-create → throw; Auth.js treats
  it as a failed sign-in and redirects to `/login?error=...`. A session is
  never issued without a valid Mongo id in `token.id`.

## Manual setup (one-time, done by the owner)

1. Google Cloud Console → create project (or reuse) → OAuth consent screen
   (External, app name, your email; publish the app so any Google account can
   sign in).
2. Credentials → Create OAuth client ID (Web application) with authorized
   redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<app>.vercel.app/api/auth/callback/google`
3. Put client id/secret into `.env.local` and Vercel project env vars as
   `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.

## Testing

- **Unit:** the `jwt`-callback find-or-create logic — existing user matched by
  email (case-insensitive), new user created with name/email, DB error
  propagates. Repository itself stays untested per convention; the callback
  test mocks the repo.
- **Component:** new login button component test following the
  `verify-form.test.tsx` pattern (real `NextIntlClientProvider` + en catalog;
  asserts the action is invoked and the error param renders the message).
- **Gates:** `npx vitest run`, `npx tsc --noEmit`, `npx eslint src`,
  `npm run build` all pass.
- **Manual:** local sign-in with the owner's Google account lands on the
  garage with existing cars visible (proves email-match migration).

## Out of scope

- Cleaning stale `passwordHash`/`emailVerified` fields or the
  `verification_codes` collection from the production DB (harmless leftovers;
  can be dropped manually later).
- Supporting non-Google users or a second OAuth provider.
- Account linking UI (email match is the only linking mechanism).