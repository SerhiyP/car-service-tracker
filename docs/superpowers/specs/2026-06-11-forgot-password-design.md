# Forgot Password Flow — Design

**Date:** 2026-06-11
**Status:** Approved (continue on `feature/ui-refresh-warm-minimal`)

## Goal

Let a user who forgot their password set a new one via an emailed 6-digit
code, reusing the existing email-verification machinery (codes repository,
cooldown/attempt limits, Brevo sending, verify-form UX patterns).

## Why a code, not a magic link

The app is an installable PWA; emailed links open in the default browser, not
the installed app context. Codes avoid that and reuse everything already
built: `verification_codes` collection with TTL/attempts/cooldown, the Brevo
sender, and the two-field verify form UX.

## User flow

1. `/login` shows a **Forgot password?** link (below the password field) →
   navigates to `/forgot`, carrying the typed email as `?email=` when present.
2. `/forgot` — one client form, two stages:
   - **Stage "request":** email input + submit. On success the form advances
     to stage "reset" and starts the 60s resend countdown.
   - **Stage "reset":** email (editable), code input (6 digits, same
     attributes as verify form), new-password input (`min 8 / max 200`,
     same as registration), submit, and a resend button with cooldown timer.
3. On successful reset → `router.push("/login?reset=1")`; the login page
   shows a green "Password updated — please sign in" banner (mirrors
   `?verified=1`).

## Server design

### Data: `verification_codes` gains `purpose`

- `VerificationCodeDoc` gets `purpose: "verify" | "reset"`.
- The unique-per-user index is unchanged — one active code per user
  regardless of purpose; issuing a reset code replaces a pending verify code
  and vice versa (acceptable for this app; avoids an index migration).
- Existing docs without `purpose` are treated as `"verify"` (default when
  reading).

### `src/lib/verification.ts`

- `issueCode(userId, email, purpose)` — purpose selects the email template;
  cooldown/TTL/hashing unchanged. Existing call sites pass `"verify"`.
- New shared helper `consumeCode(user, code, purpose)` extracted from
  `verifyEmailAction`'s checking block. Returns a discriminated union:
  `{ status: "ok" } | { status: "codeInvalid"; attemptsLeft } |
  { status: "tooManyAttempts" } | { status: "codeExpired" } |
  { status: "noActiveCode" }`. A code with a different `purpose` counts as
  `noActiveCode`. On `"ok"` the code is deleted.

### `src/lib/email.ts`

- Extract the Brevo POST into a private `sendEmail(to, subject, text)`;
  keep `sendVerificationEmail(to, code, locale)` and add
  `sendPasswordResetEmail(to, code, locale)` using new i18n keys.

### Actions (`src/actions/auth.ts`, both `actionClient`)

- `requestPasswordResetAction({ email })` → reuses the resend pattern:
  - unknown email → throw `ActionError("auth.emailNotFound")` (consistent
    with `resendVerificationCodeAction`; the app already discloses account
    existence at registration).
  - send failure → delete code, throw `ActionError("auth.sendFailed")`.
  - Returns `{ status: "sent"; retryAfterSec } | { status: "cooldown";
    retryAfterSec }`.
- `resetPasswordAction({ email, code, newPassword })`:
  - unknown email → `ActionError("auth.emailNotFound")`.
  - `consumeCode(user, code, "reset")`; non-`ok` statuses pass through in the
    result union (same client handling as verify form).
  - On ok: bcrypt-hash (10 rounds) → update `passwordHash`; if
    `emailVerified` is unset, set it (code receipt proves mailbox ownership);
    return `{ status: "reset" }`.

### Schemas (`src/lib/schemas/auth.ts`)

```ts
requestPasswordResetSchema = { email }
resetPasswordSchema = { email, code: /^\d{6}$/, newPassword: min 8 / max 200 }
```

## UI

- `src/app/(auth)/forgot/page.tsx` — server page reading `?email=`,
  rendering `ForgotForm` (mirrors `/verify` page).
- `src/components/auth/forgot-form.tsx` — two-stage client form modeled on
  `verify-form.tsx`: same feedback discriminated union + locked state +
  cooldown countdown; adds the new-password field in stage "reset".
- `src/components/auth/login-form.tsx` — "Forgot password?" link + `reset=1`
  success banner; `/login/page.tsx` passes the new query param.

## i18n (both `en.json` and `uk.json`)

New `auth.*` keys: `forgotPassword`, `forgotTitle`, `forgotInstructions`,
`sendCode`, `newPassword`, `resetPassword`, `resetEmailSubject`,
`resetEmailBody`, `resetNowLogin`. Reuse existing: `code`, `resendCode`,
`resendIn`, `codeSent`, `codeInvalidAttempts`, `tooManyAttempts`,
`codeExpired`, `noActiveCode`, `emailNotFound`, `sendFailed`.

## Out of scope

- Invalidating existing JWT sessions after a reset.
- Password strength meter; rate limiting beyond the existing 60s cooldown.
- Email template styling (plain text like the verify email).

## Testing

- `consumeCode` unit tests (purpose mismatch, expiry, attempts, ok-path
  deletion) — extend `src/lib/verification.test.ts` patterns.
- `forgot-form` component test mirroring `verify-form.test.tsx`: stage
  advance on sent, reset success → router push `/login?reset=1`, invalid
  code feedback, locked state.
- i18n key parity check; full gate (vitest, tsc, eslint, build).
