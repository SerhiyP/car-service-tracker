# Car Maintenance Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A mobile-first PWA that tracks vehicle consumables per user, shows green/yellow/red maintenance status, works read-only offline, and syncs to MongoDB Atlas.

**Architecture:** Next.js 16 App Router with client-rendered authenticated pages fed by a persisted Zustand store (offline reads); all mutations go through next-safe-action server actions with Zod validation and per-user ownership checks; Auth.js v5 Credentials with rolling 30d/1d JWT sessions; Serwist (Turbopack configurator mode) caches the app shell.

**Tech Stack:** Next.js 16.2.9 (Turbopack), React 19, TypeScript, MongoDB native driver, Zod v4, next-safe-action v8, Auth.js (next-auth v5 beta), Zustand v5, next-intl v4 (cookie locale, no URL prefix), Tailwind v4 + shadcn/ui, sonner, Serwist, Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-10-car-maintenance-tracker-design.md`

**Critical Next.js 16 facts (differ from older versions):**
- `proxy.ts` replaces `middleware.ts` (export a `proxy` function; Node.js runtime).
- Turbopack is the default bundler for dev AND build. Do not add webpack plugins.
- Server actions must each do their own auth — proxy is optimistic-redirect only.
- Bundled docs live at `node_modules/next/dist/docs/` — consult when an API surprises you.

**Conventions used throughout:**
- Import alias `@/` → `src/` (already configured in tsconfig.json).
- All user-facing strings are next-intl keys; both `en.json` and `uk.json` are fully defined in Task 3 — later tasks reference those keys, never hardcoded strings.
- Server errors thrown as `ActionError("<i18n key>")`; clients translate the key.
- ObjectIds and Dates never cross the server/client boundary — DTOs use `string`.

---

### Task 1: Dependencies & test tooling

**Files:**
- Modify: `package.json` (scripts)
- Create: `vitest.config.ts`, `vitest.setup.ts`, `.env.local.example`

- [ ] **Step 1: Install runtime dependencies**

```bash
npm install next-auth@beta mongodb zod next-safe-action zustand bcryptjs next-intl sonner @serwist/next
```

Expected: installs succeed; `next-auth` resolves to a 5.x beta, `next-safe-action` to 8.x, `zod` to 4.x.

- [ ] **Step 2: Install dev dependencies**

```bash
npm install -D serwist @serwist/turbopack esbuild vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 3: Add test scripts to package.json**

In `package.json` scripts, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Create vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
```

- [ ] **Step 5: Create vitest.setup.ts**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 6: Create .env.local.example**

```bash
# MongoDB Atlas connection string (user supplies real value in .env.local)
MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority"
MONGODB_DB="car_service_tracker"
# Generate with: openssl rand -base64 32
AUTH_SECRET="change-me"
```

Note: `.env.local` itself is supplied by the user and already gitignored (verify `.gitignore` contains `.env*`).

- [ ] **Step 7: Smoke-check tooling**

```bash
npx vitest run --passWithNoTests && npm run lint
```

Expected: vitest exits 0 ("no test files found" is OK with the flag); lint passes.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts vitest.setup.ts .env.local.example
git commit -m "chore: add runtime deps and vitest tooling"
```

---

### Task 2: shadcn/ui initialization

**Files:**
- Create: `components.json`, `src/lib/utils.ts`, `src/components/ui/*` (generated)
- Modify: `src/app/globals.css` (generated changes)

- [ ] **Step 1: Initialize shadcn**

```bash
npx shadcn@latest init --yes --base-color neutral
```

Expected: creates `components.json`, `src/lib/utils.ts`, updates `globals.css` with CSS variables. If the CLI asks anything despite `--yes`, accept defaults.

- [ ] **Step 2: Add the components we use**

```bash
npx shadcn@latest add --yes button card input label badge dialog select sonner skeleton
```

Expected: files appear under `src/components/ui/`.

- [ ] **Step 3: Verify build still works**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: init shadcn/ui with base components"
```

---

### Task 3: i18n foundation (next-intl, cookie locale, full message catalogs)

This comes BEFORE UI tasks so every component uses translation keys from day one.

**Files:**
- Modify: `next.config.ts`
- Create: `src/i18n/request.ts`, `src/i18n/config.ts`, `src/messages/en.json`, `src/messages/uk.json`, `src/actions/locale.ts`, `src/components/locale-switcher.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Wire the next-intl plugin in next.config.ts**

```ts
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
```

(Preserve any existing options from the current `next.config.ts` inside `nextConfig`.)

- [ ] **Step 2: Create src/i18n/config.ts**

```ts
export const locales = ["en", "uk"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const LOCALE_COOKIE = "locale";
```

- [ ] **Step 3: Create src/i18n/request.ts**

```ts
import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, LOCALE_COOKIE, locales, type Locale } from "./config";

export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieLocale = store.get(LOCALE_COOKIE)?.value;
  const locale: Locale = locales.includes(cookieLocale as Locale)
    ? (cookieLocale as Locale)
    : defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
```

- [ ] **Step 4: Create the full English catalog src/messages/en.json**

This is the COMPLETE catalog for the whole app. Later tasks reference these keys.

```json
{
  "common": {
    "appName": "Car Service Tracker",
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "add": "Add",
    "loading": "Loading…",
    "offline": "Offline",
    "confirmDelete": "Are you sure? This cannot be undone."
  },
  "nav": {
    "dashboard": "Dashboard",
    "garage": "Garage"
  },
  "auth": {
    "signIn": "Sign in",
    "signUp": "Create account",
    "signOut": "Sign out",
    "email": "Email",
    "password": "Password",
    "name": "Name",
    "loginTitle": "Welcome back",
    "registerTitle": "Create your account",
    "noAccount": "No account? Create one",
    "haveAccount": "Already have an account? Sign in",
    "invalidCredentials": "Invalid email or password",
    "emailTaken": "An account with this email already exists"
  },
  "dashboard": {
    "title": "Dashboard",
    "currentMileage": "Current mileage",
    "updateMileage": "Update",
    "noCar": "No cars yet",
    "addFirstCar": "Add your first car in the Garage",
    "noRules": "No consumables tracked for this car yet",
    "addRulesHint": "Open the car in the Garage to add maintenance rules",
    "remainingKm": "{km} km left",
    "remainingDays": "{days} days left",
    "overdueKm": "{km} km overdue",
    "overdueDays": "{days} days overdue",
    "neverServiced": "Never serviced",
    "lastService": "Last: {date} at {km} km",
    "logService": "Log service"
  },
  "garage": {
    "title": "Garage",
    "addCar": "Add car",
    "editCar": "Edit car",
    "carName": "Car name",
    "mileage": "Mileage (km)",
    "deleteCarConfirm": "Delete this car and all its rules and history?",
    "details": "Details"
  },
  "car": {
    "rules": "Maintenance rules",
    "history": "Service history",
    "addRule": "Add rule",
    "editRule": "Edit rule",
    "componentName": "Component",
    "intervalKm": "Interval (km)",
    "intervalMonths": "Interval (months)",
    "intervalHint": "Set at least one interval",
    "deleteRuleConfirm": "Delete this rule?",
    "logService": "Log service",
    "serviceDate": "Service date",
    "serviceMileage": "Mileage at service (km)",
    "deleteLogConfirm": "Delete this history entry?",
    "noLogs": "No service records yet"
  },
  "errors": {
    "server": "Something went wrong. Please try again.",
    "unauthorized": "Please sign in again",
    "offline": "You are offline — changes were not saved",
    "notFound": "Not found"
  },
  "validation": {
    "nameRequired": "Name is required",
    "emailInvalid": "Enter a valid email",
    "passwordMin": "Password must be at least 8 characters",
    "mileageInvalid": "Enter a valid mileage",
    "componentRequired": "Component name is required",
    "intervalRequired": "Set at least one interval",
    "dateFuture": "Date cannot be in the future"
  },
  "locale": {
    "language": "Language",
    "en": "English",
    "uk": "Українська"
  },
  "offlinePage": {
    "title": "You are offline",
    "description": "This page is not available offline. Your dashboard still works with the latest synced data."
  },
  "notFoundPage": {
    "title": "Page not found",
    "goHome": "Go to dashboard"
  },
  "errorPage": {
    "title": "Something went wrong",
    "retry": "Try again"
  }
}
```

- [ ] **Step 5: Create the Ukrainian catalog src/messages/uk.json**

```json
{
  "common": {
    "appName": "Car Service Tracker",
    "save": "Зберегти",
    "cancel": "Скасувати",
    "delete": "Видалити",
    "edit": "Редагувати",
    "add": "Додати",
    "loading": "Завантаження…",
    "offline": "Офлайн",
    "confirmDelete": "Ви впевнені? Цю дію не можна скасувати."
  },
  "nav": {
    "dashboard": "Головна",
    "garage": "Гараж"
  },
  "auth": {
    "signIn": "Увійти",
    "signUp": "Створити акаунт",
    "signOut": "Вийти",
    "email": "Ел. пошта",
    "password": "Пароль",
    "name": "Імʼя",
    "loginTitle": "З поверненням",
    "registerTitle": "Створіть акаунт",
    "noAccount": "Немає акаунта? Створіть",
    "haveAccount": "Вже є акаунт? Увійдіть",
    "invalidCredentials": "Неправильна пошта або пароль",
    "emailTaken": "Акаунт із цією поштою вже існує"
  },
  "dashboard": {
    "title": "Головна",
    "currentMileage": "Поточний пробіг",
    "updateMileage": "Оновити",
    "noCar": "Ще немає автомобілів",
    "addFirstCar": "Додайте перший автомобіль у Гаражі",
    "noRules": "Для цього авто ще немає витратників",
    "addRulesHint": "Відкрийте авто в Гаражі, щоб додати правила обслуговування",
    "remainingKm": "залишилось {km} км",
    "remainingDays": "залишилось {days} дн.",
    "overdueKm": "прострочено на {km} км",
    "overdueDays": "прострочено на {days} дн.",
    "neverServiced": "Ще не обслуговувалось",
    "lastService": "Останнє: {date} на {km} км",
    "logService": "Записати сервіс"
  },
  "garage": {
    "title": "Гараж",
    "addCar": "Додати авто",
    "editCar": "Редагувати авто",
    "carName": "Назва авто",
    "mileage": "Пробіг (км)",
    "deleteCarConfirm": "Видалити це авто разом з усіма правилами та історією?",
    "details": "Деталі"
  },
  "car": {
    "rules": "Правила обслуговування",
    "history": "Історія обслуговування",
    "addRule": "Додати правило",
    "editRule": "Редагувати правило",
    "componentName": "Компонент",
    "intervalKm": "Інтервал (км)",
    "intervalMonths": "Інтервал (місяців)",
    "intervalHint": "Вкажіть хоча б один інтервал",
    "deleteRuleConfirm": "Видалити це правило?",
    "logService": "Записати сервіс",
    "serviceDate": "Дата сервісу",
    "serviceMileage": "Пробіг на момент сервісу (км)",
    "deleteLogConfirm": "Видалити цей запис?",
    "noLogs": "Ще немає записів про сервіс"
  },
  "errors": {
    "server": "Щось пішло не так. Спробуйте ще раз.",
    "unauthorized": "Будь ласка, увійдіть знову",
    "offline": "Ви офлайн — зміни не збережено",
    "notFound": "Не знайдено"
  },
  "validation": {
    "nameRequired": "Вкажіть назву",
    "emailInvalid": "Введіть коректну пошту",
    "passwordMin": "Пароль має містити щонайменше 8 символів",
    "mileageInvalid": "Введіть коректний пробіг",
    "componentRequired": "Вкажіть назву компонента",
    "intervalRequired": "Вкажіть хоча б один інтервал",
    "dateFuture": "Дата не може бути в майбутньому"
  },
  "locale": {
    "language": "Мова",
    "en": "English",
    "uk": "Українська"
  },
  "offlinePage": {
    "title": "Ви офлайн",
    "description": "Ця сторінка недоступна офлайн. Головна працює з останніми синхронізованими даними."
  },
  "notFoundPage": {
    "title": "Сторінку не знайдено",
    "goHome": "На головну"
  },
  "errorPage": {
    "title": "Щось пішло не так",
    "retry": "Спробувати ще раз"
  }
}
```

