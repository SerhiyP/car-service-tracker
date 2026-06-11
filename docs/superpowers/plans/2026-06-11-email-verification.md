# Email Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block login until users verify their email with a 6-digit code sent via Brevo, per `docs/superpowers/specs/2026-06-11-email-verification-design.md`.

**Architecture:** Registration creates an unverified user (`emailVerified: null`), issues a hashed 6-digit code into a new `verification_codes` collection (TTL-indexed), emails it via Brevo's REST API, and redirects to a new `/verify` page. `authorize()` rejects unverified accounts; the login action classifies that failure as `auth.emailNotVerified`. The verify action returns a **discriminated status union** (not thrown errors) so the form can carry `attemptsLeft` and disable itself when retrying cannot succeed.

**Tech Stack:** Next.js 16.2.9 (App Router), Auth.js v5 Credentials, next-safe-action v8, MongoDB driver, Zod v4, next-intl (cookie locale), Vitest + Testing Library.

**Conventions for all tasks (read first):**
- This is **Next.js 16** — APIs differ from training data. `searchParams`/`params` are **Promises** (`await` them). Routing middleware lives in `src/proxy.ts`, not `middleware.ts`. If unsure about an API, read `node_modules/next/dist/docs/`.
- Use **short relative git commands** from the repo root (`git add src/lib`, never absolute paths).
- All user-facing strings are **i18n keys** resolved by `next-intl`; error messages thrown via `ActionError` are i18n keys too. Every key added to `src/messages/en.json` MUST also be added to `src/messages/uk.json` (identical key sets).
- Run tests with `npx vitest run <path>`; full suite `npx vitest run`.

---

### Task 1: Verification core logic (pure functions, TDD)

**Files:**
- Create: `src/lib/verification.ts`
- Test: `src/lib/verification.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/verification.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  CODE_TTL_MS,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_MS,
  cooldownSecondsLeft,
  generateCode,
  hashCode,
  isExpired,
} from "./verification";

describe("generateCode", () => {
  it("always returns exactly 6 digits", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateCode()).toMatch(/^\d{6}$/);
    }
  });
});

describe("hashCode", () => {
  it("is deterministic", () => {
    expect(hashCode("123456")).toBe(hashCode("123456"));
  });

  it("differs for different codes", () => {
    expect(hashCode("123456")).not.toBe(hashCode("123457"));
  });

  it("does not contain the code itself", () => {
    expect(hashCode("123456")).not.toContain("123456");
  });
});

describe("isExpired", () => {
  const expiresAt = new Date("2026-06-11T12:00:00Z");

  it("is not expired before the deadline", () => {
    expect(isExpired(expiresAt, new Date("2026-06-11T11:59:59Z"))).toBe(false);
  });

  it("is expired exactly at the deadline", () => {
    expect(isExpired(expiresAt, expiresAt)).toBe(true);
  });
});

describe("cooldownSecondsLeft", () => {
  const lastSentAt = new Date("2026-06-11T12:00:00Z");

  it("is the full cooldown immediately after sending", () => {
    expect(cooldownSecondsLeft(lastSentAt, lastSentAt)).toBe(RESEND_COOLDOWN_MS / 1000);
  });

  it("rounds partial seconds up", () => {
    expect(cooldownSecondsLeft(lastSentAt, new Date("2026-06-11T12:00:59.500Z"))).toBe(1);
  });

  it("is 0 once the cooldown has passed", () => {
    expect(cooldownSecondsLeft(lastSentAt, new Date("2026-06-11T12:01:00Z"))).toBe(0);
  });
});

describe("constants", () => {
  it("codes live 15 minutes, 5 attempts, 60s cooldown", () => {
    expect(CODE_TTL_MS).toBe(15 * 60 * 1000);
    expect(MAX_ATTEMPTS).toBe(5);
    expect(RESEND_COOLDOWN_MS).toBe(60 * 1000);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/verification.test.ts`
Expected: FAIL — cannot resolve `./verification`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/verification.ts`:

```ts
import { createHash, randomInt } from "node:crypto";

export const CODE_TTL_MS = 15 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
export const RESEND_COOLDOWN_MS = 60 * 1000;

/** Cryptographically random 6-digit code, zero-padded. */
export function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** sha256 hex. The 5-attempt cap is the real defense for a 10^6 keyspace. */
export function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function isExpired(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() <= now.getTime();
}

