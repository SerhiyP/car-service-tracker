# Google-only Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace credentials + emailed-code auth (Brevo) with Google sign-in only, per the approved spec at `docs/superpowers/specs/2026-06-12-google-only-auth-design.md`.

**Architecture:** Auth.js v5 Google provider with JWT sessions (no DB adapter). On sign-in, a `jwt` callback override in `src/auth.ts` finds-or-creates the `users` doc by lowercased email and stores the Mongo `_id` in `token.id` — every downstream consumer (`session` callback, `authActionClient`, repositories) is unchanged. All register/verify/forgot/email-code code is deleted.

**Tech Stack:** Next.js 16 (App Router), Auth.js v5 beta (`next-auth@5.0.0-beta`), MongoDB native driver, next-intl, next-safe-action, Vitest + Testing Library.

**Branch:** `google-only-auth` (already exists, spec committed). Never commit on `main`.

**Conventions that apply throughout** (from AGENTS.md):
- `en.json` and `uk.json` must keep identical key sets.
- Page `searchParams` is a Promise — always `await` it.
- Repositories are thin untested wrappers; logic above them is tested with mocked repo functions.
- Gates after the work: `npx vitest run`, `npx tsc --noEmit`, `npx eslint src`, `npm run build`.

---

### Task 1: `resolveGoogleUserId` (find-or-create logic) + repo support

**Files:**
- Create: `src/lib/google-user.ts`
- Create: `src/lib/google-user.test.ts`
- Modify: `src/lib/repositories/users.ts` (add `createGoogleUser`, make `passwordHash` optional)
- Modify: `src/auth.ts` (transitional guard for optional `passwordHash`)
- Modify: `src/actions/auth.ts` (transitional guard for optional `passwordHash`)

The `users` collection has a unique index on `email` (the existing 11000 handling in `registerAction` relies on it); the race fallback below depends on that index.

- [ ] **Step 1: Write the failing test**

Create `src/lib/google-user.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { MongoServerError, ObjectId } from "mongodb";

// vi.mock factories are hoisted above imports — anything they capture
// must come from vi.hoisted, or it is "accessed before initialization".
const { findUserByEmail, createGoogleUser } = vi.hoisted(() => ({
  findUserByEmail: vi.fn(),
  createGoogleUser: vi.fn(),
}));

vi.mock("@/lib/repositories/users", () => ({ findUserByEmail, createGoogleUser }));

import { resolveGoogleUserId } from "./google-user";

afterEach(() => {
  findUserByEmail.mockReset();
  createGoogleUser.mockReset();
});

describe("resolveGoogleUserId", () => {
  it("returns the existing user's id when the email matches", async () => {
    const _id = new ObjectId();
    findUserByEmail.mockResolvedValue({ _id, email: "a@b.co", name: "A" });
    await expect(resolveGoogleUserId("a@b.co", "A")).resolves.toBe(_id.toHexString());
    expect(createGoogleUser).not.toHaveBeenCalled();
  });

  it("creates a user on first sign-in", async () => {
    findUserByEmail.mockResolvedValue(null);
    createGoogleUser.mockResolvedValue("65f1a2b3c4d5e6f7a8b9c0d1");
    await expect(resolveGoogleUserId("a@b.co", "A")).resolves.toBe(
      "65f1a2b3c4d5e6f7a8b9c0d1",
    );
    expect(createGoogleUser).toHaveBeenCalledWith({ email: "a@b.co", name: "A" });
  });

  it("re-reads after losing a duplicate-key race", async () => {
    const _id = new ObjectId();
    findUserByEmail.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id });
    const dup = new MongoServerError({ message: "E11000 duplicate key" });
    dup.code = 11000;
    createGoogleUser.mockRejectedValue(dup);
    await expect(resolveGoogleUserId("a@b.co", "A")).resolves.toBe(_id.toHexString());
  });

  it("propagates other DB errors", async () => {
    findUserByEmail.mockResolvedValue(null);
    createGoogleUser.mockRejectedValue(new Error("db down"));
    await expect(resolveGoogleUserId("a@b.co", "A")).rejects.toThrow("db down");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/google-user.test.ts`