- [ ] **Step 6: Create the locale-change server action src/actions/locale.ts**

```ts
"use server";

import { cookies } from "next/headers";
import { locales, LOCALE_COOKIE, type Locale } from "@/i18n/config";

export async function setLocale(locale: string) {
  if (!locales.includes(locale as Locale)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
  });
}
```

- [ ] **Step 7: Create src/components/locale-switcher.tsx**

```tsx
"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { setLocale } from "@/actions/locale";
import { locales } from "@/i18n/config";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("locale");
  const router = useRouter();

  return (
    <Select
      value={locale}
      onValueChange={async (value) => {
        await setLocale(value);
        router.refresh();
      }}
    >
      <SelectTrigger className="w-28" aria-label={t("language")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {locales.map((l) => (
          <SelectItem key={l} value={l}>
            {t(l)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 8: Wrap the root layout (src/app/layout.tsx)**

Replace the existing root layout body wiring (keep the existing font setup from create-next-app):

```tsx
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Car Service Tracker",
  description: "Track vehicle consumables and maintenance schedules",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className="antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
```

(Keep the font className if the generated layout has one.)

- [ ] **Step 9: Verify**

```bash
npm run build
```

Expected: build succeeds with the next-intl plugin active.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: i18n foundation with next-intl, en/uk catalogs, locale switcher"
```

---

### Task 4: Domain types & Zod schemas (TDD)

**Files:**
- Create: `src/lib/types.ts`, `src/lib/schemas/common.ts`, `src/lib/schemas/auth.ts`, `src/lib/schemas/car.ts`, `src/lib/schemas/rule.ts`, `src/lib/schemas/log.ts`
- Test: `src/lib/schemas/schemas.test.ts`

- [ ] **Step 1: Create src/lib/types.ts (DTOs crossing server/client boundary)**

```ts
export interface Car {
  id: string;
  name: string;
  currentMileage: number;
  updatedAt: string;
}

export interface MaintenanceRule {
  id: string;
  carId: string;
  componentName: string;
  intervalKm?: number;
  intervalMonths?: number;
}

export interface ServiceLog {
  id: string;
  carId: string;
  componentName: string;
  mileageAtService: number;
  dateAtService: string;
}

export interface GarageData {
  cars: Car[];
  rules: MaintenanceRule[];
  logs: ServiceLog[];
  syncedAt: string;
}
```

- [ ] **Step 2: Write failing schema tests src/lib/schemas/schemas.test.ts**

```ts
import { describe, expect, it } from "vitest";
import { registerSchema } from "./auth";
import { carInputSchema, mileageUpdateSchema } from "./car";
import { ruleInputSchema } from "./rule";
import { logInputSchema } from "./log";

const oid = "65f1a2b3c4d5e6f7a8b9c0d1";

describe("auth schemas", () => {
  it("accepts a valid registration", () => {
    expect(
      registerSchema.safeParse({
        name: "Serhii",
        email: "a@b.co",
        password: "12345678",
      }).success,
    ).toBe(true);
  });
  it("rejects short passwords and bad emails", () => {
    expect(
      registerSchema.safeParse({ name: "S", email: "a@b.co", password: "123" })
        .success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({ name: "S", email: "nope", password: "12345678" })
        .success,
    ).toBe(false);
  });
});

describe("car schemas", () => {
  it("accepts a valid car", () => {
    expect(
      carInputSchema.safeParse({ name: "Octavia", currentMileage: 120000 })
        .success,
    ).toBe(true);
  });
  it("rejects empty name and negative mileage", () => {
    expect(carInputSchema.safeParse({ name: "", currentMileage: 1 }).success).toBe(false);
    expect(carInputSchema.safeParse({ name: "A", currentMileage: -1 }).success).toBe(false);
  });
  it("validates mileage updates", () => {
    expect(mileageUpdateSchema.safeParse({ carId: oid, mileage: 5 }).success).toBe(true);
    expect(mileageUpdateSchema.safeParse({ carId: "short", mileage: 5 }).success).toBe(false);
  });
});

describe("rule schema", () => {
  it("requires at least one interval", () => {
    expect(
      ruleInputSchema.safeParse({ carId: oid, componentName: "Oil" }).success,
    ).toBe(false);
    expect(
      ruleInputSchema.safeParse({ carId: oid, componentName: "Oil", intervalKm: 10000 }).success,
    ).toBe(true);
    expect(
      ruleInputSchema.safeParse({ carId: oid, componentName: "Oil", intervalMonths: 12 }).success,
    ).toBe(true);
  });
  it("rejects non-positive intervals", () => {
    expect(
      ruleInputSchema.safeParse({ carId: oid, componentName: "Oil", intervalKm: 0 }).success,
    ).toBe(false);
  });
});

describe("log schema", () => {
  it("accepts a valid log and coerces the date", () => {
    const parsed = logInputSchema.safeParse({
      carId: oid,
      componentName: "Oil",
      mileageAtService: 100000,
      dateAtService: "2026-01-15",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.dateAtService).toBeInstanceOf(Date);
  });
  it("rejects future dates", () => {
    const future = new Date(Date.now() + 7 * 86_400_000).toISOString();
    expect(
      logInputSchema.safeParse({
        carId: oid,
        componentName: "Oil",
        mileageAtService: 1,
        dateAtService: future,
      }).success,
    ).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests, verify they fail**

```bash
npx vitest run src/lib/schemas
```

Expected: FAIL — modules not found.

- [ ] **Step 4: Implement the schemas**

`src/lib/schemas/common.ts`:

```ts
import { z } from "zod";

export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-f]{24}$/i, "errors.notFound");

export const mileageSchema = z
  .number("validation.mileageInvalid")
  .int("validation.mileageInvalid")
  .min(0, "validation.mileageInvalid")
  .max(9_999_999, "validation.mileageInvalid");
```

`src/lib/schemas/auth.ts`:

```ts
import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("validation.emailInvalid"),
  password: z.string().min(1, "validation.passwordMin"),
});

export const registerSchema = z.object({
  name: z.string().trim().min(1, "validation.nameRequired").max(100),
  email: z.email("validation.emailInvalid"),
  password: z.string().min(8, "validation.passwordMin").max(200),
});
```

`src/lib/schemas/car.ts`:

```ts
import { z } from "zod";
import { mileageSchema, objectIdSchema } from "./common";

export const carInputSchema = z.object({
  name: z.string().trim().min(1, "validation.nameRequired").max(100),
  currentMileage: mileageSchema,
});

export const carUpdateSchema = z.object({
  carId: objectIdSchema,
  name: z.string().trim().min(1, "validation.nameRequired").max(100),
});

export const mileageUpdateSchema = z.object({
  carId: objectIdSchema,
  mileage: mileageSchema,
});

export const carIdSchema = z.object({ carId: objectIdSchema });
```

`src/lib/schemas/rule.ts`:

```ts
import { z } from "zod";
import { objectIdSchema } from "./common";

const intervalKm = z.number().int().min(1).max(1_000_000);
const intervalMonths = z.number().int().min(1).max(600);

export const ruleInputSchema = z
  .object({
    carId: objectIdSchema,
    componentName: z.string().trim().min(1, "validation.componentRequired").max(100),
    intervalKm: intervalKm.optional(),
    intervalMonths: intervalMonths.optional(),
  })
  .refine((r) => r.intervalKm !== undefined || r.intervalMonths !== undefined, {
    message: "validation.intervalRequired",
    path: ["intervalKm"],
  });

export const ruleUpdateSchema = z
  .object({
    ruleId: objectIdSchema,
    carId: objectIdSchema,
    componentName: z.string().trim().min(1, "validation.componentRequired").max(100),
    intervalKm: intervalKm.optional(),
    intervalMonths: intervalMonths.optional(),
  })
  .refine((r) => r.intervalKm !== undefined || r.intervalMonths !== undefined, {
    message: "validation.intervalRequired",
    path: ["intervalKm"],
  });

export const ruleDeleteSchema = z.object({
  ruleId: objectIdSchema,
  carId: objectIdSchema,
});
```

`src/lib/schemas/log.ts`:

```ts
import { z } from "zod";
import { mileageSchema, objectIdSchema } from "./common";

// +1 day tolerance so "today" in any client timezone is accepted.
const notInFuture = (d: Date) => d.getTime() <= Date.now() + 86_400_000;

export const logInputSchema = z.object({
  carId: objectIdSchema,
  componentName: z.string().trim().min(1, "validation.componentRequired").max(100),
  mileageAtService: mileageSchema,
  dateAtService: z.coerce.date().refine(notInFuture, "validation.dateFuture"),
});

export const logDeleteSchema = z.object({
  logId: objectIdSchema,
  carId: objectIdSchema,
});
```

- [ ] **Step 5: Run tests, verify they pass**

```bash
npx vitest run src/lib/schemas
```

Expected: PASS (all).

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/schemas
git commit -m "feat: domain DTOs and zod schemas with i18n error keys"
```

---

### Task 5: Maintenance status logic (TDD — core business rules)

**Files:**
- Create: `src/lib/maintenance.ts`
- Test: `src/lib/maintenance.test.ts`

Spec rules (§6 of design): per dimension `remaining = (last + interval) - current`; Red if no history or any remaining ≤ 0; Yellow if any remaining < 15% of its interval, or < 1,000 km, or < 30 days; else Green. Overall status is the worst dimension.

- [ ] **Step 1: Write failing tests src/lib/maintenance.test.ts**

