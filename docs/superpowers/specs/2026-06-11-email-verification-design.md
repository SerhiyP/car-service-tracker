# Email Verification — Design

**Date:** 2026-06-11
**Status:** Approved

## 1. Overview

Add mandatory email verification to registration to prevent spam accounts. Unverified accounts cannot log in. Verification uses a 6-digit code sent by email via Brevo.

Decisions made during brainstorming:

- **Provider:** Brevo (free tier, 300 emails/day) — sends from a verified single sender address, no owned domain required. Resend was preferred but needs a verified domain; the `*.vercel.app` domain cannot be used for sending (no DNS control, Public Suffix List).
- **Strictness:** login is blocked until the email is verified.
- **Mechanism:** 6-digit code typed into a `/verify` page (chosen over a clickable link).

## 2. Flow

1. **Register** (`registerAction`): create the user with `emailVerified: null` and **remove the existing auto-login**. Generate a 6-digit code, store its hash, send the email via Brevo, then redirect to `/verify?email=<email>`.
2. **Verify** (`verifyEmailAction`): user submits email + code. On success: set `users.emailVerified = new Date()`, delete the code document, redirect to `/login` with a "verified — please sign in" success message. Auto-login after verification is not possible with the Credentials provider without re-sending the password; one manual login right after registering is acceptable.
3. **Login**: `authorize()` rejects unverified accounts with a distinct error code (a `CredentialsSignin` subclass), so the login form shows "email not verified" plus a path to `/verify` with a resend option — instead of the generic "invalid credentials".
4. **Resend** (`resendVerificationCodeAction`): generates a fresh code with a 60-second cooldown. Legacy accounts created before this feature (no `emailVerified` field) self-heal through this path: login fails as unverified → resend → verify. No migration script.

## 3. Data Model

New collection `verification_codes`:

```jsonc
{
  "_id": "ObjectId",
  "userId": "ObjectId",      // unique index
  "codeHash": "string",      // sha256(code)
  "expiresAt": "date",       // TTL index — Mongo auto-deletes expired docs
  "attempts": "number",      // wrong-code attempts so far
  "lastSentAt": "date"       // resend cooldown
}
```

`users` gains `emailVerified: Date | null`. Existing documents lack the field, which is treated the same as `null` (unverified) — they verify via the resend path.

**Indexes (added to `ensureIndexes`):** `verification_codes.userId` (unique), `verification_codes.expiresAt` (TTL, `expireAfterSeconds: 0`).

## 4. Security

A 6-digit code has only 10⁶ combinations, so guessing is mitigated by:

- **Expiry:** 15 minutes.
- **Attempt cap:** 5 wrong attempts invalidate the code (the document is deleted; the user must request a new code).
- **Hash at rest:** sha256. bcrypt was considered and rejected — against a 10⁶ keyspace it adds nothing; the attempt cap is the real defense.
- **Resend cooldown:** 60 seconds, enforced server-side via `lastSentAt`.
- Code generation uses `crypto.randomInt(0, 1_000_000)` zero-padded to 6 digits.

Email enumeration via these endpoints is not a concern: registration already returns a distinct `emailTaken` error.

## 5. Email Sending

`src/lib/email.ts` exposes `sendVerificationEmail(to: string, code: string, locale: string)` — a plain `fetch` POST to Brevo's transactional API (`https://api.brevo.com/v3/smtp/email`, `api-key` header). No SDK dependency. Subject and body are localized (en/uk) from the message catalogs.

**New env vars** (in `.env.local` and Vercel):

- `BREVO_API_KEY`
- `EMAIL_FROM` — the Brevo-verified sender address
- `EMAIL_FROM_NAME` — `Car Service Tracker` (matches the PWA manifest name)

A failed send during registration must not strand the account: the user lands on `/verify` regardless and can use the resend button.

**User setup step:** create a free Brevo account, verify a single sender address, create an API key.

## 6. UI & i18n

- New `(auth)/verify` page: email (prefilled from the query string) + 6-digit code form, resend button with visible cooldown, success redirects to `/login`.
- Register form: redirect to `/verify` instead of auto-login.
- Login form: on the unverified error, show a translated message with a link/button leading to `/verify` (resend available there).
- All new strings in `src/messages/en.json` and `uk.json` with identical key sets.

## 7. Error Handling

- All new actions use the existing `actionClient` / `ActionError` pattern with i18n-key messages (`auth.codeInvalid`, `auth.codeExpired`, `auth.tooManyAttempts`, `auth.resendCooldown`, `auth.emailNotVerified`, `auth.sendFailed`).
- Verify/resend actions are unauthenticated by design (the user cannot log in yet) and operate on the submitted email.
- `actionErrorKey()` continues to map results to toasts/inline errors on the client.

## 8. Testing

- Unit tests for code lifecycle logic: generation format, expiry check, attempt cap, cooldown.
- Schema tests for the verify input (email + exactly-6-digit code).
- The Brevo sender is mocked in all tests (no network).
- Component test for the verify form (submit, error rendering, resend cooldown state).