Expected: FAIL — cannot resolve `./google-user` (module doesn't exist yet).

- [ ] **Step 3: Add `createGoogleUser` to the users repository and relax `passwordHash`**

In `src/lib/repositories/users.ts`, change the `UserDoc` interface field

```ts
  passwordHash: string;
```

to

```ts
  passwordHash?: string; // legacy credentials accounts; removed in cleanup task
```

and add below `createUser`:

```ts
export async function createGoogleUser(input: {
  email: string;
  name: string;
}): Promise<string> {
  const result = await users().insertOne({
    name: input.name,
    email: input.email.toLowerCase(),
  });
  return result.insertedId.toHexString();
}
```

- [ ] **Step 4: Patch the two `bcrypt.compare` call sites for the now-optional field**

(Both are deleted in later tasks; this just keeps `tsc` green at this commit.)

In `src/auth.ts`, inside `authorize`, change

```ts
        if (!user) return null;
        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
```

to

```ts
        if (!user?.passwordHash) return null;
        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
```

In `src/actions/auth.ts` (`loginAction`), change

```ts
        if (
          user &&
          !user.emailVerified &&
          (await bcrypt.compare(parsedInput.password, user.passwordHash))
        ) {
```

to

```ts
        if (
          user?.passwordHash &&
          !user.emailVerified &&
          (await bcrypt.compare(parsedInput.password, user.passwordHash))
        ) {
```

- [ ] **Step 5: Implement `resolveGoogleUserId`**

Create `src/lib/google-user.ts`:

```ts
import { MongoServerError } from "mongodb";
import { createGoogleUser, findUserByEmail } from "@/lib/repositories/users";

/**
 * Maps a Google sign-in to a users document, creating one on first sign-in.
 * Returns the Mongo id as a hex string for the JWT (`token.id`).
 */
export async function resolveGoogleUserId(email: string, name: string): Promise<string> {
  const existing = await findUserByEmail(email);
  if (existing) return existing._id.toHexString();
  try {
    return await createGoogleUser({ email, name });
  } catch (e) {
    // Concurrent first sign-ins: the unique email index makes the loser re-read.
    if (e instanceof MongoServerError && e.code === 11000) {
      const winner = await findUserByEmail(email);
      if (winner) return winner._id.toHexString();
    }
    throw e;
  }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/lib/google-user.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Verify types and commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add src/lib/google-user.ts src/lib/google-user.test.ts src/lib/repositories/users.ts src/auth.ts src/actions/auth.ts
git commit -m "Add Google sign-in user resolution (find-or-create by email)"
```

---

### Task 2: Swap the provider in `src/auth.ts`

**Files:**
- Modify: `src/auth.ts` (full rewrite, shown below)

`src/auth.config.ts` is deliberately untouched: `src/proxy.ts` builds its DB-free instance from it and only verifies the JWT (which already carries `id`). The callbacks below shadow `authConfig`'s `jwt` for the DB-capable instance only.

- [ ] **Step 1: Replace the contents of `src/auth.ts`**

```ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { authConfig } from "@/auth.config";
import { resolveGoogleUserId } from "@/lib/google-user";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [Google],
  callbacks: {
    ...authConfig.callbacks,
    signIn({ account, profile }) {
      // Email match grants access to the existing account — require a
      // Google-verified address so an unverified mailbox can't claim it.
      return account?.provider === "google" && profile?.email_verified === true;
    },
    async jwt({ token, account, profile }) {
      if (account?.provider === "google" && profile?.email) {
        token.id = await resolveGoogleUserId(profile.email, profile.name ?? profile.email);
      }
      return token;
    },
  },
});
```

Notes for the implementer:
- `Google` is passed bare; Auth.js v5 reads `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` from the environment by convention — no options object.
- If a DB error escapes `resolveGoogleUserId`, Auth.js fails the sign-in and redirects to `/login?error=...` — a session is never issued without a Mongo id in `token.id`.
- `loginAction` in `src/actions/auth.ts` still calls `signIn("credentials")`; it compiles (the argument is a string) and is deleted in Task 4. The credentials login path is non-functional from this commit on — acceptable mid-branch.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npx eslint src && npx vitest run`
Expected: all pass. (If `profile.email_verified` is not on the `Profile` type in the installed beta, check `node_modules/next-auth/lib/types.d.ts` — it is a standard OIDC claim on `Profile`; do not cast to `any`.)

- [ ] **Step 3: Commit**

```bash
git add src/auth.ts
git commit -m "Swap Credentials provider for Google"
```

---

### Task 3: New login UI + `loginWithGoogleAction` + new i18n keys

**Files:**
- Modify: `src/actions/auth.ts` (add one action)
- Modify: `src/messages/en.json`, `src/messages/uk.json` (add two keys)
- Modify: `src/components/auth/login-form.tsx` (full replacement)
- Create: `src/components/auth/login-form.test.tsx`
- Modify: `src/app/(auth)/login/page.tsx` (full replacement)

- [ ] **Step 1: Add the server action**

In `src/actions/auth.ts`, add (near `logoutAction`):

```ts
export async function loginWithGoogleAction() {
  // Throws NEXT_REDIRECT into the Google consent flow.
  await signIn("google", { redirectTo: "/" });
}
```

- [ ] **Step 2: Add the new i18n keys to BOTH catalogs**

In `src/messages/en.json`, inside the `"auth"` object, add:

```json
"continueWithGoogle": "Continue with Google",
"googleSignInFailed": "Google sign-in failed. Please try again."
```

In `src/messages/uk.json`, inside the `"auth"` object, add:

```json
"continueWithGoogle": "Увійти через Google",
"googleSignInFailed": "Не вдалося увійти через Google. Спробуйте ще раз."
```

- [ ] **Step 3: Write the failing component test**

Create `src/components/auth/login-form.test.tsx` (pattern follows `verify-form.test.tsx`):

```tsx
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";

// vi.mock factories are hoisted above imports — anything they capture
// must come from vi.hoisted, or it is "accessed before initialization".
const { loginWithGoogleAction } = vi.hoisted(() => ({
  loginWithGoogleAction: vi.fn(async () => {}),
}));

vi.mock("@/actions/auth", () => ({ loginWithGoogleAction }));

import { LoginForm } from "./login-form";

afterEach(() => {
  cleanup();
  loginWithGoogleAction.mockClear();
});

function renderForm(error = false) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <LoginForm error={error} />
    </NextIntlClientProvider>,
  );
}