```ts
import { describe, expect, it } from "vitest";
import { addMonths, computeMaintenance, latestLogFor } from "./maintenance";
import type { ServiceLog } from "./types";

const NOW = new Date("2026-06-10T12:00:00Z");
const service = (mileage: number, date: string) => ({
  mileageAtService: mileage,
  dateAtService: new Date(date),
});

describe("addMonths", () => {
  it("adds months plainly", () => {
    expect(addMonths(new Date("2026-01-15"), 2).toISOString().slice(0, 10)).toBe("2026-03-15");
  });
  it("clamps month-end overflow (Jan 31 + 1m -> Feb 28)", () => {
    expect(addMonths(new Date("2026-01-31"), 1).toISOString().slice(0, 10)).toBe("2026-02-28");
  });
});

describe("computeMaintenance", () => {
  it("is red with no service history", () => {
    const r = computeMaintenance({ intervalKm: 10000 }, null, 50000, NOW);
    expect(r.status).toBe("red");
    expect(r.remainingKm).toBeNull();
    expect(r.remainingDays).toBeNull();
  });

  it("is green when plenty of km remain", () => {
    const r = computeMaintenance({ intervalKm: 10000 }, service(50000, "2026-05-01"), 52000, NOW);
    expect(r.status).toBe("green");
    expect(r.remainingKm).toBe(8000);
  });

  it("is red at exactly 0 km remaining", () => {
    const r = computeMaintenance({ intervalKm: 10000 }, service(50000, "2026-05-01"), 60000, NOW);
    expect(r.status).toBe("red");
    expect(r.remainingKm).toBe(0);
  });

  it("is red when overdue by km (negative remaining)", () => {
    const r = computeMaintenance({ intervalKm: 10000 }, service(50000, "2026-05-01"), 61000, NOW);
    expect(r.status).toBe("red");
    expect(r.remainingKm).toBe(-1000);
  });

  it("is yellow under 1000 km even if >15% remains", () => {
    // interval 5000, remaining 900 -> 18% but < 1000 km
    const r = computeMaintenance({ intervalKm: 5000 }, service(50000, "2026-05-01"), 54100, NOW);
    expect(r.status).toBe("yellow");
    expect(r.remainingKm).toBe(900);
  });

  it("is yellow under 15% of km interval", () => {
    // interval 20000, remaining 2500 -> 12.5% (>= 1000 km)
    const r = computeMaintenance({ intervalKm: 20000 }, service(50000, "2026-05-01"), 67500, NOW);
    expect(r.status).toBe("yellow");
    expect(r.remainingKm).toBe(2500);
  });

  it("is red when time-overdue", () => {
    const r = computeMaintenance({ intervalMonths: 6 }, service(50000, "2025-11-01"), 50100, NOW);
    expect(r.status).toBe("red");
    expect(r.remainingDays).toBeLessThanOrEqual(0);
  });

  it("is yellow under 30 days remaining", () => {
    // due 2026-07-01 -> 21 days from NOW
    const r = computeMaintenance({ intervalMonths: 12 }, service(50000, "2025-07-01"), 50100, NOW);
    expect(r.status).toBe("yellow");
    expect(r.remainingDays).toBe(21);
  });

  it("is green with months of time remaining", () => {
    const r = computeMaintenance({ intervalMonths: 12 }, service(50000, "2026-05-01"), 50100, NOW);
    expect(r.status).toBe("green");
    expect(r.remainingDays).toBeGreaterThan(300);
  });

  it("takes the worst of the two dimensions", () => {
    // km: green (8000 of 10000 left), time: red (overdue)
    const r = computeMaintenance(
      { intervalKm: 10000, intervalMonths: 1 },
      service(50000, "2026-01-01"),
      52000,
      NOW,
    );
    expect(r.status).toBe("red");
    expect(r.remainingKm).toBe(8000);
  });

  it("only computes the dimensions the rule defines", () => {
    const r = computeMaintenance({ intervalKm: 10000 }, service(50000, "2020-01-01"), 52000, NOW);
    expect(r.remainingDays).toBeNull();
    expect(r.status).toBe("green");
  });
});

describe("latestLogFor", () => {
  const logs: ServiceLog[] = [
    { id: "1", carId: "c1", componentName: "Oil", mileageAtService: 40000, dateAtService: "2025-06-01T00:00:00.000Z" },
    { id: "2", carId: "c1", componentName: "Oil", mileageAtService: 50000, dateAtService: "2026-01-01T00:00:00.000Z" },
    { id: "3", carId: "c1", componentName: "Brakes", mileageAtService: 55000, dateAtService: "2026-03-01T00:00:00.000Z" },
    { id: "4", carId: "c2", componentName: "Oil", mileageAtService: 99000, dateAtService: "2026-05-01T00:00:00.000Z" },
  ];
  it("picks the newest log for the car+component", () => {
    expect(latestLogFor(logs, "c1", "Oil")?.id).toBe("2");
  });
  it("returns null when none exist", () => {
    expect(latestLogFor(logs, "c1", "Coolant")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
npx vitest run src/lib/maintenance.test.ts
```

Expected: FAIL — `./maintenance` not found.

- [ ] **Step 3: Implement src/lib/maintenance.ts**

```ts
import type { ServiceLog } from "./types";

export type ComponentStatus = "green" | "yellow" | "red";

export interface MaintenanceInfo {
  status: ComponentStatus;
  remainingKm: number | null;
  remainingDays: number | null;
}

const DAY_MS = 86_400_000;
const YELLOW_KM_FLOOR = 1000;
const YELLOW_DAYS_FLOOR = 30;
const YELLOW_RATIO = 0.15;

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const daysInTarget = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, daysInTarget));
  return d;
}

function dimensionStatus(remaining: number, total: number, floor: number): ComponentStatus {
  if (remaining <= 0) return "red";
  if (remaining < floor || remaining < total * YELLOW_RATIO) return "yellow";
  return "green";
}

const WORST: Record<ComponentStatus, number> = { green: 0, yellow: 1, red: 2 };

export function computeMaintenance(
  rule: { intervalKm?: number; intervalMonths?: number },
  lastService: { mileageAtService: number; dateAtService: Date } | null,
  currentMileage: number,
  now: Date,
): MaintenanceInfo {
  if (!lastService) {
    return { status: "red", remainingKm: null, remainingDays: null };
  }

  const statuses: ComponentStatus[] = [];
  let remainingKm: number | null = null;
  let remainingDays: number | null = null;

  if (rule.intervalKm !== undefined) {
    remainingKm = lastService.mileageAtService + rule.intervalKm - currentMileage;
    statuses.push(dimensionStatus(remainingKm, rule.intervalKm, YELLOW_KM_FLOOR));
  }

  if (rule.intervalMonths !== undefined) {
    const due = addMonths(lastService.dateAtService, rule.intervalMonths);
    remainingDays = Math.ceil((due.getTime() - now.getTime()) / DAY_MS);
    const totalDays = (due.getTime() - lastService.dateAtService.getTime()) / DAY_MS;
    statuses.push(dimensionStatus(remainingDays, totalDays, YELLOW_DAYS_FLOOR));
  }

  const status = statuses.reduce<ComponentStatus>(
    (worst, s) => (WORST[s] > WORST[worst] ? s : worst),
    "green",
  );

  return { status, remainingKm, remainingDays };
}

export function latestLogFor(
  logs: ServiceLog[],
  carId: string,
  componentName: string,
): ServiceLog | null {
  let latest: ServiceLog | null = null;
  for (const log of logs) {
    if (log.carId !== carId || log.componentName !== componentName) continue;
    if (!latest || log.dateAtService > latest.dateAtService) latest = log;
  }
  return latest;
}
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
npx vitest run src/lib/maintenance.test.ts
```

Expected: PASS (all). If the "21 days" test is off by one, check that the test's NOW and due-date math match `Math.ceil`; fix the implementation, not the spec rule.

- [ ] **Step 5: Commit**

```bash
git add src/lib/maintenance.ts src/lib/maintenance.test.ts
git commit -m "feat: maintenance status calculation with full edge-case tests"
```

---

### Task 6: MongoDB client & repositories

**Files:**
- Create: `src/lib/db.ts`, `src/lib/repositories/users.ts`, `src/lib/repositories/cars.ts`, `src/lib/repositories/rules.ts`, `src/lib/repositories/logs.ts`

No unit tests here — these are thin I/O wrappers; correctness is exercised through the running app (and would need a live DB). Keep them free of business logic.

- [ ] **Step 1: Create src/lib/db.ts**

```ts
import { Db, MongoClient } from "mongodb";

declare global {
  // eslint-disable-next-line no-var
  var _mongo: { client: MongoClient; indexesEnsured: Promise<void> } | undefined;
}

function createClient(): MongoClient {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  return new MongoClient(uri, { maxPoolSize: 10 });
}

async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("cars").createIndex({ userId: 1 }),
    db.collection("maintenance_rules").createIndex({ carId: 1 }),
    db
      .collection("service_logs")
      .createIndex({ carId: 1, componentName: 1, dateAtService: -1 }),
  ]);
}

export function getDb(): Db {
  if (!global._mongo) {
    const client = createClient();
    const db = client.db(process.env.MONGODB_DB ?? "car_service_tracker");
    global._mongo = { client, indexesEnsured: ensureIndexes(db) };
  }
  return global._mongo.client.db(process.env.MONGODB_DB ?? "car_service_tracker");
}
```

- [ ] **Step 2: Create src/lib/repositories/users.ts**

```ts
import { ObjectId, type WithId, type Document } from "mongodb";
import { getDb } from "@/lib/db";

export interface UserDoc {
  _id: ObjectId;
  email: string;
  name: string;
  passwordHash: string;
}

const users = () => getDb().collection<Omit<UserDoc, "_id">>("users");

export async function findUserByEmail(email: string): Promise<UserDoc | null> {
  return (await users().findOne({ email: email.toLowerCase() })) as UserDoc | null;
}

export async function createUser(input: {
  name: string;
  email: string;
  passwordHash: string;
}): Promise<string> {
  const result = await users().insertOne({
    name: input.name,
    email: input.email.toLowerCase(),
    passwordHash: input.passwordHash,
  });
  return result.insertedId.toHexString();
}
```

- [ ] **Step 3: Create src/lib/repositories/cars.ts**

```ts
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import type { Car } from "@/lib/types";

interface CarDoc {
  userId: ObjectId;
  name: string;
  currentMileage: number;
  updatedAt: Date;
}

const cars = () => getDb().collection<CarDoc>("cars");

function toCar(doc: CarDoc & { _id: ObjectId }): Car {
  return {
    id: doc._id.toHexString(),
    name: doc.name,
    currentMileage: doc.currentMileage,
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function listCars(userId: string): Promise<Car[]> {
  const docs = await cars()
    .find({ userId: new ObjectId(userId) })
    .sort({ updatedAt: -1 })
    .toArray();
  return docs.map(toCar);
}

export async function ownsCar(userId: string, carId: string): Promise<boolean> {
  const count = await cars().countDocuments(
    { _id: new ObjectId(carId), userId: new ObjectId(userId) },
    { limit: 1 },
  );
  return count === 1;
}

export async function createCar(
  userId: string,
  input: { name: string; currentMileage: number },
): Promise<Car> {
  const doc: CarDoc = {
    userId: new ObjectId(userId),
    name: input.name,
    currentMileage: input.currentMileage,
    updatedAt: new Date(),
  };
  const result = await cars().insertOne(doc);
  return toCar({ ...doc, _id: result.insertedId });
}

export async function renameCar(
  userId: string,
  carId: string,
  name: string,
): Promise<boolean> {
  const result = await cars().updateOne(
    { _id: new ObjectId(carId), userId: new ObjectId(userId) },
    { $set: { name, updatedAt: new Date() } },
  );
  return result.matchedCount === 1;
}

export async function setCarMileage(
  userId: string,
  carId: string,
  mileage: number,
): Promise<boolean> {
  const result = await cars().updateOne(
    { _id: new ObjectId(carId), userId: new ObjectId(userId) },
    { $set: { currentMileage: mileage, updatedAt: new Date() } },
  );
  return result.matchedCount === 1;
}

export async function getCar(userId: string, carId: string): Promise<Car | null> {
  const doc = await cars().findOne({
    _id: new ObjectId(carId),
    userId: new ObjectId(userId),
  });
  return doc ? toCar(doc) : null;
}

export async function deleteCarCascade(
  userId: string,
  carId: string,
): Promise<boolean> {
  const result = await cars().deleteOne({
    _id: new ObjectId(carId),
    userId: new ObjectId(userId),
  });
  if (result.deletedCount !== 1) return false;
  const carObjectId = new ObjectId(carId);
  await Promise.all([
    getDb().collection("maintenance_rules").deleteMany({ carId: carObjectId }),
    getDb().collection("service_logs").deleteMany({ carId: carObjectId }),
  ]);
  return true;
}
```

- [ ] **Step 4: Create src/lib/repositories/rules.ts**

