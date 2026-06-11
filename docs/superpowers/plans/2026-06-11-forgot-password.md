# Forgot Password Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Password reset via emailed 6-digit code, reusing the email-verification machinery (codes repo, cooldown/attempts, Brevo, verify-form UX).

**Architecture:** `verification_codes` docs gain a `purpose` ("verify"/"reset"; one active code per user, unique index unchanged). Code issue/consume logic moves to a new testable module `src/lib/verification-flow.ts` (a `"use server"` file may only export actions, so shared helpers can't live in `src/actions/auth.ts`). Two new public actions follow the existing discriminated-union style. New `/forgot` page with a two-stage client form modeled on `verify-form.tsx`. Spec: `docs/superpowers/specs/2026-06-11-forgot-password-design.md`. Branch: `feature/ui-refresh-warm-minimal`.

**Tech Stack:** Next.js 16, Auth.js v5 credentials, next-safe-action (`actionClient` + `ActionError("<i18n key>")`), mongodb driver, bcryptjs, Brevo transactional email, next-intl (en/uk parity REQUIRED), Vitest + Testing Library.

**Project rules (AGENTS.md):** read `node_modules/next/dist/docs/` when unsure (Next 16 differs from training data); en/uk identical key sets; done = `npx vitest run` && `npx tsc --noEmit && npx eslint src` && `npm run build`; never use MongoDB MCP tools.

---

### Task 1: i18n keys (both catalogs)

**Files:**
- Modify: `src/messages/en.json` (`"auth"` section)
- Modify: `src/messages/uk.json` (`"auth"` section)

- [ ] **Step 1: Add to `en.json` `"auth"`, after `"verifyNow": "Verify now"`:**

```json
"forgotPassword": "Forgot password?",
"forgotTitle": "Reset your password",
"forgotInstructions": "Enter your account email and we'll send a 6-digit code.",
"sendCode": "Send code",
"newPassword": "New password",
"resetPassword": "Set new password",
"resetEmailSubject": "Your Car Service Tracker password reset code",
"resetEmailBody": "Your password reset code is {code}. It expires in 15 minutes.",
"resetNowLogin": "Password updated — please sign in"
```

- [ ] **Step 2: Add to `uk.json` `"auth"`, same position:**

```json
"forgotPassword": "Забули пароль?",
"forgotTitle": "Відновлення пароля",
"forgotInstructions": "Вкажіть email вашого акаунта — ми надішлемо 6-значний код.",
"sendCode": "Надіслати код",
"newPassword": "Новий пароль",
"resetPassword": "Встановити новий пароль",
"resetEmailSubject": "Код відновлення пароля Car Service Tracker",
"resetEmailBody": "Ваш код відновлення пароля: {code}. Він діє 15 хвилин.",
"resetNowLogin": "Пароль оновлено — увійдіть"
```

- [ ] **Step 3: Verify parity**

Run: `node -e "const en=require('./src/messages/en.json'),uk=require('./src/messages/uk.json');const k=o=>Object.entries(o).flatMap(([s,v])=>Object.keys(v).map(x=>s+'.'+x)).sort();const a=k(en),b=k(uk);console.log(JSON.stringify(a)===JSON.stringify(b)?'OK':'MISMATCH: '+a.filter(x=>!b.includes(x)).concat(b.filter(x=>!a.includes(x))).join(', '))"`
Expected: `OK`. Also `npx vitest run` (tests import en.json) — all pass.

- [ ] **Step 4: Commit**

```bash
git add src/messages/en.json src/messages/uk.json
git commit -m "feat: i18n keys for password reset flow"
```

---

### Task 2: Groundwork — purpose field, password update, reset email, schema

**Files:**
- Modify: `src/lib/repositories/verification-codes.ts`
- Modify: `src/lib/repositories/users.ts`
- Modify: `src/lib/email.ts`
- Modify: `src/lib/email.test.ts`
- Modify: `src/lib/schemas/auth.ts`

- [ ] **Step 1: Add a failing test for the reset email**

In `src/lib/email.test.ts`, add inside the existing `describe` (it already stubs env in `beforeEach`; mirror the existing "posts a localized email to Brevo" test):

```ts
it("posts a localized password reset email to Brevo", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
  vi.stubGlobal("fetch", fetchMock);

  await sendPasswordResetEmail("user@example.com", "654321", "en");

  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  const body = JSON.parse(init.body as string);
  expect(body.subject).toBe("Your Car Service Tracker password reset code");
  expect(body.textContent).toContain("654321");
});
```

Update the import line: `import { sendPasswordResetEmail, sendVerificationEmail } from "./email";`

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/email.test.ts`
Expected: FAIL — `sendPasswordResetEmail` is not exported.

- [ ] **Step 3: Refactor `src/lib/email.ts`**

Replace the file body so both senders share the translator and the Brevo POST (keep the existing doc comment spirit):

```ts
import { createTranslator } from "next-intl";
import { defaultLocale, locales, type Locale } from "@/i18n/config";

async function translatorFor(locale: string) {
  // Whitelist-validate: `locale` feeds a dynamic import path.
  const safeLocale: Locale = (locales as readonly string[]).includes(locale)
    ? (locale as Locale)
    : defaultLocale;
  const messages = (await import(`../messages/${safeLocale}.json`)).default;
  return createTranslator({ locale: safeLocale, messages });
}

/**
 * Sends via Brevo's transactional API. Plain fetch — no SDK. Throws on
 * missing config or non-2xx response; callers decide whether that is fatal.
 */
async function sendEmail(to: string, subject: string, textContent: string): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey) throw new Error("BREVO_API_KEY is not set");
  if (!from) throw new Error("EMAIL_FROM is not set");
  const fromName = process.env.EMAIL_FROM_NAME ?? "Car Service Tracker";

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: from, name: fromName },
      to: [{ email: to }],
      subject,
      textContent,
    }),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    throw new Error(`Brevo send failed: ${res.status} ${body}`);
  }
}