describe("LoginForm", () => {
  it("invokes the Google sign-in action on submit", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    await waitFor(() => expect(loginWithGoogleAction).toHaveBeenCalled());
  });

  it("shows a generic error when redirected back with an error param", () => {
    renderForm(true);
    expect(
      screen.getByText("Google sign-in failed. Please try again."),
    ).toBeInTheDocument();
  });

  it("shows no error by default", () => {
    renderForm();
    expect(
      screen.queryByText("Google sign-in failed. Please try again."),
    ).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run src/components/auth/login-form.test.tsx`
Expected: FAIL — the current `LoginForm` renders the email/password form, no "Continue with Google" button.

- [ ] **Step 5: Replace `src/components/auth/login-form.tsx`**

```tsx
"use client";

import { useTranslations } from "next-intl";
import { loginWithGoogleAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginForm({ error = false }: { error?: boolean }) {
  const t = useTranslations();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auth.loginTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={loginWithGoogleAction} className="space-y-4">
          {error && (
            <p className="text-sm text-destructive">{t("auth.googleSignInFailed")}</p>
          )}
          <Button type="submit" size="lg" className="w-full">
            {t("auth.continueWithGoogle")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6: Replace `src/app/(auth)/login/page.tsx`**

Auth.js appends `?error=<code>` on failed sign-ins; one generic message, no per-code branching.

```tsx
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <LoginForm error={Boolean(error)} />;
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run src/components/auth/login-form.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 8: Verify the whole suite still passes and commit**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: all pass (old verify/forgot tests still exist and still pass — their modules are untouched so far).

```bash
git add src/actions/auth.ts src/messages/en.json src/messages/uk.json src/components/auth/login-form.tsx src/components/auth/login-form.test.tsx "src/app/(auth)/login/page.tsx"
git commit -m "Replace login form with Google sign-in button"
```

---

### Task 4: Delete the register/verify/forgot flows

**Files:**
- Delete: `src/app/(auth)/register/page.tsx`, `src/app/(auth)/verify/page.tsx`, `src/app/(auth)/forgot/page.tsx`
- Delete: `src/components/auth/register-form.tsx`, `src/components/auth/verify-form.tsx`, `src/components/auth/verify-form.test.tsx`, `src/components/auth/forgot-form.tsx`, `src/components/auth/forgot-form.test.tsx`
- Delete: `src/lib/schemas/auth.ts`
- Modify: `src/actions/auth.ts` (full replacement, shown below)
- Modify: `src/lib/schemas/schemas.test.ts` (prune auth cases)
- Modify: `src/proxy.ts` (shrink `AUTH_PAGES`)

- [ ] **Step 1: Delete the pages and components**

```bash
git rm "src/app/(auth)/register/page.tsx" "src/app/(auth)/verify/page.tsx" "src/app/(auth)/forgot/page.tsx"
git rm src/components/auth/register-form.tsx src/components/auth/verify-form.tsx src/components/auth/verify-form.test.tsx src/components/auth/forgot-form.tsx src/components/auth/forgot-form.test.tsx
git rm src/lib/schemas/auth.ts
```

- [ ] **Step 2: Replace `src/actions/auth.ts` entirely**

```ts
"use server";

import { signIn, signOut } from "@/auth";
import { authActionClient } from "@/lib/safe-action";
import { deleteUserCascade } from "@/lib/repositories/users";

export async function loginWithGoogleAction() {
  // Throws NEXT_REDIRECT into the Google consent flow.
  await signIn("google", { redirectTo: "/" });
}

export const deleteAccountAction = authActionClient.action(async ({ ctx }) => {
  await deleteUserCascade(ctx.userId);
  // Throws NEXT_REDIRECT — propagates like logoutAction's signOut.
  await signOut({ redirectTo: "/login" });
});

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
```

- [ ] **Step 3: Prune `src/lib/schemas/schemas.test.ts`**

Remove the import line

```ts
import { registerSchema, verifyEmailSchema, resendCodeSchema } from "./auth";
```

and the three describe blocks: `describe("auth schemas", ...)`, `describe("verifyEmailSchema", ...)`, `describe("resendCodeSchema", ...)`. Everything else (car/rule/standard-rules/visit) stays.

- [ ] **Step 4: Shrink `AUTH_PAGES` in `src/proxy.ts`**

```ts
const AUTH_PAGES = ["/login"];
```

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: all pass; deleted-module imports would fail `tsc` if anything still references them.

```bash
git add -A src
git commit -m "Delete register/verify/forgot flows"
```

---

### Task 5: Delete the email/verification modules and slim the users repository

**Files:**
- Delete: `src/lib/email.ts`, `src/lib/email.test.ts`, `src/lib/verification.ts`, `src/lib/verification.test.ts`, `src/lib/verification-flow.ts`, `src/lib/verification-flow.test.ts`, `src/lib/repositories/verification-codes.ts`
- Modify: `src/lib/repositories/users.ts` (full replacement, shown below)

- [ ] **Step 1: Delete the modules**

```bash
git rm src/lib/email.ts src/lib/email.test.ts src/lib/verification.ts src/lib/verification.test.ts src/lib/verification-flow.ts src/lib/verification-flow.test.ts src/lib/repositories/verification-codes.ts
```

- [ ] **Step 2: Replace `src/lib/repositories/users.ts` entirely**

Stale `passwordHash`/`emailVerified` fields on existing documents are simply ignored — no migration. The cascade keeps deleting `verification_codes` rows inline (the collection may still hold rows for this user from before the switch).

```ts
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";

export interface UserDoc {
  _id: ObjectId;
  email: string;
  name: string;
}

const users = () => getDb().collection<Omit<UserDoc, "_id">>("users");

export async function findUserByEmail(email: string): Promise<UserDoc | null> {
  return (await users().findOne({ email: email.toLowerCase() })) as UserDoc | null;
}

export async function createGoogleUser(input: {
  email: string;
  name: string;
}): Promise<string> {
  const result = await users().insertOne({
    name: input.name,
    email: input.email.toLowerCase(),
  });
  return result.insertedId.toHexString();
}

/** Permanently removes the user and everything they own. */
export async function deleteUserCascade(userId: ObjectId | string): Promise<void> {
  const _id = typeof userId === "string" ? new ObjectId(userId) : userId;
  const db = getDb();
  const carIds = await db
    .collection("cars")
    .find({ userId: _id }, { projection: { _id: 1 } })
    .map((doc) => doc._id)
    .toArray();
  if (carIds.length > 0) {
    await Promise.all([
      db.collection("maintenance_rules").deleteMany({ carId: { $in: carIds } }),
      db.collection("service_logs").deleteMany({ carId: { $in: carIds } }),
      db.collection("service_visits").deleteMany({ carId: { $in: carIds } }),
    ]);
  }
  await Promise.all([
    db.collection("cars").deleteMany({ userId: _id }),
    db.collection("verification_codes").deleteMany({ userId: _id }),
    users().deleteOne({ _id }),
  ]);
}
```

- [ ] **Step 3: Verify nothing references the deleted modules**

Run: `grep -rn "verification-codes\|verification-flow\|lib/email\|lib/verification" src` — expected: no matches.
Run: `npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add -A src
git commit -m "Delete email/verification modules; slim users repository"
```

---

### Task 6: Prune the i18n catalogs

**Files:**
- Modify: `src/messages/en.json`
- Modify: `src/messages/uk.json`

- [ ] **Step 1: Replace the `"auth"` object in `src/messages/en.json` with exactly**

```json
"auth": {
  "signOut": "Sign out",
  "loginTitle": "Welcome back",
  "continueWithGoogle": "Continue with Google",
  "googleSignInFailed": "Google sign-in failed. Please try again."
}
```

(`signOut` stays — used by `src/components/sign-out-button.tsx`; `loginTitle` stays — used by the new `LoginForm`. Everything else in `auth` goes.)

- [ ] **Step 2: Replace the `"auth"` object in `src/messages/uk.json` with exactly**

```json
"auth": {
  "signOut": "Вийти",
  "loginTitle": "З поверненням",
  "continueWithGoogle": "Увійти через Google",
  "googleSignInFailed": "Не вдалося увійти через Google. Спробуйте ще раз."
}
```

- [ ] **Step 3: Remove the now-unused `validation` keys from BOTH catalogs**

Delete these four keys from the `"validation"` object in `en.json` and `uk.json`:
`emailInvalid`, `passwordMin`, `passwordMax`, `codeInvalid`.

Keep `nameRequired` (used by `src/lib/schemas/car.ts`) and all other validation keys.

- [ ] **Step 4: Verify no removed key is still referenced, key sets match, suite passes**

```bash
grep -rEn "auth\.(signIn|signUp|email|password|name|registerTitle|noAccount|haveAccount|invalidCredentials|emailTaken|verifyEmail|emailNot|sendFailed|verifyTitle|verifyInstructions|code|verify|resend|tooManyAttempts|noActiveCode|verifiedNowLogin|forgot|sendCode|newPassword|resetPassword|resetEmail|resetNowLogin)|validation\.(emailInvalid|passwordMin|passwordMax|codeInvalid)" src --include="*.ts" --include="*.tsx" | grep -v messages
```
Expected: no matches.

```bash
python3 -c "
import json
en = json.load(open('src/messages/en.json'))
uk = json.load(open('src/messages/uk.json'))
def keys(d, p=''):
    out = set()
    for k, v in d.items():
        out |= keys(v, p + k + '.') if isinstance(v, dict) else {p + k}
    return out
diff = keys(en) ^ keys(uk)
print('OK' if not diff else diff)
"
```
Expected: `OK`.

Run: `npx vitest run`
Expected: PASS (component tests render against the en catalog and would fail on missing keys).

- [ ] **Step 5: Commit**

```bash
git add src/messages/en.json src/messages/uk.json
git commit -m "Prune email-code i18n keys"
```

---

### Task 7: Update env example, README, and AGENTS.md

**Files:**
- Modify: `.env.local.example` (full replacement, shown below)
- Modify: `README.md` (four spots, shown below)
- Modify: `AGENTS.md` (one bullet)

- [ ] **Step 1: Replace `.env.local.example` entirely**

```
# MongoDB Atlas connection string (user supplies real value in .env.local)
MONGODB_URI_CAR="mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority"
MONGODB_DB="car_service_tracker"
# Generate with: openssl rand -base64 32
AUTH_SECRET="change-me"
# Google OAuth client (console.cloud.google.com → APIs & Services → Credentials)
AUTH_GOOGLE_ID="....apps.googleusercontent.com"
AUTH_GOOGLE_SECRET="GOCSPX-..."
```

- [ ] **Step 2: Update README.md**

1. Replace the feature bullet
   ```
   - **Email verification** — registration requires confirming a 6-digit emailed
     code before login works.
   ```
   with
   ```
   - **Google sign-in** — authentication is Google-only; an account is created
     on first sign-in and matched by email afterwards.
   ```
2. In the Tech stack paragraph, replace `Auth.js v5 (Credentials, rolling JWT sessions)` with `Auth.js v5 (Google, rolling JWT sessions)`.
3. In Setup step 1, replace the three Brevo bullet lines (`BREVO_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME`) with:
   ```
   - `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — Google OAuth client
     (console.cloud.google.com → APIs & Services → Credentials; add
     `http://localhost:3000/api/auth/callback/google` and your production
     `https://<domain>/api/auth/callback/google` as authorized redirect URIs)
   ```
4. Replace the whole `## Email verification` section (heading + paragraph) with:
   ```
   ## Authentication

   Sign-in is Google-only (Auth.js v5, JWT sessions). On first sign-in a user
   record is created; subsequent sign-ins match it by email, so accounts that
   existed before the switch keep their data.
   ```

- [ ] **Step 3: Update AGENTS.md**

Replace the bullet

```
- **Auth:** Auth.js v5 split config (`src/auth.config.ts` DB-free +
  `src/auth.ts` with Credentials). Login is blocked for unverified emails.
```

with

```
- **Auth:** Auth.js v5 split config (`src/auth.config.ts` DB-free +
  `src/auth.ts` with Google). Google-only sign-in: the `jwt` callback
  find-or-creates the `users` doc by email (`src/lib/google-user.ts`) and
  stores the Mongo id in `token.id`. Env: `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`.
```

- [ ] **Step 4: Commit**

```bash
git add .env.local.example README.md AGENTS.md
git commit -m "Update env example and docs for Google-only auth"
```

---

### Task 8: Full gates + manual verification handoff

- [ ] **Step 1: Run all four gates**

```bash
npx vitest run && npx tsc --noEmit && npx eslint src && npm run build
```
Expected: all pass. The build needs no Google env vars (provider config is lazy).

- [ ] **Step 2: Manual setup & verification (owner does this — print these instructions)**

1. Google Cloud Console → APIs & Services → OAuth consent screen: External, app name, support email; publish.
2. Credentials → Create credentials → OAuth client ID → Web application; authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<app>.vercel.app/api/auth/callback/google`
3. Put `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` in `.env.local` and in Vercel project env vars.
4. Local check: `npm run dev`, open `http://localhost:3000` → redirected to `/login` → Continue with Google → sign in with the owner's account → lands on the garage **with existing cars visible** (proves the email-match migration).
5. After deploy: remove `BREVO_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME` from Vercel.

- [ ] **Step 3: Open the PR**

Per repo convention all work lands on `main` via PR:

```bash
git push -u origin google-only-auth
gh pr create --title "Google-only authentication" --body "Replaces credentials + Brevo email codes with Google sign-in per docs/superpowers/specs/2026-06-12-google-only-auth-design.md.

- Auth.js Google provider, JWT sessions, find-or-create by email (existing account picked up automatically)
- Deletes register/verify/forgot flows, email/verification modules, Brevo dependency
- Login page is a single Continue-with-Google button
- Requires AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET env vars (see README)

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```