```ts
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import type { MaintenanceRule } from "@/lib/types";

interface RuleDoc {
  carId: ObjectId;
  componentName: string;
  intervalKm?: number;
  intervalMonths?: number;
}

const rules = () => getDb().collection<RuleDoc>("maintenance_rules");

function toRule(doc: RuleDoc & { _id: ObjectId }): MaintenanceRule {
  return {
    id: doc._id.toHexString(),
    carId: doc.carId.toHexString(),
    componentName: doc.componentName,
    ...(doc.intervalKm !== undefined && { intervalKm: doc.intervalKm }),
    ...(doc.intervalMonths !== undefined && { intervalMonths: doc.intervalMonths }),
  };
}

export async function listRulesByCarIds(carIds: string[]): Promise<MaintenanceRule[]> {
  if (carIds.length === 0) return [];
  const docs = await rules()
    .find({ carId: { $in: carIds.map((id) => new ObjectId(id)) } })
    .toArray();
  return docs.map(toRule);
}

export async function createRule(input: {
  carId: string;
  componentName: string;
  intervalKm?: number;
  intervalMonths?: number;
}): Promise<MaintenanceRule> {
  const doc: RuleDoc = {
    carId: new ObjectId(input.carId),
    componentName: input.componentName,
    ...(input.intervalKm !== undefined && { intervalKm: input.intervalKm }),
    ...(input.intervalMonths !== undefined && { intervalMonths: input.intervalMonths }),
  };
  const result = await rules().insertOne(doc);
  return toRule({ ...doc, _id: result.insertedId });
}

export async function updateRule(input: {
  ruleId: string;
  carId: string;
  componentName: string;
  intervalKm?: number;
  intervalMonths?: number;
}): Promise<boolean> {
  const result = await rules().replaceOne(
    { _id: new ObjectId(input.ruleId), carId: new ObjectId(input.carId) },
    {
      carId: new ObjectId(input.carId),
      componentName: input.componentName,
      ...(input.intervalKm !== undefined && { intervalKm: input.intervalKm }),
      ...(input.intervalMonths !== undefined && { intervalMonths: input.intervalMonths }),
    },
  );
  return result.matchedCount === 1;
}

export async function deleteRule(ruleId: string, carId: string): Promise<boolean> {
  const result = await rules().deleteOne({
    _id: new ObjectId(ruleId),
    carId: new ObjectId(carId),
  });
  return result.deletedCount === 1;
}
```

- [ ] **Step 5: Create src/lib/repositories/logs.ts**

```ts
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import type { ServiceLog } from "@/lib/types";

interface LogDoc {
  carId: ObjectId;
  componentName: string;
  mileageAtService: number;
  dateAtService: Date;
}

const logs = () => getDb().collection<LogDoc>("service_logs");

function toLog(doc: LogDoc & { _id: ObjectId }): ServiceLog {
  return {
    id: doc._id.toHexString(),
    carId: doc.carId.toHexString(),
    componentName: doc.componentName,
    mileageAtService: doc.mileageAtService,
    dateAtService: doc.dateAtService.toISOString(),
  };
}

export async function listLogsByCarIds(carIds: string[]): Promise<ServiceLog[]> {
  if (carIds.length === 0) return [];
  const docs = await logs()
    .find({ carId: { $in: carIds.map((id) => new ObjectId(id)) } })
    .sort({ dateAtService: -1 })
    .toArray();
  return docs.map(toLog);
}

export async function createLog(input: {
  carId: string;
  componentName: string;
  mileageAtService: number;
  dateAtService: Date;
}): Promise<ServiceLog> {
  const doc: LogDoc = {
    carId: new ObjectId(input.carId),
    componentName: input.componentName,
    mileageAtService: input.mileageAtService,
    dateAtService: input.dateAtService,
  };
  const result = await logs().insertOne(doc);
  return toLog({ ...doc, _id: result.insertedId });
}

export async function deleteLog(logId: string, carId: string): Promise<boolean> {
  const result = await logs().deleteOne({
    _id: new ObjectId(logId),
    carId: new ObjectId(carId),
  });
  return result.deletedCount === 1;
}
```

- [ ] **Step 6: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/db.ts src/lib/repositories
git commit -m "feat: mongodb client with idempotent indexes and thin repositories"
```

---

### Task 7: Auth.js core, safe-action clients, proxy

**Files:**
- Create: `src/auth.ts`, `src/types/next-auth.d.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/lib/safe-action.ts`, `src/proxy.ts`

- [ ] **Step 1: Create src/auth.ts**

```ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { loginSchema } from "@/lib/schemas/auth";
import { findUserByEmail } from "@/lib/repositories/users";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days total
    updateAge: 24 * 60 * 60, // re-issue at most daily (rolling)
  },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const user = await findUserByEmail(parsed.data.email);
        if (!user) return null;
        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;
        return { id: user._id.toHexString(), email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      return session;
    },
  },
});
```

- [ ] **Step 2: Create src/types/next-auth.d.ts**

```ts
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}
```

- [ ] **Step 3: Create src/app/api/auth/[...nextauth]/route.ts**

```ts
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 4: Create src/lib/safe-action.ts**

```ts
import { createSafeActionClient } from "next-safe-action";
import { auth } from "@/auth";

/** Thrown with an i18n key; the client translates it. */
export class ActionError extends Error {}

export const actionClient = createSafeActionClient({
  handleServerError(e) {
    if (e instanceof ActionError) return e.message;
    console.error("Action error:", e);
    return "errors.server";
  },
});

export const authActionClient = actionClient.use(async ({ next }) => {
  const session = await auth();
  if (!session?.user?.id) throw new ActionError("errors.unauthorized");
  return next({ ctx: { userId: session.user.id } });
});
```

- [ ] **Step 5: Create src/proxy.ts (optimistic redirects only)**

```ts
import { NextResponse, type NextRequest } from "next/server";

const AUTH_PAGES = ["/login", "/register"];
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

export function proxy(request: NextRequest) {
  const hasSession = SESSION_COOKIES.some((c) => request.cookies.has(c));
  const isAuthPage = AUTH_PAGES.some((p) =>
    request.nextUrl.pathname.startsWith(p),
  );

  if (!hasSession && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (hasSession && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Skip API routes, static assets, the service worker, and files with extensions.
  matcher: ["/((?!api|_next|sw\\.js|manifest\\.webmanifest|~offline|.*\\..*).*)"],
};
```

- [ ] **Step 6: Set up the local secret**

Append a generated secret to `.env.local` if `AUTH_SECRET` is not already present (do not overwrite the user's `MONGODB_URI`):

```bash
grep -q AUTH_SECRET .env.local 2>/dev/null || echo "AUTH_SECRET=\"$(openssl rand -base64 32)\"" >> .env.local
```

- [ ] **Step 7: Verify compile + build**

```bash
npx tsc --noEmit && npm run build
```

Expected: success.

- [ ] **Step 8: Commit**

```bash
git add src/auth.ts src/types/next-auth.d.ts src/app/api src/lib/safe-action.ts src/proxy.ts
git commit -m "feat: auth.js credentials with rolling jwt, safe-action clients, proxy redirects"
```

---### Task 8: Auth actions & login/register UI

**Files:**
- Create: `src/actions/auth.ts`, `src/app/(auth)/layout.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/register/page.tsx`, `src/components/auth/login-form.tsx`, `src/components/auth/register-form.tsx`

- [ ] **Step 1: Create src/actions/auth.ts**

```ts
"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { signIn, signOut } from "@/auth";
import { ActionError, actionClient } from "@/lib/safe-action";
import { loginSchema, registerSchema } from "@/lib/schemas/auth";
import { createUser, findUserByEmail } from "@/lib/repositories/users";

export const registerAction = actionClient
  .inputSchema(registerSchema)
  .action(async ({ parsedInput }) => {
    const existing = await findUserByEmail(parsedInput.email);
    if (existing) throw new ActionError("auth.emailTaken");

    const passwordHash = await bcrypt.hash(parsedInput.password, 10);
    await createUser({
      name: parsedInput.name,
      email: parsedInput.email,
      passwordHash,
    });

    // Throws NEXT_REDIRECT on success — must propagate.
    await signIn("credentials", {
      email: parsedInput.email,
      password: parsedInput.password,
      redirectTo: "/",
    });
  });

export const loginAction = actionClient
  .inputSchema(loginSchema)
  .action(async ({ parsedInput }) => {
    try {
      await signIn("credentials", { ...parsedInput, redirectTo: "/" });
    } catch (e) {
      if (e instanceof AuthError) throw new ActionError("auth.invalidCredentials");
      throw e; // NEXT_REDIRECT and unknown errors propagate
    }
  });

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
```

- [ ] **Step 2: Create src/app/(auth)/layout.tsx**

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
```

- [ ] **Step 3: Create src/components/auth/login-form.tsx**

```tsx
"use client";

import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { loginAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const t = useTranslations();
  const { execute, result, isExecuting } = useAction(loginAction);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auth.loginTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            execute({
              email: String(data.get("email")),
              password: String(data.get("password")),
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          {result.serverError && (
            <p className="text-sm text-destructive">{t(result.serverError)}</p>
          )}
          <Button type="submit" className="w-full" disabled={isExecuting}>
            {isExecuting ? t("common.loading") : t("auth.signIn")}
          </Button>
          <p className="text-center text-sm">
            <Link href="/register" className="underline">
              {t("auth.noAccount")}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Create src/components/auth/register-form.tsx**

```tsx
"use client";

import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { registerAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function FieldError({ messages }: { messages?: string[] }) {
  const t = useTranslations();
  if (!messages?.length) return null;
  return <p className="text-sm text-destructive">{t(messages[0])}</p>;
}

export function RegisterForm() {
  const t = useTranslations();
  const { execute, result, isExecuting } = useAction(registerAction);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auth.registerTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            execute({
              name: String(data.get("name")),
              email: String(data.get("email")),
              password: String(data.get("password")),
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="name">{t("auth.name")}</Label>
            <Input id="name" name="name" autoComplete="name" required />
            <FieldError messages={result.validationErrors?.name?._errors} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
            <FieldError messages={result.validationErrors?.email?._errors} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
            />
            <FieldError messages={result.validationErrors?.password?._errors} />
          </div>
          {result.serverError && (
            <p className="text-sm text-destructive">{t(result.serverError)}</p>
          )}
          <Button type="submit" className="w-full" disabled={isExecuting}>
            {isExecuting ? t("common.loading") : t("auth.signUp")}
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

Note: if TypeScript complains about the shape of `result.validationErrors` (its format follows next-safe-action's default `formatValidationErrors`), check the installed version's types and adjust `FieldError` access accordingly — the docs pattern is `validationErrors?.fieldName?._errors`.

- [ ] **Step 5: Create the two pages**

`src/app/(auth)/login/page.tsx`:

```tsx
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return <LoginForm />;
}
```

`src/app/(auth)/register/page.tsx`:

```tsx
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return <RegisterForm />;
}
```

- [ ] **Step 6: Verify end-to-end against the real database**

`.env.local` must contain the user's real `MONGODB_URI`. Then:

```bash
npm run dev
```

In a second shell, verify the register → session flow with curl (replace nothing; cookie jar keeps the session):

```bash
sleep 5
curl -s -c /tmp/cookies.txt http://localhost:3000/login -o /dev/null -w "%{http_code}\n"
```

Expected: `200`. Then manually check in a browser (or report to the user to test): register at `/login` → `/register`, land on `/`. If `MONGODB_URI` is missing, STOP and ask the user to fill `.env.local` before continuing.

- [ ] **Step 7: Commit**

```bash
git add src/actions/auth.ts src/app/\(auth\) src/components/auth
git commit -m "feat: register/login/logout actions and auth pages"
```

---

### Task 9: Garage data server actions (cars, rules, logs)

**Files:**
- Create: `src/actions/garage.ts`, `src/actions/cars.ts`, `src/actions/rules.ts`, `src/actions/logs.ts`

All actions use `authActionClient` (Task 7) — `ctx.userId` is guaranteed. Ownership of `carId` is verified before every rule/log write.

- [ ] **Step 1: Create src/actions/garage.ts**

```ts
"use server";

import { authActionClient } from "@/lib/safe-action";
import { listCars } from "@/lib/repositories/cars";
import { listRulesByCarIds } from "@/lib/repositories/rules";
import { listLogsByCarIds } from "@/lib/repositories/logs";
import type { GarageData } from "@/lib/types";

export const getGarageDataAction = authActionClient.action(
  async ({ ctx }): Promise<GarageData> => {
    const cars = await listCars(ctx.userId);
    const carIds = cars.map((c) => c.id);
    const [rules, logs] = await Promise.all([
      listRulesByCarIds(carIds),
      listLogsByCarIds(carIds),
    ]);
    return { cars, rules, logs, syncedAt: new Date().toISOString() };
  },
);
```

- [ ] **Step 2: Create src/actions/cars.ts**

```ts
"use server";

import { ActionError, authActionClient } from "@/lib/safe-action";
import {
  carIdSchema,
  carInputSchema,
  carUpdateSchema,
  mileageUpdateSchema,
} from "@/lib/schemas/car";
import {
  createCar,
  deleteCarCascade,
  renameCar,
  setCarMileage,
} from "@/lib/repositories/cars";

export const createCarAction = authActionClient
  .inputSchema(carInputSchema)
  .action(async ({ parsedInput, ctx }) => {
    return await createCar(ctx.userId, parsedInput);
  });

export const renameCarAction = authActionClient
  .inputSchema(carUpdateSchema)
  .action(async ({ parsedInput, ctx }) => {
    const ok = await renameCar(ctx.userId, parsedInput.carId, parsedInput.name);
    if (!ok) throw new ActionError("errors.notFound");
    return { ok: true };
  });

export const updateCarMileageAction = authActionClient
  .inputSchema(mileageUpdateSchema)
  .action(async ({ parsedInput, ctx }) => {
    const ok = await setCarMileage(ctx.userId, parsedInput.carId, parsedInput.mileage);
    if (!ok) throw new ActionError("errors.notFound");
    return { ok: true };
  });

export const deleteCarAction = authActionClient
  .inputSchema(carIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    const ok = await deleteCarCascade(ctx.userId, parsedInput.carId);
    if (!ok) throw new ActionError("errors.notFound");
    return { ok: true };
  });
```

- [ ] **Step 3: Create src/actions/rules.ts**

```ts
"use server";

import { ActionError, authActionClient } from "@/lib/safe-action";
import {
  ruleDeleteSchema,
  ruleInputSchema,
  ruleUpdateSchema,
} from "@/lib/schemas/rule";
import { ownsCar } from "@/lib/repositories/cars";
import { createRule, deleteRule, updateRule } from "@/lib/repositories/rules";

export const createRuleAction = authActionClient
  .inputSchema(ruleInputSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!(await ownsCar(ctx.userId, parsedInput.carId)))
      throw new ActionError("errors.notFound");
    return await createRule(parsedInput);
  });