export async function sendVerificationEmail(
  to: string,
  code: string,
  locale: string,
): Promise<void> {
  const t = await translatorFor(locale);
  await sendEmail(to, t("auth.verifyEmailSubject"), t("auth.verifyEmailBody", { code }));
}

export async function sendPasswordResetEmail(
  to: string,
  code: string,
  locale: string,
): Promise<void> {
  const t = await translatorFor(locale);
  await sendEmail(to, t("auth.resetEmailSubject"), t("auth.resetEmailBody", { code }));
}
```

Run: `npx vitest run src/lib/email.test.ts` — all pass (old tests must stay green).

- [ ] **Step 4: Add `purpose` to the codes repository**

In `src/lib/repositories/verification-codes.ts`:

```ts
export type CodePurpose = "verify" | "reset";
```

In `VerificationCodeDoc`, after `userId`: add

```ts
  purpose?: CodePurpose; // absent on legacy docs = "verify"
```

In `upsertCodeIfCooldownPassed`, widen the `fields` param type:

```ts
fields: { codeHash: string; expiresAt: Date; lastSentAt: Date; purpose: CodePurpose },
```

(No body change — `...fields` already spreads it into `$set`.)

- [ ] **Step 5: Add `updateUserPassword` to `src/lib/repositories/users.ts`**

After `markEmailVerified`, mirroring its ObjectId handling:

```ts
export async function updateUserPassword(
  userId: ObjectId | string,
  passwordHash: string,
): Promise<boolean> {
  const _id = typeof userId === "string" ? new ObjectId(userId) : userId;
  const result = await users().updateOne({ _id }, { $set: { passwordHash } });
  return result.matchedCount === 1;
}
```

- [ ] **Step 6: Add the reset schema to `src/lib/schemas/auth.ts`**

```ts
export const resetPasswordSchema = z.object({
  email: z.email("validation.emailInvalid"),
  code: z.string().regex(/^\d{6}$/, "validation.codeInvalid"),
  newPassword: z.string().min(8, "validation.passwordMin").max(200, "validation.passwordMax"),
});
```

(The request action reuses the existing `resendCodeSchema` — same `{ email }` shape.)

- [ ] **Step 7: Gate.** `npx vitest run && npx tsc --noEmit && npx eslint src` — NOTE: tsc will FAIL in `src/actions/auth.ts` (its `issueCode` now misses `purpose` in `upsertCodeIfCooldownPassed` fields). Add `purpose: "verify"` to the fields object in that private `issueCode` for now (Task 3 replaces it entirely). Re-run until clean.

- [ ] **Step 8: Commit**

```bash
git add src/lib/repositories/verification-codes.ts src/lib/repositories/users.ts src/lib/email.ts src/lib/email.test.ts src/lib/schemas/auth.ts src/actions/auth.ts
git commit -m "feat: code purpose, password update, reset email, reset schema"
```

---

### Task 3: `verification-flow.ts` — shared issue/consume logic (TDD)

**Files:**
- Create: `src/lib/verification-flow.ts`
- Test: `src/lib/verification-flow.test.ts` (create)
- Modify: `src/actions/auth.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/verification-flow.test.ts`:

```ts
import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashCode } from "@/lib/verification";