/** Whole seconds until a new code may be sent; 0 when the cooldown has passed. */
export function cooldownSecondsLeft(lastSentAt: Date, now: Date): number {
  const ms = lastSentAt.getTime() + RESEND_COOLDOWN_MS - now.getTime();
  return Math.max(0, Math.ceil(ms / 1000));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/verification.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/verification.ts src/lib/verification.test.ts
git commit -m "feat: verification code core logic (generate, hash, expiry, cooldown)"
```

---

### Task 2: Data layer — verification_codes repository, users.emailVerified, indexes

**Files:**
- Create: `src/lib/repositories/verification-codes.ts`
- Modify: `src/lib/repositories/users.ts`
- Modify: `src/lib/db.ts` (ensureIndexes)

Repositories in this codebase are thin untested wrappers over the driver; follow that pattern (no unit tests here — logic lives in actions and `lib/verification.ts`).

- [ ] **Step 1: Create the verification-codes repository**

Create `src/lib/repositories/verification-codes.ts`:

```ts
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";

export interface VerificationCodeDoc {
  _id: ObjectId;
  userId: ObjectId;
  codeHash: string;
  expiresAt: Date; // TTL index — Mongo deletes the doc after this moment
  attempts: number;
  lastSentAt: Date;
}

const codes = () =>
  getDb().collection<Omit<VerificationCodeDoc, "_id">>("verification_codes");

const toObjectId = (id: ObjectId | string) =>
  typeof id === "string" ? new ObjectId(id) : id;

export async function findCodeByUserId(
  userId: ObjectId | string,
): Promise<VerificationCodeDoc | null> {
  return (await codes().findOne({ userId: toObjectId(userId) })) as VerificationCodeDoc | null;
}

/** Replaces any existing code for the user and resets the attempt counter. */
export async function upsertCode(
  userId: ObjectId | string,
  fields: { codeHash: string; expiresAt: Date; lastSentAt: Date },
): Promise<void> {
  await codes().updateOne(
    { userId: toObjectId(userId) },
    { $set: { ...fields, attempts: 0 } },
    { upsert: true },
  );
}

/** Atomically increments and returns the new attempt count. */
export async function incrementAttempts(userId: ObjectId | string): Promise<number> {
  const updated = await codes().findOneAndUpdate(
    { userId: toObjectId(userId) },
    { $inc: { attempts: 1 } },
    { returnDocument: "after" },
  );
  // Doc vanished mid-flight (TTL cleanup) — treat as exhausted.
  return updated?.attempts ?? Number.MAX_SAFE_INTEGER;
}

export async function deleteCodeForUser(userId: ObjectId | string): Promise<void> {
  await codes().deleteOne({ userId: toObjectId(userId) });
}
```

- [ ] **Step 2: Add emailVerified to the users repository**

In `src/lib/repositories/users.ts`:

Add to `UserDoc`:

```ts
export interface UserDoc {
  _id: ObjectId;
  email: string;
  name: string;
  passwordHash: string;
  emailVerified?: Date | null; // absent on legacy accounts = unverified
}
```

In `createUser`, write the field explicitly:

```ts
  const result = await users().insertOne({
    name: input.name,
    email: input.email.toLowerCase(),
    passwordHash: input.passwordHash,
    emailVerified: null,
  });
```

Append:

```ts
export async function markEmailVerified(userId: ObjectId | string): Promise<void> {
  const _id = typeof userId === "string" ? new ObjectId(userId) : userId;
  await users().updateOne({ _id }, { $set: { emailVerified: new Date() } });
}
```

(`ObjectId` is already imported in this file.)

- [ ] **Step 3: Add the indexes**

In `src/lib/db.ts`, extend the `Promise.all` in `ensureIndexes`:

```ts
    db.collection("verification_codes").createIndex({ userId: 1 }, { unique: true }),
    db
      .collection("verification_codes")
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
```

- [ ] **Step 4: Verify types compile and the suite still passes**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean tsc; all existing tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/repositories/verification-codes.ts src/lib/repositories/users.ts src/lib/db.ts
git commit -m "feat: verification_codes collection, users.emailVerified, TTL index"
```

---

### Task 3: Brevo email sender

**Files:**
- Create: `src/lib/email.ts`
- Test: `src/lib/email.test.ts`
- Modify: `src/messages/en.json`, `src/messages/uk.json` (email subject/body keys)
- Modify: `.env.local.example`

- [ ] **Step 1: Add the email message keys**

In `src/messages/en.json`, add to the `"auth"` object:

```json
    "verifyEmailSubject": "Your Car Service Tracker verification code",
    "verifyEmailBody": "Your verification code is {code}. It expires in 15 minutes."
```

In `src/messages/uk.json`, add to the `"auth"` object:

```json
    "verifyEmailSubject": "Ваш код підтвердження Car Service Tracker",
    "verifyEmailBody": "Ваш код підтвердження: {code}. Він діє 15 хвилин."
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/email.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendVerificationEmail } from "./email";

describe("sendVerificationEmail", () => {
  beforeEach(() => {
    vi.stubEnv("BREVO_API_KEY", "test-key");
    vi.stubEnv("EMAIL_FROM", "noreply@example.com");
    vi.stubEnv("EMAIL_FROM_NAME", "Car Service Tracker");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("posts a localized email to Brevo", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendVerificationEmail("user@example.com", "123456", "en");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect((init.headers as Record<string, string>)["api-key"]).toBe("test-key");
    const body = JSON.parse(init.body as string);
    expect(body.to).toEqual([{ email: "user@example.com" }]);
    expect(body.sender).toEqual({ email: "noreply@example.com", name: "Car Service Tracker" });
    expect(body.subject).toBe("Your Car Service Tracker verification code");
    expect(body.textContent).toContain("123456");
  });

  it("localizes the body for uk", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendVerificationEmail("user@example.com", "654321", "uk");

    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.subject).toBe("Ваш код підтвердження Car Service Tracker");
    expect(body.textContent).toContain("654321");
  });

  it("throws when Brevo responds with an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 401 })));
    await expect(sendVerificationEmail("user@example.com", "123456", "en")).rejects.toThrow(/401/);
  });

  it("throws when configuration is missing", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    await expect(sendVerificationEmail("user@example.com", "123456", "en")).rejects.toThrow(
      /BREVO_API_KEY/,
    );
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/email.test.ts`
Expected: FAIL — cannot resolve `./email`.

- [ ] **Step 4: Write the implementation**

Create `src/lib/email.ts`:

```ts
import { createTranslator } from "next-intl";

/**
 * Sends the verification code via Brevo's transactional API.
 * Plain fetch — no SDK. Throws on missing config or non-2xx response;
 * callers decide whether that is fatal (resend) or survivable (register).
 */
export async function sendVerificationEmail(
  to: string,
  code: string,
  locale: string,
): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey) throw new Error("BREVO_API_KEY is not set");
  if (!from) throw new Error("EMAIL_FROM is not set");
  const fromName = process.env.EMAIL_FROM_NAME ?? "Car Service Tracker";

  const messages = (await import(`../messages/${locale}.json`)).default;
  const t = createTranslator({ locale, messages });

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
      subject: t("auth.verifyEmailSubject"),
      textContent: t("auth.verifyEmailBody", { code }),
    }),
  });
  if (!res.ok) {
    throw new Error(`Brevo send failed: ${res.status} ${await res.text()}`);
  }
}
```

Note: the dynamic `import(\`../messages/${locale}.json\`)` mirrors `src/i18n/request.ts` — keep it relative, not `@/`-aliased, so the bundler can resolve the template.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/email.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Document the env vars**

Append to `.env.local.example`:

```bash
# Brevo transactional email (app.brevo.com → SMTP & API → API Keys)
BREVO_API_KEY="xkeysib-..."
# Sender address verified in Brevo (Senders, Domains & Dedicated IPs)
EMAIL_FROM="you@example.com"
EMAIL_FROM_NAME="Car Service Tracker"
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/email.ts src/lib/email.test.ts src/messages .env.local.example
git commit -m "feat: Brevo verification email sender with localized content"
```

---

### Task 4: Zod schemas for verify/resend

**Files:**
- Modify: `src/lib/schemas/auth.ts`
- Test: `src/lib/schemas/schemas.test.ts` (append)
- Modify: `src/messages/en.json`, `src/messages/uk.json` (validation key)

- [ ] **Step 1: Add the validation message key**

`src/messages/en.json` → `"validation"` object:

```json
    "codeInvalid": "Enter the 6-digit code"
```

`src/messages/uk.json` → `"validation"` object:

```json
    "codeInvalid": "Введіть 6-значний код"
```

- [ ] **Step 2: Write the failing tests**

Append to `src/lib/schemas/schemas.test.ts` (match the file's existing style; add the import of the new schemas to the existing import from `@/lib/schemas/auth` — `verifyEmailSchema`, `resendCodeSchema`):

```ts
describe("verifyEmailSchema", () => {
  it("accepts an email with a 6-digit code", () => {
    const result = verifyEmailSchema.safeParse({ email: "a@b.co", code: "012345" });
    expect(result.success).toBe(true);
  });

  it.each(["12345", "1234567", "12345a", "", "123 56"])("rejects code %j", (code) => {
    const result = verifyEmailSchema.safeParse({ email: "a@b.co", code });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = verifyEmailSchema.safeParse({ email: "nope", code: "123456" });
    expect(result.success).toBe(false);
  });
});

describe("resendCodeSchema", () => {
  it("accepts a valid email", () => {
    expect(resendCodeSchema.safeParse({ email: "a@b.co" }).success).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(resendCodeSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/lib/schemas/schemas.test.ts`
Expected: FAIL — `verifyEmailSchema` is not exported.

- [ ] **Step 4: Implement the schemas**

Append to `src/lib/schemas/auth.ts`:

```ts
export const verifyEmailSchema = z.object({
  email: z.email("validation.emailInvalid"),
  code: z.string().regex(/^\d{6}$/, "validation.codeInvalid"),
});

export const resendCodeSchema = z.object({
  email: z.email("validation.emailInvalid"),
});
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/lib/schemas/schemas.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/schemas/auth.ts src/lib/schemas/schemas.test.ts src/messages
git commit -m "feat: verify-email and resend-code schemas"
```

---

### Task 5: Server actions + authorize gate

**Files:**
- Modify: `src/actions/auth.ts` (rework register/login, add verify/resend)
- Modify: `src/auth.ts` (authorize rejects unverified)
- Modify: `src/messages/en.json`, `src/messages/uk.json` (action error keys)

- [ ] **Step 1: Add the action error message keys**

`src/messages/en.json` → `"auth"`:

```json
    "emailNotVerified": "Your email is not verified yet",
    "emailNotFound": "No account with this email",
    "sendFailed": "Could not send the email. Try again."
```

`src/messages/uk.json` → `"auth"`:

```json
    "emailNotVerified": "Вашу пошту ще не підтверджено",
    "emailNotFound": "Облікового запису з цією поштою не існує",
    "sendFailed": "Не вдалося надіслати лист. Спробуйте ще раз."
```

- [ ] **Step 2: Gate authorize on emailVerified**

In `src/auth.ts`, inside `authorize`, after the password check:

```ts
        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;
        // Unverified (and legacy pre-verification) accounts cannot sign in.
        if (!user.emailVerified) return null;
        return { id: user._id.toHexString(), email: user.email, name: user.name };
```

- [ ] **Step 3: Rewrite src/actions/auth.ts**

Replace the file's contents with:

```ts
"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { MongoServerError, type ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import { getLocale } from "next-intl/server";
import { signIn, signOut } from "@/auth";
import { ActionError, actionClient } from "@/lib/safe-action";
import {
  loginSchema,
  registerSchema,
  resendCodeSchema,
  verifyEmailSchema,
} from "@/lib/schemas/auth";
import {
  createUser,
  findUserByEmail,
  markEmailVerified,
} from "@/lib/repositories/users";
import {
  deleteCodeForUser,
  findCodeByUserId,
  incrementAttempts,
  upsertCode,
} from "@/lib/repositories/verification-codes";
import {
  CODE_TTL_MS,
  MAX_ATTEMPTS,
  cooldownSecondsLeft,
  generateCode,
  hashCode,
  isExpired,
} from "@/lib/verification";
import { sendVerificationEmail } from "@/lib/email";

export type VerifyEmailResult =
  | { status: "verified" }
  | { status: "codeInvalid"; attemptsLeft: number }
  | { status: "tooManyAttempts" }
  | { status: "codeExpired" }
  | { status: "noActiveCode" };

export type ResendCodeResult =
  | { status: "sent" }
  | { status: "alreadyVerified" }
  | { status: "cooldown"; retryAfterSec: number };

/** Stores a fresh code (resetting attempts) and emails it. */
async function issueCode(userId: ObjectId | string, email: string): Promise<void> {
  const code = generateCode();
  const now = new Date();
  await upsertCode(userId, {
    codeHash: hashCode(code),
    expiresAt: new Date(now.getTime() + CODE_TTL_MS),
    lastSentAt: now,
  });
  await sendVerificationEmail(email, code, await getLocale());
}

export const registerAction = actionClient
  .inputSchema(registerSchema)
  .action(async ({ parsedInput }) => {
    const email = parsedInput.email.toLowerCase();
    const existing = await findUserByEmail(email);
    if (existing) throw new ActionError("auth.emailTaken");

    const passwordHash = await bcrypt.hash(parsedInput.password, 10);
    let userId: string;
    try {
      userId = await createUser({ name: parsedInput.name, email, passwordHash });
    } catch (e) {
      if (e instanceof MongoServerError && e.code === 11000) {
        throw new ActionError("auth.emailTaken");
      }
      throw e;
    }

    try {
      await issueCode(userId, email);
    } catch (e) {
      // The account exists either way; the user can resend from /verify.
      console.error("sending verification code failed:", e);
    }

    redirect(`/verify?email=${encodeURIComponent(email)}`);
  });

export const loginAction = actionClient
  .inputSchema(loginSchema)
  .action(async ({ parsedInput }) => {
    try {
      await signIn("credentials", { ...parsedInput, redirectTo: "/" });
    } catch (e) {
      if (e instanceof AuthError) {
        // authorize() failed — classify so the form can offer verification.
        const user = await findUserByEmail(parsedInput.email);
        if (
          user &&
          !user.emailVerified &&
          (await bcrypt.compare(parsedInput.password, user.passwordHash))
        ) {
          throw new ActionError("auth.emailNotVerified");
        }
        throw new ActionError("auth.invalidCredentials");
      }
      throw e; // NEXT_REDIRECT and unknown errors propagate
    }
  });

export const verifyEmailAction = actionClient
  .inputSchema(verifyEmailSchema)
  .action(async ({ parsedInput }): Promise<VerifyEmailResult> => {
    const user = await findUserByEmail(parsedInput.email);
    if (!user) return { status: "noActiveCode" };
    if (user.emailVerified) return { status: "verified" };

    const codeDoc = await findCodeByUserId(user._id);
    if (!codeDoc) return { status: "noActiveCode" };

    if (isExpired(codeDoc.expiresAt, new Date())) {
      await deleteCodeForUser(user._id);
      return { status: "codeExpired" };
    }

    if (hashCode(parsedInput.code) !== codeDoc.codeHash) {
      const attempts = await incrementAttempts(user._id);
      if (attempts >= MAX_ATTEMPTS) {
        await deleteCodeForUser(user._id);
        return { status: "tooManyAttempts" };
      }
      return { status: "codeInvalid", attemptsLeft: MAX_ATTEMPTS - attempts };
    }

    await markEmailVerified(user._id);
    await deleteCodeForUser(user._id);
    return { status: "verified" };
  });

export const resendVerificationCodeAction = actionClient
  .inputSchema(resendCodeSchema)
  .action(async ({ parsedInput }): Promise<ResendCodeResult> => {
    const user = await findUserByEmail(parsedInput.email);
    if (!user) throw new ActionError("auth.emailNotFound");
    if (user.emailVerified) return { status: "alreadyVerified" };

    const existing = await findCodeByUserId(user._id);
    if (existing) {
      const retryAfterSec = cooldownSecondsLeft(existing.lastSentAt, new Date());
      if (retryAfterSec > 0) return { status: "cooldown", retryAfterSec };
    }

    try {
      await issueCode(user._id, user.email);
    } catch (e) {
      console.error("sending verification code failed:", e);
      // Drop the undelivered code so the cooldown doesn't block an immediate retry.
      await deleteCodeForUser(user._id);
      throw new ActionError("auth.sendFailed");
    }
    return { status: "sent" };
  });

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
```

Notes for the implementer:
- The spec mentions a `CredentialsSignin` subclass for the unverified signal. We classify in `loginAction` instead (re-check the user after `signIn` fails): Auth.js wraps errors thrown inside `authorize` inconsistently across versions (`CallbackRouteError` vs the original), so reading a custom `code` off the caught error is fragile. The post-classification produces the same contract (`auth.emailNotVerified` only when the password is correct and the account is unverified) without depending on Auth.js error plumbing.
- `export type ...` is allowed in a `"use server"` file (types are erased); exporting non-async *values* is not.
- The verify action **returns statuses instead of throwing** so `attemptsLeft` travels with the result and the client can switch on `data.status` (per the spec's error contract).
- `registerAction` no longer auto-signs-in — login is blocked until verified anyway.

- [ ] **Step 4: Verify compile + suite**

Run: `npx tsc --noEmit && npx vitest run && npx eslint src`
Expected: all clean. (No new unit tests in this task — the branching logic on top of mocks would test mocks; the pure pieces are covered by Task 1 and the UI contract by Task 6.)

- [ ] **Step 5: Commit**

```bash
git add src/actions/auth.ts src/auth.ts src/messages
git commit -m "feat: verification-gated auth actions (register, login, verify, resend)"
```

---

### Task 6: Verify page, form, proxy route — with error-contract tests

**Files:**
- Create: `src/app/(auth)/verify/page.tsx`
- Create: `src/components/auth/verify-form.tsx`
- Test: `src/components/auth/verify-form.test.tsx`
- Modify: `src/proxy.ts` (AUTH_PAGES)
- Modify: `src/messages/en.json`, `src/messages/uk.json`

- [ ] **Step 1: Add the UI message keys**

`src/messages/en.json` → `"auth"`:

```json
    "verifyTitle": "Verify your email",
    "verifyInstructions": "Enter the 6-digit code we sent to your email.",
    "code": "Verification code",
    "verify": "Verify",
    "resendCode": "Resend code",
    "resendIn": "Resend available in {seconds}s",
    "codeSent": "A new code was sent",
    "codeInvalidAttempts": "Wrong code — {attemptsLeft, plural, one {# attempt} other {# attempts}} left",
    "tooManyAttempts": "Too many wrong attempts. Request a new code.",
    "codeExpired": "This code has expired. Request a new code.",
    "noActiveCode": "No active code for this email. Request a new one."
```

`src/messages/uk.json` → `"auth"`:

```json
    "verifyTitle": "Підтвердьте свою пошту",
    "verifyInstructions": "Введіть 6-значний код, надісланий на вашу пошту.",
    "code": "Код підтвердження",
    "verify": "Підтвердити",
    "resendCode": "Надіслати код ще раз",
    "resendIn": "Повторно через {seconds} с",
    "codeSent": "Новий код надіслано",
    "codeInvalidAttempts": "Невірний код — {attemptsLeft, plural, one {залишилась # спроба} few {залишилось # спроби} many {залишилось # спроб} other {залишилось # спроби}}",
    "tooManyAttempts": "Забагато невдалих спроб. Запросіть новий код.",
    "codeExpired": "Термін дії коду минув. Запросіть новий код.",
    "noActiveCode": "Немає активного коду для цієї пошти. Запросіть новий."
```

- [ ] **Step 2: Write the failing component tests**

Create `src/components/auth/verify-form.test.tsx`. The mocks make `execute()` synchronously invoke the component's `onSuccess` with preset data, keyed by action identity — this drives the full error contract without a server:

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";

// vi.mock factories are hoisted above imports — anything they capture
// must come from vi.hoisted, or it is "accessed before initialization".
const { nextData, push } = vi.hoisted(() => ({
  nextData: new Map<unknown, unknown>(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

// Action references are only used as map keys by the mocked useAction.
vi.mock("@/actions/auth", () => ({
  verifyEmailAction: "verifyEmailAction",
  resendVerificationCodeAction: "resendVerificationCodeAction",
}));

vi.mock("next-safe-action/hooks", () => ({
  useAction: (
    action: unknown,
    opts?: { onSuccess?: (args: { data: unknown }) => void },
  ) => ({
    execute: () => opts?.onSuccess?.({ data: nextData.get(action) }),
    result: {},
    isExecuting: false,
  }),
}));

import { VerifyForm } from "./verify-form";

afterEach(cleanup);
beforeEach(() => {
  nextData.clear();
  push.mockClear();
});

function renderForm(initialEmail = "user@example.com") {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <VerifyForm initialEmail={initialEmail} />
    </NextIntlClientProvider>,
  );
}

function submitCode(code: string) {
  fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: code } });
  fireEvent.click(screen.getByRole("button", { name: "Verify" }));
}

describe("VerifyForm", () => {
  it("redirects to login with the verified flag on success", () => {
    nextData.set("verifyEmailAction", { status: "verified" });
    renderForm();
    submitCode("123456");
    expect(push).toHaveBeenCalledWith("/login?verified=1");
  });

  it("shows remaining attempts after a wrong code and clears the input", () => {
    nextData.set("verifyEmailAction", { status: "codeInvalid", attemptsLeft: 3 });
    renderForm();
    submitCode("000000");
    expect(screen.getByText("Wrong code — 3 attempts left")).toBeInTheDocument();
    expect(screen.getByLabelText("Verification code")).toHaveValue("");
  });

  it("locks the form after too many attempts and unlocks on resend", () => {
    nextData.set("verifyEmailAction", { status: "tooManyAttempts" });
    renderForm();
    submitCode("000000");
    expect(
      screen.getByText("Too many wrong attempts. Request a new code."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Verification code")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Verify" })).toBeDisabled();

    nextData.set("resendVerificationCodeAction", { status: "sent" });
    fireEvent.click(screen.getByRole("button", { name: "Resend code" }));
    expect(screen.getByLabelText("Verification code")).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Verify" })).not.toBeDisabled();
    expect(screen.getByText("A new code was sent")).toBeInTheDocument();
  });

  it("locks the form when the code expired", () => {
    nextData.set("verifyEmailAction", { status: "codeExpired" });
    renderForm();
    submitCode("123456");
    expect(screen.getByText("This code has expired. Request a new code.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verify" })).toBeDisabled();
  });

  it("locks the form when there is no active code", () => {
    nextData.set("verifyEmailAction", { status: "noActiveCode" });
    renderForm();
    submitCode("123456");
    expect(
      screen.getByText("No active code for this email. Request a new one."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verify" })).toBeDisabled();
  });

  it("editing the email clears the locked state", () => {
    nextData.set("verifyEmailAction", { status: "noActiveCode" });
    renderForm();
    submitCode("123456");
    expect(screen.getByRole("button", { name: "Verify" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "other@example.com" },
    });
    expect(screen.getByRole("button", { name: "Verify" })).not.toBeDisabled();
  });

  it("shows a disabled countdown when the server reports a cooldown", () => {
    nextData.set("resendVerificationCodeAction", { status: "cooldown", retryAfterSec: 42 });
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Resend code" }));
    expect(screen.getByRole("button", { name: "Resend available in 42s" })).toBeDisabled();
  });

  it("redirects to login when the account is already verified", () => {
    nextData.set("resendVerificationCodeAction", { status: "alreadyVerified" });
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Resend code" }));
    expect(push).toHaveBeenCalledWith("/login?verified=1");
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/components/auth/verify-form.test.tsx`
Expected: FAIL — cannot resolve `./verify-form`.

- [ ] **Step 4: Implement the form**

Create `src/components/auth/verify-form.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { resendVerificationCodeAction, verifyEmailAction } from "@/actions/auth";
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

export function VerifyForm({ initialEmail }: { initialEmail: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown === 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // While locked, retrying cannot succeed — only a resend re-enables the form.
  const locked = feedback?.kind === "locked";

  const verify = useAction(verifyEmailAction, {
    onSuccess({ data }) {
      if (!data) return;
      switch (data.status) {
        case "verified":
          router.push("/login?verified=1");
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

  const resend = useAction(resendVerificationCodeAction, {
    onSuccess({ data }) {
      if (!data) return;
      if (data.status === "alreadyVerified") {
        router.push("/login?verified=1");
        return;
      }
      if (data.status === "cooldown") {
        setCooldown(data.retryAfterSec);
        return;
      }
      setFeedback({ kind: "sent" });
      setCode("");
      setCooldown(60);
    },
    onError({ error }) {
      setFeedback({ kind: "error", key: actionErrorKey(error) ?? "errors.server" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auth.verifyTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (locked || verify.isExecuting) return;
            verify.execute({ email, code });
          }}
        >
          <p className="text-sm text-muted-foreground">{t("auth.verifyInstructions")}</p>
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
                setFeedback(null); // a different email is a different verification state
              }}
            />
          </div>
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
            />
          </div>
          {feedback?.kind === "codeInvalid" && (
            <p className="text-sm text-destructive">
              {t("auth.codeInvalidAttempts", { attemptsLeft: feedback.attemptsLeft })}
            </p>
          )}
          {(feedback?.kind === "locked" || feedback?.kind === "error") && (
            <p className="text-sm text-destructive">{t(feedback.key)}</p>
          )}
          {feedback?.kind === "sent" && (
            <p className="text-sm text-green-600">{t("auth.codeSent")}</p>
          )}
          <Button
            type="submit"
            className="w-full"
            disabled={locked || verify.isExecuting}
          >
            {verify.isExecuting ? t("common.loading") : t("auth.verify")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={resend.isExecuting || cooldown > 0 || !email}
            onClick={() => resend.execute({ email })}
          >
            {cooldown > 0
              ? t("auth.resendIn", { seconds: cooldown })
              : resend.isExecuting
                ? t("common.loading")
                : t("auth.resendCode")}
          </Button>
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

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/components/auth/verify-form.test.tsx`
Expected: PASS (8 tests).

- [ ] **Step 6: Create the page and allow the route through the proxy**

Create `src/app/(auth)/verify/page.tsx` (Next 16: `searchParams` is a Promise):

```tsx
import { VerifyForm } from "@/components/auth/verify-form";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return <VerifyForm initialEmail={email ?? ""} />;
}
```

In `src/proxy.ts`, change:

```ts
const AUTH_PAGES = ["/login", "/register", "/verify"];
```

(Without this, unauthenticated visitors to `/verify` bounce to `/login`.)

- [ ] **Step 7: Full suite + lint + types**

Run: `npx tsc --noEmit && npx vitest run && npx eslint src`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(auth)/verify" src/components/auth/verify-form.tsx src/components/auth/verify-form.test.tsx src/proxy.ts src/messages
git commit -m "feat: verify page with attempt-aware error contract and resend cooldown"
```

---

### Task 7: Login page — verified banner and verify-now link

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/components/auth/login-form.tsx`
- Modify: `src/messages/en.json`, `src/messages/uk.json`

- [ ] **Step 1: Add the message keys**

`src/messages/en.json` → `"auth"`:

```json
    "verifiedNowLogin": "Email verified — please sign in",
    "verifyNow": "Verify now"
```

`src/messages/uk.json` → `"auth"`:

```json
    "verifiedNowLogin": "Пошту підтверджено — увійдіть",
    "verifyNow": "Підтвердити зараз"
```

- [ ] **Step 2: Pass the verified flag from the page**

Replace `src/app/(auth)/login/page.tsx`:

```tsx
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string }>;
}) {
  const { verified } = await searchParams;
  return <LoginForm verified={verified === "1"} />;
}
```

- [ ] **Step 3: Update the login form**

In `src/components/auth/login-form.tsx`:

1. Add `useState` import and a `verified` prop:

```tsx
import { useState } from "react";
...
export function LoginForm({ verified = false }: { verified?: boolean }) {
  const t = useTranslations();
  const { execute, result, isExecuting } = useAction(loginAction);
  const [submittedEmail, setSubmittedEmail] = useState("");
```

2. Capture the email on submit (inside the existing `onSubmit`, before `execute`):

```tsx
            const email = String(data.get("email"));
            setSubmittedEmail(email);
            execute({ email, password: String(data.get("password")) });
```

3. Add the verified banner right after `<form ...>`'s opening tag content area (above the email field):

```tsx
          {verified && (
            <p className="text-sm text-green-600">{t("auth.verifiedNowLogin")}</p>
          )}
```

4. Replace the existing server-error paragraph with a branch that links to `/verify` when the account is unverified:

```tsx
          {result.serverError === "auth.emailNotVerified" ? (
            <div className="space-y-1">
              <p className="text-sm text-destructive">{t("auth.emailNotVerified")}</p>
              <Link
                href={`/verify?email=${encodeURIComponent(submittedEmail)}`}
                className="text-sm underline"
              >
                {t("auth.verifyNow")}
              </Link>
            </div>
          ) : result.serverError ? (
            <p className="text-sm text-destructive">{t(result.serverError)}</p>
          ) : null}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx vitest run && npx eslint src`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(auth)/login/page.tsx" src/components/auth/login-form.tsx src/messages
git commit -m "feat: login verified banner and verify-now path for unverified accounts"
```

---

### Task 8: Docs, env, final verification

**Files:**
- Modify: `README.md`
- Verify: full build

- [ ] **Step 1: Update the README setup section**

In `README.md`, replace the setup env list (note: it still says `MONGODB_URI`; the actual var is `MONGODB_URI_CAR`):

```markdown
1. Copy `.env.local.example` to `.env.local` and fill in:
   - `MONGODB_URI_CAR` — MongoDB Atlas connection string
   - `MONGODB_DB` — database name (default `car_service_tracker`)
   - `AUTH_SECRET` — `openssl rand -base64 32`
   - `BREVO_API_KEY` — Brevo API key (app.brevo.com → SMTP & API → API Keys)
   - `EMAIL_FROM` — sender address verified in Brevo
   - `EMAIL_FROM_NAME` — display name for the sender (e.g. `Car Service Tracker`)
```

Add below the Setup section:

```markdown
## Email verification

Registration emails a 6-digit code (15-minute expiry, 5 attempts, 60s resend
cooldown) via [Brevo](https://www.brevo.com). Login is blocked until the email
is verified. Accounts created before this feature verify through the same flow:
log in → "Verify now" → resend code.
```

- [ ] **Step 2: Full verification**

Run: `npx tsc --noEmit && npx vitest run && npx eslint src && npm run build`
Expected: all green; build completes (Serwist step included via `npm run build`).

- [ ] **Step 3: Manual smoke (requires BREVO_API_KEY + verified sender in .env.local)**

Run `npm run dev` in a fresh terminal, then:
1. Register a new account with a real inbox you control → lands on `/verify?email=...`, email arrives with a 6-digit code.
2. Enter a wrong code → "Wrong code — 4 attempts left", input cleared.
3. Enter wrong codes until the cap → form disables; resend → form re-enables, new email arrives.
4. Enter the correct code → redirected to `/login` with the verified banner; sign in works.
5. Attempt login with a second, unverified account → "Your email is not verified yet" + "Verify now" link.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: email verification setup and flow"
```