export const updateRuleAction = authActionClient
  .inputSchema(ruleUpdateSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!(await ownsCar(ctx.userId, parsedInput.carId)))
      throw new ActionError("errors.notFound");
    const ok = await updateRule(parsedInput);
    if (!ok) throw new ActionError("errors.notFound");
    return { ok: true };
  });

export const deleteRuleAction = authActionClient
  .inputSchema(ruleDeleteSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!(await ownsCar(ctx.userId, parsedInput.carId)))
      throw new ActionError("errors.notFound");
    const ok = await deleteRule(parsedInput.ruleId, parsedInput.carId);
    if (!ok) throw new ActionError("errors.notFound");
    return { ok: true };
  });
```

- [ ] **Step 4: Create src/actions/logs.ts**

```ts
"use server";

import { ActionError, authActionClient } from "@/lib/safe-action";
import { logDeleteSchema, logInputSchema } from "@/lib/schemas/log";
import { getCar, setCarMileage } from "@/lib/repositories/cars";
import { createLog, deleteLog } from "@/lib/repositories/logs";

export const createLogAction = authActionClient
  .inputSchema(logInputSchema)
  .action(async ({ parsedInput, ctx }) => {
    const car = await getCar(ctx.userId, parsedInput.carId);
    if (!car) throw new ActionError("errors.notFound");

    const log = await createLog(parsedInput);

    // Spec: a service at a higher mileage raises the car's current mileage.
    let newCarMileage: number | null = null;
    if (parsedInput.mileageAtService > car.currentMileage) {
      await setCarMileage(ctx.userId, parsedInput.carId, parsedInput.mileageAtService);
      newCarMileage = parsedInput.mileageAtService;
    }

    return { log, newCarMileage };
  });

export const deleteLogAction = authActionClient
  .inputSchema(logDeleteSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!(await getCar(ctx.userId, parsedInput.carId)))
      throw new ActionError("errors.notFound");
    const ok = await deleteLog(parsedInput.logId, parsedInput.carId);
    if (!ok) throw new ActionError("errors.notFound");
    return { ok: true };
  });
```

- [ ] **Step 5: Verify compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/actions
git commit -m "feat: garage server actions with ownership checks and mileage auto-raise"
```

---

### Task 10: Zustand store (TDD) & garage sync provider

**Files:**
- Create: `src/stores/garage.ts`, `src/hooks/use-online.ts`, `src/components/garage-provider.tsx`
- Test: `src/stores/garage.test.ts`

- [ ] **Step 1: Write failing store tests src/stores/garage.test.ts**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { useGarageStore } from "./garage";
import type { Car, GarageData, ServiceLog } from "@/lib/types";

const car = (id: string, mileage = 1000): Car => ({
  id,
  name: `Car ${id}`,
  currentMileage: mileage,
  updatedAt: "2026-06-01T00:00:00.000Z",
});

const data: GarageData = {
  cars: [car("a"), car("b")],
  rules: [],
  logs: [],
  syncedAt: "2026-06-10T00:00:00.000Z",
};

beforeEach(() => {
  useGarageStore.setState(useGarageStore.getInitialState());
});