const repo = vi.hoisted(() => ({
  findCodeByUserId: vi.fn(),
  incrementAttempts: vi.fn(),
  deleteCodeForUser: vi.fn(),
  upsertCodeIfCooldownPassed: vi.fn(),
}));

const email = vi.hoisted(() => ({
  sendVerificationEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock("@/lib/repositories/verification-codes", () => repo);
vi.mock("@/lib/email", () => email);
vi.mock("next-intl/server", () => ({ getLocale: () => Promise.resolve("en") }));

import { consumeCode, issueCode } from "./verification-flow";

const userId = new ObjectId();
const future = new Date(Date.now() + 60_000);
const codeDoc = (over: Record<string, unknown> = {}) => ({
  _id: new ObjectId(),
  userId,
  codeHash: hashCode("123456"),
  expiresAt: future,
  attempts: 0,
  lastSentAt: new Date(),
  purpose: "reset",
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  repo.deleteCodeForUser.mockResolvedValue(undefined);
  repo.upsertCodeIfCooldownPassed.mockResolvedValue(true);
});

describe("consumeCode", () => {
  it("consumes a matching code and deletes it", async () => {
    repo.findCodeByUserId.mockResolvedValue(codeDoc());
    const result = await consumeCode(userId, "123456", "reset");
    expect(result).toEqual({ status: "ok" });
    expect(repo.deleteCodeForUser).toHaveBeenCalledWith(userId);
  });

  it("treats a code of a different purpose as no active code", async () => {
    repo.findCodeByUserId.mockResolvedValue(codeDoc({ purpose: "verify" }));
    expect(await consumeCode(userId, "123456", "reset")).toEqual({ status: "noActiveCode" });
    expect(repo.deleteCodeForUser).not.toHaveBeenCalled();
  });

  it("defaults legacy docs without purpose to verify", async () => {
    repo.findCodeByUserId.mockResolvedValue(codeDoc({ purpose: undefined }));
    expect(await consumeCode(userId, "123456", "verify")).toEqual({ status: "ok" });
  });

  it("expires old codes and deletes them", async () => {
    repo.findCodeByUserId.mockResolvedValue(codeDoc({ expiresAt: new Date(Date.now() - 1) }));
    expect(await consumeCode(userId, "123456", "reset")).toEqual({ status: "codeExpired" });
    expect(repo.deleteCodeForUser).toHaveBeenCalled();
  });

  it("counts wrong attempts and reports attempts left", async () => {
    repo.findCodeByUserId.mockResolvedValue(codeDoc());
    repo.incrementAttempts.mockResolvedValue(2);
    expect(await consumeCode(userId, "000000", "reset")).toEqual({
      status: "codeInvalid",
      attemptsLeft: 3,
    });
    expect(repo.deleteCodeForUser).not.toHaveBeenCalled();
  });

  it("locks and deletes after the attempt cap", async () => {
    repo.findCodeByUserId.mockResolvedValue(codeDoc());
    repo.incrementAttempts.mockResolvedValue(5);
    expect(await consumeCode(userId, "000000", "reset")).toEqual({ status: "tooManyAttempts" });
    expect(repo.deleteCodeForUser).toHaveBeenCalled();
  });

  it("reports no active code when none exists", async () => {
    repo.findCodeByUserId.mockResolvedValue(null);
    expect(await consumeCode(userId, "123456", "reset")).toEqual({ status: "noActiveCode" });
  });
});

describe("issueCode", () => {
  it("stores a reset-purpose code and sends the reset email", async () => {
    const sent = await issueCode(userId, "user@example.com", "reset");
    expect(sent).toBe(true);
    const fields = repo.upsertCodeIfCooldownPassed.mock.calls[0][1];
    expect(fields.purpose).toBe("reset");
    expect(email.sendPasswordResetEmail).toHaveBeenCalledWith(
      "user@example.com",
      expect.stringMatching(/^\d{6}$/),
      "en",
    );
    expect(email.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("sends the verification email for verify purpose", async () => {
    await issueCode(userId, "user@example.com", "verify");
    expect(email.sendVerificationEmail).toHaveBeenCalled();
  });

  it("returns false without sending when the cooldown blocks", async () => {
    repo.upsertCodeIfCooldownPassed.mockResolvedValue(false);
    expect(await issueCode(userId, "user@example.com", "reset")).toBe(false);
    expect(email.sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/verification-flow.test.ts`
Expected: FAIL — cannot resolve `./verification-flow`.

- [ ] **Step 3: Create `src/lib/verification-flow.ts`**

```ts
import type { ObjectId } from "mongodb";
import { getLocale } from "next-intl/server";
import {
  CODE_TTL_MS,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_MS,
  generateCode,
  hashCode,
  isExpired,
} from "@/lib/verification";
import {
  type CodePurpose,
  deleteCodeForUser,
  findCodeByUserId,
  incrementAttempts,
  upsertCodeIfCooldownPassed,
} from "@/lib/repositories/verification-codes";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";

export type ConsumeCodeResult =
  | { status: "ok" }
  | { status: "codeInvalid"; attemptsLeft: number }
  | { status: "tooManyAttempts" }
  | { status: "codeExpired" }
  | { status: "noActiveCode" };

/**
 * Atomically claims the send slot (cooldown-gated), then emails a fresh code
 * for the given purpose. Returns false when the cooldown blocked the send.
 */
export async function issueCode(
  userId: ObjectId | string,
  email: string,
  purpose: CodePurpose,
): Promise<boolean> {
  const code = generateCode();
  const now = new Date();
  const claimed = await upsertCodeIfCooldownPassed(
    userId,
    {
      codeHash: hashCode(code),
      expiresAt: new Date(now.getTime() + CODE_TTL_MS),
      lastSentAt: now,
      purpose,
    },
    RESEND_COOLDOWN_MS,
  );
  if (!claimed) return false;
  const send = purpose === "reset" ? sendPasswordResetEmail : sendVerificationEmail;
  await send(email, code, await getLocale());
  return true;
}

/**
 * Checks a submitted code against the user's active one and deletes it on
 * success. A code issued for a different purpose counts as no active code
 * (legacy docs without `purpose` are verify codes).
 */
export async function consumeCode(
  userId: ObjectId | string,
  code: string,
  purpose: CodePurpose,
): Promise<ConsumeCodeResult> {
  const codeDoc = await findCodeByUserId(userId);
  if (!codeDoc || (codeDoc.purpose ?? "verify") !== purpose) {
    return { status: "noActiveCode" };
  }

  if (isExpired(codeDoc.expiresAt, new Date())) {
    await deleteCodeForUser(userId);
    return { status: "codeExpired" };
  }

  if (hashCode(code) !== codeDoc.codeHash) {
    const attempts = await incrementAttempts(userId);
    if (attempts >= MAX_ATTEMPTS) {
      await deleteCodeForUser(userId);
      return { status: "tooManyAttempts" };
    }
    return { status: "codeInvalid", attemptsLeft: MAX_ATTEMPTS - attempts };
  }

  await deleteCodeForUser(userId);
  return { status: "ok" };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/verification-flow.test.ts`
Expected: 10 PASS.

- [ ] **Step 5: Rewire `src/actions/auth.ts` to use the module**

- Delete the private `issueCode` function and its now-unused imports (`CODE_TTL_MS`, `MAX_ATTEMPTS`, `generateCode`, `hashCode`, `isExpired`, `upsertCodeIfCooldownPassed`, `sendVerificationEmail`, `incrementAttempts`, `type ObjectId` — keep `RESEND_COOLDOWN_MS`, `cooldownSecondsLeft`, `findCodeByUserId`, `deleteCodeForUser`).
- Add: `import { consumeCode, issueCode } from "@/lib/verification-flow";`
- In `registerAction`: `await issueCode(userId, email)` → `await issueCode(userId, email, "verify")`.
- In `resendVerificationCodeAction`: `issueCode(user._id, user.email)` → `issueCode(user._id, user.email, "verify")`.
- In `verifyEmailAction`, replace everything from `const codeDoc = await findCodeByUserId(user._id);` down to the final `return { status: "verified" };` with:

```ts
    const consumed = await consumeCode(user._id, parsedInput.code, "verify");
    if (consumed.status !== "ok") return consumed;

    // Concurrent correct submissions are idempotent: re-marking verified is a no-op.
    await markEmailVerified(user._id);
    return { status: "verified" };
```

- [ ] **Step 6: Full gate**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: all green (eslint flags any leftover unused imports — remove them).

- [ ] **Step 7: Commit**

```bash
git add src/lib/verification-flow.ts src/lib/verification-flow.test.ts src/actions/auth.ts
git commit -m "refactor: extract purpose-aware issueCode/consumeCode into verification-flow"
```

---

### Task 4: Server actions — request + reset

**Files:**
- Modify: `src/actions/auth.ts`

- [ ] **Step 1: Add a shared cooldown-aware send helper**

In `src/actions/auth.ts`, add below the result type declarations (it is module-private — `"use server"` files may only EXPORT actions):

```ts
type SendCodeOutcome =
  | { status: "sent"; retryAfterSec: number }
  | { status: "cooldown"; retryAfterSec: number };

/** Issues a code with send-failure cleanup and cooldown feedback. */
async function sendCodeWithFeedback(
  userId: ObjectId,
  email: string,
  purpose: CodePurpose,
): Promise<SendCodeOutcome> {
  let sent: boolean;
  try {
    sent = await issueCode(userId, email, purpose);
  } catch (e) {
    console.error(`sending ${purpose} code failed:`, e);
    // Drop the undelivered code so the cooldown doesn't block an immediate retry.
    await deleteCodeForUser(userId);
    throw new ActionError("auth.sendFailed");
  }
  if (!sent) {
    const existing = await findCodeByUserId(userId);
    const retryAfterSec = existing
      ? cooldownSecondsLeft(existing.lastSentAt, new Date())
      : 1;
    return { status: "cooldown", retryAfterSec: Math.max(1, retryAfterSec) };
  }
  return { status: "sent", retryAfterSec: RESEND_COOLDOWN_MS / 1000 };
}
```

Imports to add/keep: `import type { ObjectId } from "mongodb";` (type-only is fine alongside the `MongoServerError` value import), `import { type CodePurpose } from "@/lib/repositories/verification-codes";` (merge into the existing import from that module), `updateUserPassword` added to the users repository import, `resetPasswordSchema` added to the schemas import.

- [ ] **Step 2: Slim `resendVerificationCodeAction` to use it**

Replace its body after the `alreadyVerified` check with:

```ts
    return sendCodeWithFeedback(user._id, user.email, "verify");
```

(The `ResendCodeResult` type keeps its `alreadyVerified` member; `SendCodeOutcome` covers the other two.)

- [ ] **Step 3: Add the two new actions (at the end, before `deleteAccountAction`)**

```ts
export type RequestPasswordResetResult = SendCodeOutcome;

export const requestPasswordResetAction = actionClient
  .inputSchema(resendCodeSchema)
  .action(async ({ parsedInput }): Promise<RequestPasswordResetResult> => {
    const user = await findUserByEmail(parsedInput.email);
    if (!user) throw new ActionError("auth.emailNotFound");
    return sendCodeWithFeedback(user._id, user.email, "reset");
  });

export type ResetPasswordResult =
  | { status: "reset" }
  | { status: "codeInvalid"; attemptsLeft: number }
  | { status: "tooManyAttempts" }
  | { status: "codeExpired" }
  | { status: "noActiveCode" };

export const resetPasswordAction = actionClient
  .inputSchema(resetPasswordSchema)
  .action(async ({ parsedInput }): Promise<ResetPasswordResult> => {
    const user = await findUserByEmail(parsedInput.email);
    if (!user) throw new ActionError("auth.emailNotFound");

    const consumed = await consumeCode(user._id, parsedInput.code, "reset");
    if (consumed.status !== "ok") return consumed;

    const passwordHash = await bcrypt.hash(parsedInput.newPassword, 10);
    await updateUserPassword(user._id, passwordHash);
    // Receiving the code proves mailbox ownership — unblock unverified accounts.
    if (!user.emailVerified) await markEmailVerified(user._id);
    return { status: "reset" };
  });
```

- [ ] **Step 4: Full gate**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: all green. (`"use server"` requires every export to be an async server action or a type — type exports are erased and fine; if Next complains about `RequestPasswordResetResult`/`ResetPasswordResult`, declare them with `export type` exactly as shown.)

- [ ] **Step 5: Commit**

```bash
git add src/actions/auth.ts
git commit -m "feat: requestPasswordReset and resetPassword actions"
```

---

### Task 5: `/forgot` page + two-stage form (TDD) + login entry points

**Files:**
- Test: `src/components/auth/forgot-form.test.tsx` (create)
- Create: `src/components/auth/forgot-form.tsx`
- Create: `src/app/(auth)/forgot/page.tsx`
- Modify: `src/components/auth/login-form.tsx`
- Modify: `src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Write the failing component test**

Create `src/components/auth/forgot-form.test.tsx` (same mocking pattern as `verify-form.test.tsx` — mocked `useAction` keyed by action reference):

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";

const { nextData, push } = vi.hoisted(() => ({
  nextData: new Map<unknown, unknown>(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/actions/auth", () => ({
  requestPasswordResetAction: "requestPasswordResetAction",
  resetPasswordAction: "resetPasswordAction",
}));

vi.mock("next-safe-action/hooks", () => ({
  useAction: (
    action: unknown,
    opts?: {
      onSuccess?: (args: { data: unknown }) => void;
      onError?: (args: { error: unknown }) => void;
    },
  ) => ({
    execute: () => {
      const preset = nextData.get(action) as { error?: unknown } | undefined;
      if (preset && typeof preset === "object" && "error" in preset) {
        opts?.onError?.({ error: preset.error });
      } else {
        opts?.onSuccess?.({ data: preset });
      }
    },
    result: {},
    isExecuting: false,
  }),
}));

import { ForgotForm } from "./forgot-form";

afterEach(cleanup);
beforeEach(() => {
  nextData.clear();
  push.mockClear();
});

function renderForm(initialEmail = "user@example.com") {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ForgotForm initialEmail={initialEmail} />
    </NextIntlClientProvider>,
  );
}

function requestCode() {
  fireEvent.click(screen.getByRole("button", { name: "Send code" }));
}

describe("ForgotForm", () => {
  it("starts in the request stage without code or password fields", () => {
    renderForm();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.queryByLabelText("Verification code")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
  });

  it("advances to the reset stage when the code was sent", () => {
    nextData.set("requestPasswordResetAction", { status: "sent", retryAfterSec: 60 });
    renderForm();
    requestCode();
    expect(screen.getByText("A new code was sent")).toBeInTheDocument();
    expect(screen.getByLabelText("Verification code")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resend available in 60s" })).toBeDisabled();
  });

  it("advances to the reset stage on cooldown too (an earlier code may still be valid)", () => {
    nextData.set("requestPasswordResetAction", { status: "cooldown", retryAfterSec: 42 });
    renderForm();
    requestCode();
    expect(screen.getByLabelText("Verification code")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resend available in 42s" })).toBeDisabled();
  });

  it("redirects to login with the reset flag on success", () => {
    nextData.set("requestPasswordResetAction", { status: "sent", retryAfterSec: 60 });
    nextData.set("resetPasswordAction", { status: "reset" });
    renderForm();
    requestCode();
    fireEvent.change(screen.getByLabelText("Verification code"), {
      target: { value: "123456" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "new-password-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Set new password" }));
    expect(push).toHaveBeenCalledWith("/login?reset=1");
  });

  it("shows remaining attempts after a wrong code", () => {
    nextData.set("requestPasswordResetAction", { status: "sent", retryAfterSec: 60 });
    nextData.set("resetPasswordAction", { status: "codeInvalid", attemptsLeft: 2 });
    renderForm();
    requestCode();
    fireEvent.change(screen.getByLabelText("Verification code"), {
      target: { value: "000000" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "new-password-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Set new password" }));
    expect(screen.getByText("Wrong code — 2 attempts left")).toBeInTheDocument();
    expect(screen.getByLabelText("Verification code")).toHaveValue("");
  });

  it("locks the form after too many attempts", () => {
    nextData.set("requestPasswordResetAction", { status: "sent", retryAfterSec: 60 });
    nextData.set("resetPasswordAction", { status: "tooManyAttempts" });
    renderForm();
    requestCode();
    fireEvent.change(screen.getByLabelText("Verification code"), {
      target: { value: "000000" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "new-password-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Set new password" }));
    expect(
      screen.getByText("Too many wrong attempts. Request a new code."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set new password" })).toBeDisabled();
  });

  it("shows a translated server error (unknown email)", () => {
    nextData.set("requestPasswordResetAction", {
      error: { serverError: "auth.emailNotFound" },
    });
    renderForm();
    requestCode();
    expect(screen.getByText("No account with this email")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/components/auth/forgot-form.test.tsx`
Expected: FAIL — cannot resolve `./forgot-form`.

- [ ] **Step 3: Create `src/components/auth/forgot-form.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { requestPasswordResetAction, resetPasswordAction } from "@/actions/auth";
import { actionErrorKey } from "@/lib/action-feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Feedback =
  | { kind: "codeInvalid"; attemptsLeft: number }
  | { kind: "locked"; key: "auth.tooManyAttempts" | "auth.codeExpired" | "auth.noActiveCode" }
  | { kind: "sent" }
  | { kind: "error"; key: string }
  | null;

export function ForgotForm({ initialEmail }: { initialEmail: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [stage, setStage] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown === 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // While locked, retrying cannot succeed — only a resend re-enables the form.
  const locked = feedback?.kind === "locked";

  const request = useAction(requestPasswordResetAction, {
    onSuccess({ data }) {
      if (!data) return;
      setStage("reset");
      setCooldown(data.retryAfterSec);
      if (data.status === "sent") {
        setFeedback({ kind: "sent" });
        setCode("");
      }
    },
    onError({ error }) {
      setFeedback({ kind: "error", key: actionErrorKey(error) ?? "errors.server" });
    },
  });

  const reset = useAction(resetPasswordAction, {
    onSuccess({ data }) {
      if (!data) return;
      switch (data.status) {
        case "reset":
          router.push("/login?reset=1");
          break;
        case "codeInvalid":
          setFeedback({ kind: "codeInvalid", attemptsLeft: data.attemptsLeft });
          setCode("");
          break;
        case "tooManyAttempts":
          setFeedback({ kind: "locked", key: "auth.tooManyAttempts" });
          setCode("");
          break;
        case "codeExpired":
          setFeedback({ kind: "locked", key: "auth.codeExpired" });
          setCode("");
          break;
        case "noActiveCode":
          setFeedback({ kind: "locked", key: "auth.noActiveCode" });
          setCode("");
          break;
      }
    },
    onError({ error }) {
      setFeedback({ kind: "error", key: actionErrorKey(error) ?? "errors.server" });
    },
  });

  const busy = request.isExecuting || reset.isExecuting;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auth.forgotTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (busy) return;
            if (stage === "request") {
              request.execute({ email });
            } else if (!locked) {
              reset.execute({ email, code, newPassword });
            }
          }}
        >
          <p className="text-sm text-muted-foreground">{t("auth.forgotInstructions")}</p>
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFeedback(null); // a different email is a different reset state
              }}
            />
          </div>
          {stage === "reset" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="code">{t("auth.code")}</Label>
                <Input
                  id="code"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  disabled={locked}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  aria-invalid={feedback?.kind === "codeInvalid" || undefined}
                  aria-describedby={feedback?.kind === "codeInvalid" ? "code-error" : undefined}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">{t("auth.newPassword")}</Label>
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  disabled={locked}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </>
          )}
          <div aria-live="polite">
            {feedback?.kind === "codeInvalid" && (
              <p id="code-error" className="text-sm text-destructive">
                {t("auth.codeInvalidAttempts", { attemptsLeft: feedback.attemptsLeft })}
              </p>
            )}
            {(feedback?.kind === "locked" || feedback?.kind === "error") && (
              <p className="text-sm text-destructive">{t(feedback.key)}</p>
            )}
            {feedback?.kind === "sent" && (
              <p className="text-sm text-green-600">{t("auth.codeSent")}</p>
            )}
          </div>
          {stage === "request" ? (
            <Button type="submit" size="lg" className="w-full" disabled={busy || !email}>
              {request.isExecuting ? t("common.loading") : t("auth.sendCode")}
            </Button>
          ) : (
            <>
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={locked || busy}
              >
                {reset.isExecuting ? t("common.loading") : t("auth.resetPassword")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full"
                disabled={busy || cooldown > 0 || !email}
                onClick={() => {
                  if (locked) setFeedback(null); // a fresh code unlocks the form
                  request.execute({ email });
                }}
              >
                {cooldown > 0
                  ? t("auth.resendIn", { seconds: cooldown })
                  : request.isExecuting
                    ? t("common.loading")
                    : t("auth.resendCode")}
              </Button>
            </>
          )}
          <p className="text-center text-sm">
            <Link href="/login" className="underline">
              {t("auth.haveAccount")}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/components/auth/forgot-form.test.tsx`
Expected: 7 PASS. (If the locked-resend unlock test interferes: the resend button's onClick clears locked feedback BEFORE executing, matching verify-form's behavior where a successful resend unlocks.)

- [ ] **Step 5: Create `src/app/(auth)/forgot/page.tsx`** (mirrors `/verify`)

```tsx
import { ForgotForm } from "@/components/auth/forgot-form";

export default async function ForgotPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return <ForgotForm initialEmail={email ?? ""} />;
}
```

- [ ] **Step 6: Login entry points**

`src/app/(auth)/login/page.tsx` — read both params:

```tsx
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string; reset?: string }>;
}) {
  const { verified, reset } = await searchParams;
  return <LoginForm verified={verified === "1"} reset={reset === "1"} />;
}
```

`src/components/auth/login-form.tsx`:
- Props: `{ verified = false, reset = false }: { verified?: boolean; reset?: boolean }`.
- Make the email input controlled so the forgot link can carry it: add `const [email, setEmail] = useState("");` and on the email Input add `value={email} onChange={(e) => setEmail(e.target.value)}`. In `onSubmit`, replace `const email = String(data.get("email"));` usage with the state value (`setSubmittedEmail(email); execute({ email, password: String(data.get("password")) });` — the `FormData` is then only needed for the password).
- Success banner, next to the `verified` one:

```tsx
{reset && <p className="text-sm text-green-600">{t("auth.resetNowLogin")}</p>}
```

- Forgot link, right after the password field's closing `</div>`:

```tsx
<p className="text-right text-sm">
  <Link
    href={email ? `/forgot?email=${encodeURIComponent(email)}` : "/forgot"}
    className="text-muted-foreground underline hover:text-foreground"
  >
    {t("auth.forgotPassword")}
  </Link>
</p>
```

- [ ] **Step 7: Full gate**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: all green (existing login/verify tests untouched and passing).

- [ ] **Step 8: Commit**

```bash
git add src/components/auth/forgot-form.tsx src/components/auth/forgot-form.test.tsx src/app/\(auth\)/forgot src/components/auth/login-form.tsx src/app/\(auth\)/login/page.tsx
git commit -m "feat: forgot password page with two-stage code+password form"
```

---

### Task 6: Final verification

- [ ] **Step 1: Full gate incl. build**

```bash
npx vitest run && npx tsc --noEmit && npx eslint src && npm run build
```

All four must pass.

- [ ] **Step 2: Visual check (ephemeral harness — see memory `visual-verification-recipe`)**

Start `/tmp/ui-check/memdb.mjs` + `MONGODB_URI_CAR="mongodb://127.0.0.1:27517/" MONGODB_DB="uicheck" npx next start -p 3100`. With Playwright (channel chrome, 390×844):
1. `/login` — screenshot: forgot-password link visible under the password field.
2. Type an email into login, click the link — lands on `/forgot?email=...` with the email prefilled; screenshot stage 1.
3. Submit with an UNKNOWN email (e.g. `nobody@claude.local`) — expect the red "No account with this email" error. **Do NOT submit with a seeded email: `.env.local` has a real Brevo key and it would send a real email.**
4. Full reset path is covered by unit/component tests; the live email leg is verified manually by the user on prod.
Kill the harness afterwards (`lsof -ti :3100 | xargs kill`; kill memdb/mongod processes).

- [ ] **Step 3: Fix anything found, re-run gate, commit**

```bash
git add -A && git commit -m "fix: forgot password follow-ups from visual check"
```

(Skip if nothing changed.)