describe("garage store", () => {
  it("setAll replaces data and keeps a valid selection", () => {
    useGarageStore.getState().setAll(data);
    const s = useGarageStore.getState();
    expect(s.cars).toHaveLength(2);
    expect(s.selectedCarId).toBe("a");
  });

  it("setAll preserves an existing valid selection", () => {
    useGarageStore.getState().setAll(data);
    useGarageStore.getState().selectCar("b");
    useGarageStore.getState().setAll(data);
    expect(useGarageStore.getState().selectedCarId).toBe("b");
  });

  it("setCarMileage updates the car", () => {
    useGarageStore.getState().setAll(data);
    useGarageStore.getState().setCarMileage("a", 2222);
    expect(useGarageStore.getState().cars.find((c) => c.id === "a")?.currentMileage).toBe(2222);
  });

  it("removeCar drops its rules/logs and fixes selection", () => {
    useGarageStore.getState().setAll({
      ...data,
      rules: [{ id: "r1", carId: "a", componentName: "Oil", intervalKm: 1 }],
      logs: [
        {
          id: "l1",
          carId: "a",
          componentName: "Oil",
          mileageAtService: 1,
          dateAtService: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    useGarageStore.getState().removeCar("a");
    const s = useGarageStore.getState();
    expect(s.cars.map((c) => c.id)).toEqual(["b"]);
    expect(s.rules).toHaveLength(0);
    expect(s.logs).toHaveLength(0);
    expect(s.selectedCarId).toBe("b");
  });

  it("addLog + replaceLog swaps the temp entry for the server one", () => {
    useGarageStore.getState().setAll(data);
    const temp: ServiceLog = {
      id: "temp-1",
      carId: "a",
      componentName: "Oil",
      mileageAtService: 1500,
      dateAtService: "2026-06-09T00:00:00.000Z",
    };
    useGarageStore.getState().addLog(temp);
    useGarageStore.getState().replaceLog("temp-1", { ...temp, id: "real-1" });
    const ids = useGarageStore.getState().logs.map((l) => l.id);
    expect(ids).toEqual(["real-1"]);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
npx vitest run src/stores
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement src/stores/garage.ts**

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Car, GarageData, MaintenanceRule, ServiceLog } from "@/lib/types";

interface GarageState {
  cars: Car[];
  rules: MaintenanceRule[];
  logs: ServiceLog[];
  selectedCarId: string | null;
  syncedAt: string | null;
  hasHydrated: boolean;

  setAll: (data: GarageData) => void;
  selectCar: (carId: string) => void;
  upsertCar: (car: Car) => void;
  removeCar: (carId: string) => void;
  setCarMileage: (carId: string, mileage: number) => void;
  upsertRule: (rule: MaintenanceRule) => void;
  removeRule: (ruleId: string) => void;
  addLog: (log: ServiceLog) => void;
  replaceLog: (oldId: string, log: ServiceLog) => void;
  removeLog: (logId: string) => void;
  setHasHydrated: (v: boolean) => void;
}

export const useGarageStore = create<GarageState>()(
  persist(
    (set) => ({
      cars: [],
      rules: [],
      logs: [],
      selectedCarId: null,
      syncedAt: null,
      hasHydrated: false,

      setAll: (data) =>
        set((s) => ({
          cars: data.cars,
          rules: data.rules,
          logs: data.logs,
          syncedAt: data.syncedAt,
          selectedCarId: data.cars.some((c) => c.id === s.selectedCarId)
            ? s.selectedCarId
            : (data.cars[0]?.id ?? null),
        })),

      selectCar: (carId) => set({ selectedCarId: carId }),

      upsertCar: (car) =>
        set((s) => ({
          cars: s.cars.some((c) => c.id === car.id)
            ? s.cars.map((c) => (c.id === car.id ? car : c))
            : [...s.cars, car],
          selectedCarId: s.selectedCarId ?? car.id,
        })),

      removeCar: (carId) =>
        set((s) => {
          const cars = s.cars.filter((c) => c.id !== carId);
          return {
            cars,
            rules: s.rules.filter((r) => r.carId !== carId),
            logs: s.logs.filter((l) => l.carId !== carId),
            selectedCarId:
              s.selectedCarId === carId ? (cars[0]?.id ?? null) : s.selectedCarId,
          };
        }),

      setCarMileage: (carId, mileage) =>
        set((s) => ({
          cars: s.cars.map((c) =>
            c.id === carId ? { ...c, currentMileage: mileage } : c,
          ),
        })),

      upsertRule: (rule) =>
        set((s) => ({
          rules: s.rules.some((r) => r.id === rule.id)
            ? s.rules.map((r) => (r.id === rule.id ? rule : r))
            : [...s.rules, rule],
        })),

      removeRule: (ruleId) =>
        set((s) => ({ rules: s.rules.filter((r) => r.id !== ruleId) })),

      addLog: (log) => set((s) => ({ logs: [log, ...s.logs] })),

      replaceLog: (oldId, log) =>
        set((s) => ({ logs: s.logs.map((l) => (l.id === oldId ? log : l)) })),

      removeLog: (logId) =>
        set((s) => ({ logs: s.logs.filter((l) => l.id !== logId) })),

      setHasHydrated: (v) => set({ hasHydrated: v }),
    }),
    {
      name: "garage-store",
      partialize: (s) => ({
        cars: s.cars,
        rules: s.rules,
        logs: s.logs,
        selectedCarId: s.selectedCarId,
        syncedAt: s.syncedAt,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
npx vitest run src/stores
```

Expected: PASS. (If `getInitialState` is unavailable in the installed zustand version, reset with an explicit initial-state object in the test instead.)

- [ ] **Step 5: Create src/hooks/use-online.ts**

```ts
"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
```

- [ ] **Step 6: Create src/components/garage-provider.tsx**

```tsx
"use client";

import { useEffect } from "react";
import { getGarageDataAction } from "@/actions/garage";
import { useGarageStore } from "@/stores/garage";

export function GarageProvider({ children }: { children: React.ReactNode }) {
  const setAll = useGarageStore((s) => s.setAll);

  useEffect(() => {
    let cancelled = false;
    getGarageDataAction().then((result) => {
      if (!cancelled && result?.data) setAll(result.data);
    });
    const onOnline = () => {
      getGarageDataAction().then((result) => {
        if (!cancelled && result?.data) setAll(result.data);
      });
    };
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
    };
  }, [setAll]);

  return <>{children}</>;
}
```

- [ ] **Step 7: Run all tests**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/stores src/hooks src/components/garage-provider.tsx
git commit -m "feat: persisted garage store with optimistic helpers and sync provider"
```

---

### Task 11: Authenticated app shell

**Files:**
- Create: `src/app/(app)/layout.tsx`, `src/components/bottom-nav.tsx`, `src/components/app-header.tsx`, `src/components/sign-out-button.tsx`

- [ ] **Step 1: Create src/components/bottom-nav.tsx**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { CarFront, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  const items = [
    { href: "/", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/cars", label: t("garage"), icon: CarFront },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-md">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-xs",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

(lucide-react is installed by shadcn init; if missing: `npm i lucide-react`.)

- [ ] **Step 2: Create src/components/sign-out-button.tsx**

```tsx
"use client";

import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const t = useTranslations("auth");
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t("signOut")}
      onClick={() => logoutAction()}
    >
      <LogOut className="size-5" />
    </Button>
  );
}
```

- [ ] **Step 3: Create src/components/app-header.tsx**

```tsx
"use client";

import { useTranslations } from "next-intl";
import { WifiOff } from "lucide-react";
import { useOnline } from "@/hooks/use-online";
import { Badge } from "@/components/ui/badge";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SignOutButton } from "@/components/sign-out-button";

export function AppHeader() {
  const t = useTranslations("common");
  const online = useOnline();

  return (
    <header className="sticky top-0 z-10 border-b bg-background">
      <div className="mx-auto flex max-w-md items-center justify-between gap-2 p-3">
        <h1 className="text-lg font-semibold">{t("appName")}</h1>
        <div className="flex items-center gap-2">
          {!online && (
            <Badge variant="secondary" className="gap-1">
              <WifiOff className="size-3" />
              {t("offline")}
            </Badge>
          )}
          <LocaleSwitcher />
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Create src/app/(app)/layout.tsx**

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { GarageProvider } from "@/components/garage-provider";
import { Toaster } from "@/components/ui/sonner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <GarageProvider>
      <AppHeader />
      <main className="mx-auto max-w-md p-4 pb-20">{children}</main>
      <BottomNav />
      <Toaster position="top-center" />
    </GarageProvider>
  );
}
```

- [ ] **Step 5: Temporary placeholder dashboard so the build passes**

If `src/app/page.tsx` exists from create-next-app, MOVE it: the dashboard belongs to the `(app)` group. Create `src/app/(app)/page.tsx`:

```tsx
export default function DashboardPage() {
  return null;
}
```

Delete the original `src/app/page.tsx` (the route group page replaces `/`).

- [ ] **Step 6: Verify**

```bash
npm run build
```

Expected: build succeeds; `/` resolves to the (app) group page.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: authenticated app shell with header, bottom nav, offline badge"
```

---

### Task 12: Garage UI (cars CRUD)

**Files:**
- Create: `src/components/cars/car-form-dialog.tsx`, `src/components/cars/car-list.tsx`
- Create: `src/app/(app)/cars/page.tsx`

- [ ] **Step 1: Create src/components/cars/car-form-dialog.tsx**

A single dialog for both add and edit (edit = rename only, mileage is updated from the dashboard):

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createCarAction, renameCarAction } from "@/actions/cars";
import { useGarageStore } from "@/stores/garage";
import type { Car } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CarFormDialog({
  car,
  trigger,
}: {
  car?: Car;
  trigger: React.ReactNode;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { upsertCar, setCarMileage } = useGarageStore();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name")).trim();
    setBusy(true);

    if (car) {
      // Optimistic rename with rollback
      const previous = car;
      upsertCar({ ...car, name });
      setOpen(false);
      const result = await renameCarAction({ carId: car.id, name });
      if (!result?.data) {
        upsertCar(previous);
        toast.error(t(result?.serverError ?? "errors.offline"));
      }
    } else {
      const mileage = Number(data.get("mileage"));
      const result = await createCarAction({ name, currentMileage: mileage });
      if (result?.data) {
        upsertCar(result.data);
        setOpen(false);
      } else {
        toast.error(t(result?.serverError ?? "errors.offline"));
      }
    }
    setBusy(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{car ? t("garage.editCar") : t("garage.addCar")}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="name">{t("garage.carName")}</Label>
            <Input id="name" name="name" defaultValue={car?.name} required maxLength={100} />
          </div>
          {!car && (
            <div className="space-y-2">
              <Label htmlFor="mileage">{t("garage.mileage")}</Label>
              <Input
                id="mileage"
                name="mileage"
                type="number"
                inputMode="numeric"
                min={0}
                required
              />
            </div>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {t("common.save")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

Note the asymmetry: creates are NOT optimistic (we need the server id before the car is usable), renames/deletes ARE optimistic with rollback. This is intentional.

- [ ] **Step 2: Create src/components/cars/car-list.tsx**

```tsx
"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { deleteCarAction } from "@/actions/cars";
import { useGarageStore } from "@/stores/garage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CarFormDialog } from "./car-form-dialog";

export function CarList() {
  const t = useTranslations();
  const cars = useGarageStore((s) => s.cars);
  const store = useGarageStore();

  async function handleDelete(carId: string) {
    if (!window.confirm(t("garage.deleteCarConfirm"))) return;
    const snapshot = {
      cars: store.cars,
      rules: store.rules,
      logs: store.logs,
      selectedCarId: store.selectedCarId,
    };
    store.removeCar(carId);
    const result = await deleteCarAction({ carId });
    if (!result?.data) {
      useGarageStore.setState(snapshot);
      toast.error(t(result?.serverError ?? "errors.offline"));
    }
  }

  return (
    <div className="space-y-3">
      {cars.map((car) => (
        <Card key={car.id}>
          <CardContent className="flex items-center justify-between p-4">
            <Link href={`/cars/${car.id}`} className="min-w-0 flex-1">
              <p className="truncate font-medium">{car.name}</p>
              <p className="text-sm text-muted-foreground">
                {car.currentMileage.toLocaleString()} km
              </p>
            </Link>
            <div className="flex gap-1">
              <CarFormDialog
                car={car}
                trigger={
                  <Button variant="ghost" size="icon" aria-label={t("common.edit")}>
                    <Pencil className="size-4" />
                  </Button>
                }
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("common.delete")}
                onClick={() => handleDelete(car.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      <CarFormDialog
        trigger={
          <Button className="w-full">
            <Plus className="size-4" /> {t("garage.addCar")}
          </Button>
        }
      />
    </div>
  );
}
```

- [ ] **Step 3: Create src/app/(app)/cars/page.tsx**

```tsx
import { getTranslations } from "next-intl/server";
import { CarList } from "@/components/cars/car-list";

export default async function GaragePage() {
  const t = await getTranslations("garage");
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">{t("title")}</h2>
      <CarList />
    </div>
  );
}
```

- [ ] **Step 4: Verify in browser**

```bash
npm run dev
```

Log in, go to `/cars`, add a car, rename it, delete it. Each should reflect instantly and persist on reload.

- [ ] **Step 5: Commit**

```bash
git add src/components/cars src/app/\(app\)/cars
git commit -m "feat: garage page with car CRUD and optimistic rename/delete"
```

---

### Task 13: Dashboard (status cards, mileage quick-update, log service)

**Files:**
- Create: `src/components/dashboard/status-card.tsx`, `src/components/dashboard/mileage-form.tsx`, `src/components/dashboard/car-select.tsx`, `src/components/dashboard/log-service-dialog.tsx`, `src/components/dashboard/dashboard.tsx`
- Modify: `src/app/(app)/page.tsx`
- Test: `src/components/dashboard/status-card.test.tsx`, `src/components/dashboard/mileage-form.test.tsx`

- [ ] **Step 1: Write failing test src/components/dashboard/status-card.test.tsx**

```tsx
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import { StatusCard } from "./status-card";

function renderCard(props: Parameters<typeof StatusCard>[0]) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <StatusCard {...props} />
    </NextIntlClientProvider>,
  );
}

describe("StatusCard", () => {
  it("shows remaining km and days for a green component", () => {
    renderCard({
      componentName: "Engine Oil",
      info: { status: "green", remainingKm: 8000, remainingDays: 120 },
      lastService: null,
      onLogService: () => {},
    });
    expect(screen.getByText("Engine Oil")).toBeInTheDocument();
    expect(screen.getByText(/8[,\s.]?000 km left/)).toBeInTheDocument();
    expect(screen.getByText(/120 days left/)).toBeInTheDocument();
  });

  it("shows never-serviced for red with no history", () => {
    renderCard({
      componentName: "Cabin Filter",
      info: { status: "red", remainingKm: null, remainingDays: null },
      lastService: null,
      onLogService: () => {},
    });
    expect(screen.getByText("Never serviced")).toBeInTheDocument();
  });

  it("shows overdue wording for negative remaining km", () => {
    renderCard({
      componentName: "Brakes",
      info: { status: "red", remainingKm: -500, remainingDays: null },
      lastService: null,
      onLogService: () => {},
    });
    expect(screen.getByText(/500 km overdue/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
npx vitest run src/components/dashboard
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement src/components/dashboard/status-card.tsx**

```tsx
"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { MaintenanceInfo } from "@/lib/maintenance";
import type { ServiceLog } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const STATUS_STYLES = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  red: "bg-red-500",
} as const;

export function StatusCard({
  componentName,
  info,
  lastService,
  onLogService,
}: {
  componentName: string;
  info: MaintenanceInfo;
  lastService: ServiceLog | null;
  onLogService: () => void;
}) {
  const t = useTranslations("dashboard");
  const format = useFormatter();

  const kmText =
    info.remainingKm === null
      ? null
      : info.remainingKm >= 0
        ? t("remainingKm", { km: format.number(info.remainingKm) })
        : t("overdueKm", { km: format.number(-info.remainingKm) });

  const daysText =
    info.remainingDays === null
      ? null
      : info.remainingDays >= 0
        ? t("remainingDays", { days: format.number(info.remainingDays) })
        : t("overdueDays", { days: format.number(-info.remainingDays) });

  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span
          aria-label={info.status}
          className={cn("size-3 shrink-0 rounded-full", STATUS_STYLES[info.status])}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{componentName}</p>
          <p className="text-sm text-muted-foreground">
            {kmText && daysText ? `${kmText} · ${daysText}` : (kmText ?? daysText ?? t("neverServiced"))}
          </p>
          {lastService && (
            <p className="text-xs text-muted-foreground">
              {t("lastService", {
                date: format.dateTime(new Date(lastService.dateAtService), {
                  dateStyle: "medium",
                }),
                km: format.number(lastService.mileageAtService),
              })}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={onLogService}>
          {t("logService")}
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run, verify status-card tests pass**

```bash
npx vitest run src/components/dashboard
```

Expected: PASS. If the number-format assertion fails on the thousands separator, loosen the test regex — the behavior under test is "remaining km is shown", not the separator.

- [ ] **Step 5: Write failing test src/components/dashboard/mileage-form.test.tsx**

MileageForm is presentational: it takes the current value and an `onSubmit(mileage)` callback (the dashboard container wires the optimistic update + action).

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import { MileageForm } from "./mileage-form";

function renderForm(onSubmit: (mileage: number) => void) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <MileageForm currentMileage={120000} onSubmit={onSubmit} />
    </NextIntlClientProvider>,
  );
}

describe("MileageForm", () => {
  it("submits the entered mileage", () => {
    const onSubmit = vi.fn();
    renderForm(onSubmit);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "121500" } });
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    expect(onSubmit).toHaveBeenCalledWith(121500);
  });

  it("does not submit an empty value", () => {
    const onSubmit = vi.fn();
    renderForm(onSubmit);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run, verify failure; then implement src/components/dashboard/mileage-form.tsx**

```bash
npx vitest run src/components/dashboard/mileage-form.test.tsx
```

```tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MileageForm({
  currentMileage,
  onSubmit,
}: {
  currentMileage: number;
  onSubmit: (mileage: number) => void;
}) {
  const t = useTranslations("dashboard");
  const [value, setValue] = useState(String(currentMileage));

  useEffect(() => {
    setValue(String(currentMileage));
  }, [currentMileage]);

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const mileage = Number(value);
        if (value === "" || !Number.isFinite(mileage) || mileage < 0) return;
        onSubmit(Math.floor(mileage));
      }}
    >
      <div className="flex-1 space-y-1">
        <Label htmlFor="mileage">{t("currentMileage")}</Label>
        <Input
          id="mileage"
          type="number"
          inputMode="numeric"
          min={0}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      <Button type="submit">{t("updateMileage")}</Button>
    </form>
  );
}
```

- [ ] **Step 7: Run, verify both dashboard component tests pass**

```bash
npx vitest run src/components/dashboard
```

Expected: PASS.

- [ ] **Step 8: Implement src/components/dashboard/car-select.tsx**

```tsx
"use client";

import { useGarageStore } from "@/stores/garage";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CarSelect() {
  const cars = useGarageStore((s) => s.cars);
  const selectedCarId = useGarageStore((s) => s.selectedCarId);
  const selectCar = useGarageStore((s) => s.selectCar);

  if (cars.length <= 1) return null;

  return (
    <Select value={selectedCarId ?? undefined} onValueChange={selectCar}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {cars.map((car) => (
          <SelectItem key={car.id} value={car.id}>
            {car.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 9: Implement src/components/dashboard/log-service-dialog.tsx**

```tsx
"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createLogAction } from "@/actions/logs";
import { useGarageStore } from "@/stores/garage";
import type { Car } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LogServiceDialog({
  car,
  componentName,
  open,
  onOpenChange,
}: {
  car: Car;
  componentName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("car");
  const tErr = useTranslations();
  const store = useGarageStore();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!componentName) return;
    const data = new FormData(e.currentTarget);
    const mileage = Number(data.get("mileage"));
    const date = String(data.get("date"));

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const previousMileage = car.currentMileage;

    // Optimistic: add log; raise car mileage if needed
    store.addLog({
      id: tempId,
      carId: car.id,
      componentName,
      mileageAtService: mileage,
      dateAtService: new Date(date).toISOString(),
    });
    if (mileage > previousMileage) store.setCarMileage(car.id, mileage);
    onOpenChange(false);

    const result = await createLogAction({
      carId: car.id,
      componentName,
      mileageAtService: mileage,
      dateAtService: new Date(date),
    });

    if (result?.data) {
      store.replaceLog(tempId, result.data.log);
      if (result.data.newCarMileage !== null)
        store.setCarMileage(car.id, result.data.newCarMileage);
    } else {
      store.removeLog(tempId);
      store.setCarMileage(car.id, previousMileage);
      toast.error(tErr(result?.serverError ?? "errors.offline"));
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("logService")}
            {componentName ? ` — ${componentName}` : ""}
          </DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="log-mileage">{t("serviceMileage")}</Label>
            <Input
              id="log-mileage"
              name="mileage"
              type="number"
              inputMode="numeric"
              min={0}
              defaultValue={car.currentMileage}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="log-date">{t("serviceDate")}</Label>
            <Input id="log-date" name="date" type="date" max={today} defaultValue={today} required />
          </div>
          <Button type="submit" className="w-full">
            {t("logService")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 10: Implement the container src/components/dashboard/dashboard.tsx**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { updateCarMileageAction } from "@/actions/cars";
import { computeMaintenance, latestLogFor } from "@/lib/maintenance";
import { useGarageStore } from "@/stores/garage";
import { Skeleton } from "@/components/ui/skeleton";
import { CarSelect } from "./car-select";
import { LogServiceDialog } from "./log-service-dialog";
import { MileageForm } from "./mileage-form";
import { StatusCard } from "./status-card";

export function Dashboard() {
  const t = useTranslations("dashboard");
  const tRoot = useTranslations();
  const store = useGarageStore();
  const { cars, rules, logs, selectedCarId, hasHydrated } = store;
  const [logComponent, setLogComponent] = useState<string | null>(null);

  if (!hasHydrated) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const car = cars.find((c) => c.id === selectedCarId) ?? null;

  if (!car) {
    return (
      <div className="space-y-2 py-12 text-center text-muted-foreground">
        <p className="font-medium">{t("noCar")}</p>
        <Link href="/cars" className="underline">
          {t("addFirstCar")}
        </Link>
      </div>
    );
  }

  const carRules = rules.filter((r) => r.carId === car.id);
  const now = new Date();

  async function handleMileage(mileage: number) {
    if (!car) return;
    const previous = car.currentMileage;
    store.setCarMileage(car.id, mileage);
    const result = await updateCarMileageAction({ carId: car.id, mileage });
    if (!result?.data) {
      store.setCarMileage(car.id, previous);
      toast.error(tRoot(result?.serverError ?? "errors.offline"));
    }
  }

  return (
    <div className="space-y-4">
      <CarSelect />
      <MileageForm currentMileage={car.currentMileage} onSubmit={handleMileage} />

      {carRules.length === 0 ? (
        <div className="space-y-2 py-8 text-center text-muted-foreground">
          <p>{t("noRules")}</p>
          <Link href={`/cars/${car.id}`} className="underline">
            {t("addRulesHint")}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {carRules.map((rule) => {
            const last = latestLogFor(logs, car.id, rule.componentName);
            const info = computeMaintenance(
              rule,
              last
                ? {
                    mileageAtService: last.mileageAtService,
                    dateAtService: new Date(last.dateAtService),
                  }
                : null,
              car.currentMileage,
              now,
            );
            return (
              <StatusCard
                key={rule.id}
                componentName={rule.componentName}
                info={info}
                lastService={last}
                onLogService={() => setLogComponent(rule.componentName)}
              />
            );
          })}
        </div>
      )}

      <LogServiceDialog
        car={car}
        componentName={logComponent}
        open={logComponent !== null}
        onOpenChange={(open) => !open && setLogComponent(null)}
      />
    </div>
  );
}
```

(Error keys like `errors.offline` live outside the `dashboard` namespace, hence the separate root translator `tRoot`.)

- [ ] **Step 11: Replace src/app/(app)/page.tsx**

```tsx
import { Dashboard } from "@/components/dashboard/dashboard";

export default function DashboardPage() {
  return <Dashboard />;
}
```

- [ ] **Step 12: Run all tests + browser check**

```bash
npm test && npm run dev
```

In the browser: dashboard shows car selector (with 2+ cars), mileage update reflects instantly, status cards appear once rules exist (rules UI comes next task — verify with the empty-state hint for now).

- [ ] **Step 13: Commit**

```bash
git add src/components/dashboard src/app/\(app\)/page.tsx
git commit -m "feat: dashboard with status cards, quick mileage update, service logging"
```

---

### Task 14: Car detail page (rules CRUD + service history)

**Files:**
- Create: `src/components/cars/rule-form-dialog.tsx`, `src/components/cars/rule-list.tsx`, `src/components/cars/service-history.tsx`, `src/app/(app)/cars/[carId]/page.tsx`

- [ ] **Step 1: Create src/components/cars/rule-form-dialog.tsx**

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createRuleAction, updateRuleAction } from "@/actions/rules";
import { useGarageStore } from "@/stores/garage";
import type { MaintenanceRule } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RuleFormDialog({
  carId,
  rule,
  trigger,
}: {
  carId: string;
  rule?: MaintenanceRule;
  trigger: React.ReactNode;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [intervalError, setIntervalError] = useState(false);
  const { upsertRule } = useGarageStore();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const componentName = String(data.get("componentName")).trim();
    const kmRaw = String(data.get("intervalKm"));
    const monthsRaw = String(data.get("intervalMonths"));
    const intervalKm = kmRaw === "" ? undefined : Number(kmRaw);
    const intervalMonths = monthsRaw === "" ? undefined : Number(monthsRaw);

    if (intervalKm === undefined && intervalMonths === undefined) {
      setIntervalError(true);
      return;
    }
    setIntervalError(false);
    setBusy(true);

    if (rule) {
      const previous = rule;
      const updated = { ...rule, componentName, intervalKm, intervalMonths };
      upsertRule(updated);
      setOpen(false);
      const result = await updateRuleAction({
        ruleId: rule.id,
        carId,
        componentName,
        intervalKm,
        intervalMonths,
      });
      if (!result?.data) {
        upsertRule(previous);
        toast.error(t(result?.serverError ?? "errors.offline"));
      }
    } else {
      const result = await createRuleAction({
        carId,
        componentName,
        intervalKm,
        intervalMonths,
      });
      if (result?.data) {
        upsertRule(result.data);
        setOpen(false);
      } else {
        toast.error(t(result?.serverError ?? "errors.offline"));
      }
    }
    setBusy(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{rule ? t("car.editRule") : t("car.addRule")}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="componentName">{t("car.componentName")}</Label>
            <Input
              id="componentName"
              name="componentName"
              defaultValue={rule?.componentName}
              required
              maxLength={100}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="intervalKm">{t("car.intervalKm")}</Label>
              <Input
                id="intervalKm"
                name="intervalKm"
                type="number"
                inputMode="numeric"
                min={1}
                defaultValue={rule?.intervalKm}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="intervalMonths">{t("car.intervalMonths")}</Label>
              <Input
                id="intervalMonths"
                name="intervalMonths"
                type="number"
                inputMode="numeric"
                min={1}
                defaultValue={rule?.intervalMonths}
              />
            </div>
          </div>
          <p className={intervalError ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
            {intervalError ? t("validation.intervalRequired") : t("car.intervalHint")}
          </p>
          <Button type="submit" className="w-full" disabled={busy}>
            {t("common.save")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Create src/components/cars/rule-list.tsx**

```tsx
"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { deleteRuleAction } from "@/actions/rules";
import { useGarageStore } from "@/stores/garage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RuleFormDialog } from "./rule-form-dialog";

export function RuleList({ carId }: { carId: string }) {
  const t = useTranslations();
  const rules = useGarageStore((s) => s.rules).filter((r) => r.carId === carId);
  const store = useGarageStore();

  async function handleDelete(ruleId: string) {
    if (!window.confirm(t("car.deleteRuleConfirm"))) return;
    const previous = store.rules;
    store.removeRule(ruleId);
    const result = await deleteRuleAction({ ruleId, carId });
    if (!result?.data) {
      useGarageStore.setState({ rules: previous });
      toast.error(t(result?.serverError ?? "errors.offline"));
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold">{t("car.rules")}</h3>
      {rules.map((rule) => (
        <Card key={rule.id}>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{rule.componentName}</p>
              <p className="text-sm text-muted-foreground">
                {[
                  rule.intervalKm !== undefined && `${rule.intervalKm.toLocaleString()} km`,
                  rule.intervalMonths !== undefined && `${rule.intervalMonths} mo`,
                ]
                  .filter(Boolean)
                  .join(" / ")}
              </p>
            </div>
            <div className="flex gap-1">
              <RuleFormDialog
                carId={carId}
                rule={rule}
                trigger={
                  <Button variant="ghost" size="icon" aria-label={t("common.edit")}>
                    <Pencil className="size-4" />
                  </Button>
                }
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("common.delete")}
                onClick={() => handleDelete(rule.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      <RuleFormDialog
        carId={carId}
        trigger={
          <Button variant="outline" className="w-full">
            <Plus className="size-4" /> {t("car.addRule")}
          </Button>
        }
      />
    </div>
  );
}
```

- [ ] **Step 3: Create src/components/cars/service-history.tsx**

```tsx
"use client";

import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { deleteLogAction } from "@/actions/logs";
import { useGarageStore } from "@/stores/garage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ServiceHistory({ carId }: { carId: string }) {
  const t = useTranslations();
  const format = useFormatter();
  const logs = useGarageStore((s) => s.logs)
    .filter((l) => l.carId === carId)
    .sort((a, b) => b.dateAtService.localeCompare(a.dateAtService));
  const store = useGarageStore();

  async function handleDelete(logId: string) {
    if (!window.confirm(t("car.deleteLogConfirm"))) return;
    const previous = store.logs;
    store.removeLog(logId);
    const result = await deleteLogAction({ logId, carId });
    if (!result?.data) {
      useGarageStore.setState({ logs: previous });
      toast.error(t(result?.serverError ?? "errors.offline"));
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold">{t("car.history")}</h3>
      {logs.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("car.noLogs")}</p>
      )}
      {logs.map((log) => (
        <Card key={log.id}>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{log.componentName}</p>
              <p className="text-sm text-muted-foreground">
                {format.dateTime(new Date(log.dateAtService), { dateStyle: "medium" })}
                {" · "}
                {log.mileageAtService.toLocaleString()} km
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("common.delete")}
              onClick={() => handleDelete(log.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create src/app/(app)/cars/[carId]/page.tsx**

```tsx
import { CarDetail } from "@/components/cars/car-detail";

export default async function CarPage({
  params,
}: {
  params: Promise<{ carId: string }>;
}) {
  const { carId } = await params;
  return <CarDetail carId={carId} />;
}
```

And create `src/components/cars/car-detail.tsx` (client wrapper that shows the car name and composes the two lists):

```tsx
"use client";

import { useGarageStore } from "@/stores/garage";
import { RuleList } from "./rule-list";
import { ServiceHistory } from "./service-history";

export function CarDetail({ carId }: { carId: string }) {
  const car = useGarageStore((s) => s.cars).find((c) => c.id === carId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{car?.name ?? ""}</h2>
        {car && (
          <p className="text-sm text-muted-foreground">
            {car.currentMileage.toLocaleString()} km
          </p>
        )}
      </div>
      <RuleList carId={carId} />
      <ServiceHistory carId={carId} />
    </div>
  );
}
```

(Note: `params` is a Promise in Next 16 — it must be awaited. The page stays a server component; data comes from the client store.)

- [ ] **Step 5: Full manual flow check**

```bash
npm run dev
```

Flow: add car → open it → add rule "Engine Oil" 10000 km / 12 months → dashboard shows RED "Never serviced" → log service at current mileage → status turns GREEN → set mileage +9500 km → YELLOW → +10000 → RED.

- [ ] **Step 6: Run all tests + build**

```bash
npm test && npm run build
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/cars src/app/\(app\)/cars
git commit -m "feat: car detail with rules CRUD and service history"
```

---

### Task 15: PWA (Serwist with Turbopack, manifest, icons, offline fallback)

**Files:**
- Create: `serwist.config.js` (or as the docs specify), `src/app/sw.ts`, `src/app/manifest.ts`, `src/app/~offline/page.tsx`, `public/icons/icon.svg` + generated PNGs, `src/app/apple-icon.png`
- Modify: `src/app/layout.tsx` (SerwistProvider + PWA metadata), `package.json` (build script), `.gitignore` (generated sw)

- [ ] **Step 1: Confirm the current Serwist+Turbopack build wiring (authoritative)**

Serwist's Turbopack integration is new and its exact build command may have changed since this plan was written. Fetch and read BOTH pages before wiring:

```
WebFetch https://serwist.pages.dev/docs/next/turbo
WebFetch https://serwist.pages.dev/docs/next/config
```

Follow what the docs say for: required packages, the config file name/shape, the exact build command that compiles `src/app/sw.ts` → `public/sw.js`, and dev-mode behavior. The steps below reflect the docs as of 2026-06-10 — adjust them to the fetched docs if they differ, and note any deviation in the commit message.

- [ ] **Step 2: Create serwist.config.js**

```js
// @ts-check
import { serwist } from "@serwist/next/config";

// The /~offline fallback page must be precached for the SW fallback to work.
const revision = crypto.randomUUID();

export default serwist({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
});
```

- [ ] **Step 3: Create src/app/sw.ts**

```ts
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
```

- [ ] **Step 4: Create src/app/~offline/page.tsx**

```tsx
import { getTranslations } from "next-intl/server";

export default async function OfflinePage() {
  const t = await getTranslations("offlinePage");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("description")}</p>
    </main>
  );
}
```

- [ ] **Step 5: Create the app icon and generate PNGs**

Create `public/icons/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0f766e"/>
  <g fill="#ffffff">
    <path d="M120 296c0-18 8-50 22-78 8-16 20-26 38-26h152c18 0 30 10 38 26 14 28 22 60 22 78v60a12 12 0 0 1-12 12h-20a12 12 0 0 1-12-12v-16H164v16a12 12 0 0 1-12 12h-20a12 12 0 0 1-12-12z"/>
    <circle cx="180" cy="300" r="22" fill="#0f766e"/>
    <circle cx="332" cy="300" r="22" fill="#0f766e"/>
    <rect x="150" y="210" width="212" height="14" rx="7" fill="#0f766e"/>
  </g>
</svg>
```

Generate the PNG sizes (sharp-cli rasterizes SVG; check `npx sharp-cli --help` if the flag syntax differs):

```bash
npx -y sharp-cli -i public/icons/icon.svg -o public/icons/icon-192.png resize 192 192
npx -y sharp-cli -i public/icons/icon.svg -o public/icons/icon-512.png resize 512 512
npx -y sharp-cli -i public/icons/icon.svg -o src/app/apple-icon.png resize 180 180
```

Verify: `ls -la public/icons/ src/app/apple-icon.png` — three PNGs exist and are non-zero size. (`src/app/apple-icon.png` is a Next.js file convention — it automatically emits the `apple-touch-icon` link tag for iOS Add to Home Screen.)

- [ ] **Step 6: Create src/app/manifest.ts**

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Car Service Tracker",
    short_name: "CarTracker",
    description: "Track vehicle consumables and maintenance schedules",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f766e",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
```

- [ ] **Step 7: Add SerwistProvider and PWA metadata to src/app/layout.tsx**

Update the root layout (keeping the Task 3 i18n wiring):

```tsx
import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { SerwistProvider } from "@serwist/next/react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Car Service Tracker",
  description: "Track vehicle consumables and maintenance schedules",
  applicationName: "Car Service Tracker",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Car Service Tracker",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className="antialiased">
        <SerwistProvider
          swUrl="/sw.js"
          disable={process.env.NODE_ENV === "development"}
        >
          <NextIntlClientProvider>{children}</NextIntlClientProvider>
        </SerwistProvider>
      </body>
    </html>
  );
}
```

(If `SerwistProvider`'s prop names differ in the installed version — e.g. `disable` vs another flag — follow the fetched docs from Step 1.)

- [ ] **Step 8: Wire the build script and gitignore**

Per the Step-1 docs, the configurator mode adds an external SW build step after `next build`. Expected shape in `package.json` (adjust command name to the docs):

```json
"build": "next build && serwist build"
```

Add to `.gitignore`:

```
public/sw.js
public/sw.js.map
```

- [ ] **Step 9: Verify the production PWA**

```bash
npm run build && npm run start
```

Checks:
1. `curl -s http://localhost:3000/sw.js | head -c 200` — service worker is served.
2. `curl -s http://localhost:3000/manifest.webmanifest` — manifest JSON with icons.
3. In a browser: open the app, log in, load the dashboard, then DevTools → Network → Offline → reload: the dashboard shell loads and shows persisted data; navigating to an uncached route shows the `/~offline` fallback.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: PWA with serwist (turbopack), manifest, icons, offline fallback"
```

---

### Task 16: Error pages & final verification

**Files:**
- Create: `src/app/error.tsx`, `src/app/not-found.tsx`
- Modify: `README.md`

- [ ] **Step 1: Create src/app/error.tsx**

```tsx
"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("errorPage");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <Button onClick={reset}>{t("retry")}</Button>
    </main>
  );
}
```

- [ ] **Step 2: Create src/app/not-found.tsx**

```tsx
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("notFoundPage");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <Link href="/" className="underline">
        {t("goHome")}
      </Link>
    </main>
  );
}
```

- [ ] **Step 3: Replace README.md content**

```markdown
# Car Service Tracker

Mobile-first PWA for tracking vehicle consumables and maintenance schedules.
Offline read access, MongoDB Atlas sync, multi-user, multi-vehicle, EN/UK.

## Setup

1. Copy `.env.local.example` to `.env.local` and fill in:
   - `MONGODB_URI` — MongoDB Atlas connection string
   - `MONGODB_DB` — database name (default `car_service_tracker`)
   - `AUTH_SECRET` — `openssl rand -base64 32`
2. `npm install`
3. `npm run dev`

## Scripts

- `npm run dev` — dev server (service worker disabled in dev)
- `npm run build && npm start` — production build (required to test PWA/offline)
- `npm test` — unit & component tests (Vitest)

## Docs

- Spec: `docs/superpowers/specs/2026-06-10-car-maintenance-tracker-design.md`
- Plan: `docs/superpowers/plans/2026-06-10-car-maintenance-tracker.md`
```

- [ ] **Step 4: Full verification suite**

```bash
npm test && npm run lint && npm run build
```

Expected: all green. Fix anything that fails before committing.

- [ ] **Step 5: Manual acceptance pass (report results to the user)**

Against `npm run build && npm start`:
1. Register → auto-login → empty dashboard with "add first car" hint.
2. Add car, add 2 rules (one km-only, one km+months), log services, verify color transitions.
3. Switch language to Ukrainian — all visible strings change.
4. Offline reload — dashboard renders from persisted store with offline badge; mileage update while offline shows the rollback toast.
5. Sign out → redirected to `/login`; protected routes redirect when logged out.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: error pages, readme, final polish"
```

---

## Post-plan notes for the executor

- **Library version drift:** next-safe-action v8 (`.inputSchema()`), zod v4 (`z.email()`), next-auth v5 beta, zustand v5, Serwist current. If a compile error suggests an API mismatch, check the installed version's docs/types before "fixing" application logic.
- **Next.js 16:** bundled docs at `node_modules/next/dist/docs/` are authoritative. `proxy.ts` not `middleware.ts`; `params` are Promises; Turbopack default.
- **The user must supply `MONGODB_URI` in `.env.local` before Task 8's verification step.** Stop and ask if it's missing.
- **Never weaken auth:** every new action must use `authActionClient` and verify car ownership for rule/log operations.
