# Loading Indicators & Garage Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pre-hydration splash, per-page skeleton loading, button spinners on all forms, and redesign the Garage car cards with richer data and a subtle danger zone.

**Architecture:** A new `isServerSyncing` flag in the Zustand store (always starts `true`, cleared by `GarageProvider` after the first server action resolves or fails) gates skeleton loading on all three main pages. A `SplashRemover` client component fades out a server-rendered HTML overlay once React mounts, covering the pre-hydration gap. The `Button` component gains a `loading` prop that renders a `Loader2` spinner.

**Tech Stack:** Next.js 16 (App Router), React, Zustand (persist middleware), Tailwind CSS, Lucide React, next-intl, Vitest + Testing Library

---

## File Map

| Action | Path | Purpose |
|---|---|---|
| Create | `src/components/splash-remover.tsx` | Client component that fades out `#app-splash` on first mount |
| Create | `src/components/ui/button.test.tsx` | Tests for loading prop |
| Modify | `src/stores/garage.ts` | Add `isServerSyncing` flag + `setIsServerSyncing` |
| Modify | `src/components/garage-provider.tsx` | Clear `isServerSyncing` after fetch resolves/fails |
| Modify | `src/app/layout.tsx` | Add splash overlay div + `<SplashRemover />` |
| Modify | `src/components/ui/button.tsx` | Add `loading?: boolean` prop |
| Modify | `src/messages/en.json` | Add garage card i18n keys |
| Modify | `src/messages/uk.json` | Add garage card i18n keys |
| Modify | `src/components/dashboard/dashboard.tsx` | Switch `!hasHydrated` → `isServerSyncing` |
| Modify | `src/components/cars/car-list.tsx` | Skeleton + richer car card |
| Modify | `src/components/cars/car-detail.tsx` | Skeleton gating ServiceHistory + RuleList |
| Modify | `src/components/cars/log-visit-dialog.tsx` | `loading={busy}` on submit |
| Modify | `src/components/cars/edit-visit-dialog.tsx` | `loading={busy}` on submit |
| Modify | `src/components/cars/car-form-dialog.tsx` | `loading={busy}` on submit |
| Modify | `src/components/cars/rule-form-dialog.tsx` | `loading={busy}` on submit |
| Modify | `src/components/cars/standard-rules-dialog.tsx` | `loading={busy}` on submit |
| Modify | `src/components/dashboard/mileage-form.tsx` | `loading={busy}` on submit |
| Modify | `src/components/account/delete-account-dialog.tsx` | Remove section wrapper, ghost trigger |
| Modify | `src/app/(app)/cars/page.tsx` | Wrap danger zone in centered bottom div |
| Modify | `src/stores/garage.test.ts` | Add `isServerSyncing` behaviour test |
| Modify | `src/components/dashboard/dashboard.test.tsx` | Add `isServerSyncing: false` to `beforeEach` |
| Modify | `src/components/cars/car-list.test.tsx` | Add `isServerSyncing: false`; skeleton + card tests |
| Modify | `src/components/cars/car-detail.test.tsx` | Add `isServerSyncing: false`; skeleton test |

---

### Task 1: Store — isServerSyncing flag

**Files:**
- Modify: `src/stores/garage.ts`
- Modify: `src/stores/garage.test.ts`

- [ ] **Step 1.1: Write failing test**

  Add to the `describe("garage store", ...)` block in `src/stores/garage.test.ts`:

  ```ts
  it("isServerSyncing starts true and setIsServerSyncing clears it", () => {
    useGarageStore.setState(useGarageStore.getInitialState());
    expect(useGarageStore.getState().isServerSyncing).toBe(true);
    useGarageStore.getState().setIsServerSyncing(false);
    expect(useGarageStore.getState().isServerSyncing).toBe(false);
  });
  ```

- [ ] **Step 1.2: Run test to verify it fails**

  ```bash
  npx vitest run src/stores/garage.test.ts
  ```
  Expected: FAIL — `isServerSyncing` does not exist on state.

- [ ] **Step 1.3: Add `isServerSyncing` to the store**

  In `src/stores/garage.ts`, update the `GarageState` interface — add after `hasHydrated`:

  ```ts
  isServerSyncing: boolean;
  setIsServerSyncing: (v: boolean) => void;
  ```

  In the `create()(persist(... (set) => ({` initial values, add after `hasHydrated: false`:

  ```ts
  isServerSyncing: true,
  ```

  In the actions section, add after `setHasHydrated`:

  ```ts
  setIsServerSyncing: (v) => set({ isServerSyncing: v }),
  ```

  The `partialize` function already excludes it (only `cars`, `rules`, `logs`, `visits`, `selectedCarId`, `syncedAt` are listed), so `isServerSyncing` is never persisted.

- [ ] **Step 1.4: Run test to verify it passes**

  ```bash
  npx vitest run src/stores/garage.test.ts
  ```
  Expected: all PASS.

- [ ] **Step 1.5: Commit**

  ```bash
  git add src/stores/garage.ts src/stores/garage.test.ts
  git commit -m "feat(store): add isServerSyncing flag for skeleton loading"
  ```

---

### Task 2: GarageProvider — clear flag when data arrives

**Files:**
- Modify: `src/components/garage-provider.tsx`

- [ ] **Step 2.1: Update the fetch handler**

  Replace the full content of `src/components/garage-provider.tsx`:

  ```tsx
  "use client";

  import { useEffect } from "react";
  import { getGarageDataAction } from "@/actions/garage";
  import { useGarageStore } from "@/stores/garage";

  export function GarageProvider({ children }: { children: React.ReactNode }) {
    const setAll = useGarageStore((s) => s.setAll);
    const setIsServerSyncing = useGarageStore((s) => s.setIsServerSyncing);

    useEffect(() => {
      let cancelled = false;
      getGarageDataAction()
        .then((result) => {
          if (!cancelled && result?.data) setAll(result.data);
        })
        .catch(() => {
          // offline — keep the persisted cached data
        })
        .finally(() => {
          if (!cancelled) setIsServerSyncing(false);
        });
      const onOnline = () => {
        getGarageDataAction()
          .then((result) => {
            if (!cancelled && result?.data) setAll(result.data);
          })
          .catch(() => {});
        // No isServerSyncing change on reconnect — that's a silent background refresh.
      };
      window.addEventListener("online", onOnline);
      return () => {
        cancelled = true;
        window.removeEventListener("online", onOnline);
      };
    }, [setAll, setIsServerSyncing]);

    return <>{children}</>;
  }
  ```

- [ ] **Step 2.2: Run the full test suite**

  ```bash
  npx vitest run
  ```
  Expected: all existing tests still PASS (GarageProvider has no unit test — coverage comes from integration).

- [ ] **Step 2.3: Commit**

  ```bash
  git add src/components/garage-provider.tsx
  git commit -m "feat(provider): clear isServerSyncing after first data fetch"
  ```

---

### Task 3: Splash screen

**Files:**
- Create: `src/components/splash-remover.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 3.1: Create `SplashRemover`**

  Create `src/components/splash-remover.tsx`:

  ```tsx
  "use client";

  import { useEffect } from "react";

  export function SplashRemover() {
    useEffect(() => {
      const el = document.getElementById("app-splash");
      if (!el) return;
      el.style.opacity = "0";
      const remove = () => el.remove();
      el.addEventListener("transitionend", remove, { once: true });
      return () => el.removeEventListener("transitionend", remove);
    }, []);
    return null;
  }
  ```

  React renders the page behind the splash (z-index 9999). On the first `useEffect` tick — after hydration — the splash fades out via CSS `transition` and is removed from the DOM.

- [ ] **Step 3.2: Add the splash overlay and import to `layout.tsx`**

  Replace the full content of `src/app/layout.tsx`:

  ```tsx
  import type { Metadata, Viewport } from "next";
  import { Geist, Geist_Mono } from "next/font/google";
  import { NextIntlClientProvider } from "next-intl";
  import { getLocale } from "next-intl/server";
  import { SerwistProvider } from "@serwist/next/react";
  import { SplashRemover } from "@/components/splash-remover";
  import "./globals.css";

  const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
  });

  const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
  });

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
  }: Readonly<{
    children: React.ReactNode;
  }>) {
    const locale = await getLocale();
    return (
      <html
        lang={locale}
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col" suppressHydrationWarning>
          <div
            id="app-splash"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              background: "var(--background, oklch(0.98 0.004 85))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "opacity 0.3s",
            }}
          >
            <img src="/icons/icon-192.png" width="96" height="96" alt="" />
          </div>
          <SplashRemover />
          <SerwistProvider
            swUrl="/sw.js"
            disable={process.env.NODE_ENV === "development"}
            reloadOnOnline={false}
          >
            <NextIntlClientProvider>{children}</NextIntlClientProvider>
          </SerwistProvider>
        </body>
      </html>
    );
  }
  ```

- [ ] **Step 3.3: Build check**

  ```bash
  npx tsc --noEmit && npx eslint src
  ```
  Expected: no errors.

- [ ] **Step 3.4: Commit**

  ```bash
  git add src/components/splash-remover.tsx src/app/layout.tsx
  git commit -m "feat: pre-hydration splash screen with fade-out on mount"
  ```

---

### Task 4: Button — loading prop

**Files:**
- Modify: `src/components/ui/button.tsx`
- Create: `src/components/ui/button.test.tsx`

- [ ] **Step 4.1: Write failing tests**

  Create `src/components/ui/button.test.tsx`:

  ```tsx
  import { cleanup, render, screen } from "@testing-library/react";
  import { afterEach, expect, it } from "vitest";
  import { Button } from "./button";

  afterEach(cleanup);

  it("is disabled and renders a spinner svg when loading", () => {
    render(<Button loading>Save</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn.querySelector("svg")).toBeTruthy();
  });

  it("is not disabled and renders no extra svg when not loading", () => {
    render(<Button>Save</Button>);
    const btn = screen.getByRole("button");
    expect(btn).not.toBeDisabled();
    expect(btn.querySelector("svg")).toBeFalsy();
  });

  it("stays disabled when both disabled and loading are true", () => {
    render(<Button loading disabled>Save</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
  ```

- [ ] **Step 4.2: Run tests to verify they fail**

  ```bash
  npx vitest run src/components/ui/button.test.tsx
  ```
  Expected: FAIL — `loading` prop does not exist.

- [ ] **Step 4.3: Add the loading prop to Button**

  Replace the full content of `src/components/ui/button.tsx`:

  ```tsx
  import { Button as ButtonPrimitive } from "@base-ui/react/button";
  import { cva, type VariantProps } from "class-variance-authority";
  import { Loader2 } from "lucide-react";
  import { cn } from "@/lib/utils";

  const buttonVariants = cva(
    "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    {
      variants: {
        variant: {
          default: "bg-primary text-primary-foreground hover:bg-primary/80",
          outline:
            "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
          secondary:
            "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
          ghost:
            "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
          destructive:
            "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
          link: "text-primary underline-offset-4 hover:underline",
        },
        size: {
          default:
            "h-9 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
          xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
          sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
          lg: "h-10 gap-2 px-4 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
          icon: "size-9",
          "icon-xs":
            "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
          "icon-sm":
            "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
          "icon-lg": "size-10",
        },
      },
      defaultVariants: {
        variant: "default",
        size: "default",
      },
    }
  );

  function Button({
    className,
    variant = "default",
    size = "default",
    loading,
    disabled,
    children,
    ...props
  }: ButtonPrimitive.Props &
    VariantProps<typeof buttonVariants> & { loading?: boolean }) {
    return (
      <ButtonPrimitive
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={loading || disabled}
        {...props}
      >
        {loading && <Loader2 className="animate-spin" />}
        {children}
      </ButtonPrimitive>
    );
  }

  export { Button, buttonVariants };
  ```

- [ ] **Step 4.4: Run tests to verify they pass**

  ```bash
  npx vitest run src/components/ui/button.test.tsx
  ```
  Expected: all PASS.

- [ ] **Step 4.5: Commit**

  ```bash
  git add src/components/ui/button.tsx src/components/ui/button.test.tsx
  git commit -m "feat(button): add loading prop with spinner"
  ```

---

### Task 5: i18n — garage card keys

**Files:**
- Modify: `src/messages/en.json`
- Modify: `src/messages/uk.json`

- [ ] **Step 5.1: Add keys to `en.json`**

  In `src/messages/en.json`, inside the `"garage"` object, add after `"noCarsHint"`:

  ```json
  "rulesCount": "{count, plural, one {# rule} other {# rules}}",
  "lastService": "Last: {date}",
  "neverServiced": "Never serviced",
  "overdueCount": "{count, plural, one {# overdue} other {# overdue}}",
  "dueCount": "{count, plural, one {# due soon} other {# due soon}}"
  ```

- [ ] **Step 5.2: Add keys to `uk.json`**

  In `src/messages/uk.json`, inside the `"garage"` object, add after `"noCarsHint"`:

  ```json
  "rulesCount": "{count, plural, one {# правило} few {# правила} many {# правил} other {# правила}}",
  "lastService": "Останнє: {date}",
  "neverServiced": "Ніколи не обслуговувалось",
  "overdueCount": "{count, plural, one {# прострочено} few {# прострочено} many {# прострочено} other {# прострочено}}",
  "dueCount": "{count, plural, one {# скоро} few {# скоро} many {# скоро} other {# скоро}}"
  ```

- [ ] **Step 5.3: Type-check**

  ```bash
  npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 5.4: Commit**

  ```bash
  git add src/messages/en.json src/messages/uk.json
  git commit -m "feat(i18n): add garage card stats keys"
  ```

---

### Task 6: Dashboard — switch skeleton to isServerSyncing

**Files:**
- Modify: `src/components/dashboard/dashboard.tsx`
- Modify: `src/components/dashboard/dashboard.test.tsx`

- [ ] **Step 6.1: Update `dashboard.test.tsx` beforeEach**

  In `src/components/dashboard/dashboard.test.tsx`, in the `beforeEach` block, add `isServerSyncing: false` alongside `hasHydrated: true`:

  ```ts
  beforeEach(() => {
    useGarageStore.setState({
      cars: [car],
      rules,
      logs: [oilLog],
      visits: [],
      selectedCarId: carId,
      hasHydrated: true,
      isServerSyncing: false,
    });
  });
  ```

- [ ] **Step 6.2: Run dashboard tests to see they still pass**

  ```bash
  npx vitest run src/components/dashboard/dashboard.test.tsx
  ```
  Expected: all PASS (Dashboard still reads `hasHydrated` at this point — confirming the test change itself doesn't break anything).

- [ ] **Step 6.3: Update `dashboard.tsx`**

  In `src/components/dashboard/dashboard.tsx`, replace the destructure line and the skeleton guard:

  ```tsx
  // Change this:
  const { cars, rules, logs, selectedCarId, hasHydrated } = store;

  if (!hasHydrated) {
  // To this:
  const { cars, rules, logs, selectedCarId, isServerSyncing } = store;

  if (isServerSyncing) {
  ```

- [ ] **Step 6.4: Run dashboard tests again**

  ```bash
  npx vitest run src/components/dashboard/dashboard.test.tsx
  ```
  Expected: all PASS.

- [ ] **Step 6.5: Commit**

  ```bash
  git add src/components/dashboard/dashboard.tsx src/components/dashboard/dashboard.test.tsx
  git commit -m "feat(dashboard): gate skeleton on isServerSyncing instead of hasHydrated"
  ```

---

### Task 7: CarList — skeleton + card redesign

**Files:**
- Modify: `src/components/cars/car-list.tsx`
- Modify: `src/components/cars/car-list.test.tsx`

- [ ] **Step 7.1: Update `car-list.test.tsx`**

  Replace the full content of `src/components/cars/car-list.test.tsx`:

  ```tsx
  import { cleanup, render, screen } from "@testing-library/react";
  import { NextIntlClientProvider } from "next-intl";
  import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
  import en from "@/messages/en.json";
  import { useGarageStore } from "@/stores/garage";
  import { CarList } from "./car-list";

  vi.mock("@/actions/cars", () => ({
    createCarAction: vi.fn(),
    renameCarAction: vi.fn(),
    deleteCarAction: vi.fn(),
  }));

  function renderList() {
    return render(
      <NextIntlClientProvider locale="en" messages={en}>
        <CarList />
      </NextIntlClientProvider>,
    );
  }

  afterEach(cleanup);

  beforeEach(() => {
    useGarageStore.setState({
      ...useGarageStore.getInitialState(),
      isServerSyncing: false,
    });
  });

  describe("CarList", () => {
    it("shows skeleton while isServerSyncing", () => {
      useGarageStore.setState({ isServerSyncing: true });
      renderList();
      expect(document.querySelector("[data-slot='skeleton']")).toBeInTheDocument();
      expect(screen.queryByText(en.garage.noCars)).not.toBeInTheDocument();
    });

    it("shows the empty state when there are no cars", () => {
      renderList();
      expect(screen.getByText(en.garage.noCars)).toBeInTheDocument();
      expect(screen.getByText(en.garage.noCarsHint)).toBeInTheDocument();
    });

    it("lists cars and hides the empty state when cars exist", () => {
      useGarageStore.setState({
        cars: [{ id: "car-1", name: "My Honda", currentMileage: 42000, updatedAt: "2026-06-01T00:00:00.000Z" }],
      });
      renderList();
      expect(screen.getByText("My Honda")).toBeInTheDocument();
      expect(screen.queryByText(en.garage.noCars)).not.toBeInTheDocument();
    });

    it("shows rules count and last service date on a car card", () => {
      const carId = "car-1";
      useGarageStore.setState({
        cars: [{ id: carId, name: "My Honda", currentMileage: 42000, updatedAt: "2026-06-01T00:00:00.000Z" }],
        rules: [{ id: "r1", carId, componentName: "Oil", intervalKm: 10000 }],
        logs: [{
          id: "l1",
          carId,
          componentName: "Oil",
          mileageAtService: 38000,
          dateAtService: "2025-06-01T00:00:00.000Z",
        }],
      });
      renderList();
      expect(screen.getByText(/1 rule/)).toBeInTheDocument();
      expect(screen.getByText(/Last:/)).toBeInTheDocument();
    });

    it("shows 'Never serviced' when a car has no logs", () => {
      useGarageStore.setState({
        cars: [{ id: "car-1", name: "My Honda", currentMileage: 42000, updatedAt: "2026-06-01T00:00:00.000Z" }],
        rules: [],
        logs: [],
      });
      renderList();
      expect(screen.getByText(en.garage.neverServiced)).toBeInTheDocument();
    });
  });
  ```

- [ ] **Step 7.2: Run tests to see new ones fail**

  ```bash
  npx vitest run src/components/cars/car-list.test.tsx
  ```
  Expected: skeleton test and card data tests FAIL; existing tests PASS.

- [ ] **Step 7.3: Replace `car-list.tsx` with skeleton + redesigned card**

  Replace the full content of `src/components/cars/car-list.tsx`:

  ```tsx
  "use client";

  import Link from "next/link";
  import { useFormatter, useTranslations } from "next-intl";
  import { toast } from "sonner";
  import { CarFront, Pencil, Plus, Trash2 } from "lucide-react";
  import { deleteCarAction } from "@/actions/cars";
  import { actionErrorKey } from "@/lib/action-feedback";
  import { computeMaintenance, latestLogFor } from "@/lib/maintenance";
  import { useGarageStore } from "@/stores/garage";
  import { Badge } from "@/components/ui/badge";
  import { Button } from "@/components/ui/button";
  import { Card, CardContent } from "@/components/ui/card";
  import { Skeleton } from "@/components/ui/skeleton";
  import { CarFormDialog } from "./car-form-dialog";

  export function CarList() {
    const t = useTranslations();
    const format = useFormatter();
    const cars = useGarageStore((s) => s.cars);
    const rules = useGarageStore((s) => s.rules);
    const logs = useGarageStore((s) => s.logs);
    const isServerSyncing = useGarageStore((s) => s.isServerSyncing);
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
      const errorKey = actionErrorKey(result);
      if (errorKey) {
        useGarageStore.setState(snapshot);
        toast.error(t(errorKey));
      }
    }

    if (isServerSyncing) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      );
    }

    const now = new Date();

    return (
      <div className="space-y-3">
        {cars.length === 0 && (
          <div className="flex flex-col items-center gap-1 py-10 text-center">
            <CarFront className="mb-2 size-10 text-muted-foreground/40" aria-hidden="true" />
            <p className="font-medium">{t("garage.noCars")}</p>
            <p className="text-sm text-muted-foreground">{t("garage.noCarsHint")}</p>
          </div>
        )}
        {cars.map((car) => {
          const carRules = rules.filter((r) => r.carId === car.id);
          const ruleCount = carRules.length;
          const carLogs = logs.filter((l) => l.carId === car.id);
          const lastServiceDate =
            carLogs.length > 0
              ? carLogs.reduce(
                  (max, l) => (l.dateAtService > max ? l.dateAtService : max),
                  carLogs[0].dateAtService,
                )
              : null;

          let redCount = 0;
          let yellowCount = 0;
          for (const rule of carRules) {
            const last = latestLogFor(logs, car.id, rule.componentName);
            if (!last) continue;
            const info = computeMaintenance(
              rule,
              {
                mileageAtService: last.mileageAtService,
                dateAtService: new Date(last.dateAtService),
              },
              car.currentMileage,
              now,
            );
            if (info.status === "red") redCount++;
            else if (info.status === "yellow") yellowCount++;
          }

          const badge =
            redCount > 0 ? (
              <Badge variant="destructive" className="text-xs font-normal">
                {t("garage.overdueCount", { count: redCount })}
              </Badge>
            ) : yellowCount > 0 ? (
              <Badge className="bg-amber-100 text-xs font-normal text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                {t("garage.dueCount", { count: yellowCount })}
              </Badge>
            ) : null;

          return (
            <Card key={car.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/cars/${car.id}`} className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold">{car.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {car.currentMileage.toLocaleString()} km
                    </p>
                  </Link>
                  <div className="flex shrink-0 gap-1">
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
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span>{t("garage.rulesCount", { count: ruleCount })}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {lastServiceDate
                      ? t("garage.lastService", {
                          date: format.dateTime(new Date(lastServiceDate), {
                            dateStyle: "medium",
                          }),
                        })
                      : t("garage.neverServiced")}
                  </span>
                  {badge}
                </div>
              </CardContent>
            </Card>
          );
        })}
        <CarFormDialog
          trigger={
            <Button size="lg" className="w-full">
              <Plus className="size-4" /> {t("garage.addCar")}
            </Button>
          }
        />
      </div>
    );
  }
  ```

- [ ] **Step 7.4: Run tests to verify they all pass**

  ```bash
  npx vitest run src/components/cars/car-list.test.tsx
  ```
  Expected: all PASS.

- [ ] **Step 7.5: Commit**

  ```bash
  git add src/components/cars/car-list.tsx src/components/cars/car-list.test.tsx
  git commit -m "feat(garage): skeleton loading + richer car card with stats"
  ```

---

### Task 8: CarDetail — skeleton gating ServiceHistory and RuleList

**Files:**
- Modify: `src/components/cars/car-detail.tsx`
- Modify: `src/components/cars/car-detail.test.tsx`

- [ ] **Step 8.1: Update `car-detail.test.tsx`**

  In `src/components/cars/car-detail.test.tsx`, in the `beforeEach` block, add `isServerSyncing: false`:

  ```ts
  beforeEach(() => {
    useGarageStore.setState({
      cars: [carA, carB],
      rules: [],
      logs: [],
      visits: [],
      selectedCarId: carA.id,
      hasHydrated: true,
      isServerSyncing: false,
    });
  });
  ```

  Add a new test at the end of the `describe("CarDetail", ...)` block:

  ```ts
  it("shows skeleton while isServerSyncing and hides car content", () => {
    useGarageStore.setState({ isServerSyncing: true });
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <CarDetail carId={carB.id} />
      </NextIntlClientProvider>,
    );
    expect(document.querySelector("[data-slot='skeleton']")).toBeInTheDocument();
    expect(screen.queryByText("Service history")).not.toBeInTheDocument();
    expect(screen.queryByText("Maintenance rules")).not.toBeInTheDocument();
  });
  ```

- [ ] **Step 8.2: Run tests to see the new one fail**

  ```bash
  npx vitest run src/components/cars/car-detail.test.tsx
  ```
  Expected: new skeleton test FAIL; all others PASS.

- [ ] **Step 8.3: Add skeleton to `car-detail.tsx`**

  Replace the full content of `src/components/cars/car-detail.tsx`:

  ```tsx
  "use client";

  import { useEffect } from "react";
  import { useGarageStore } from "@/stores/garage";
  import { Skeleton } from "@/components/ui/skeleton";
  import { CarActions } from "./car-actions";
  import { RuleList } from "./rule-list";
  import { ServiceHistory } from "./service-history";

  export function CarDetail({ carId }: { carId: string }) {
    const car = useGarageStore((s) => s.cars).find((c) => c.id === carId);
    const selectCar = useGarageStore((s) => s.selectCar);
    const isServerSyncing = useGarageStore((s) => s.isServerSyncing);
    const carExists = car !== undefined;

    useEffect(() => {
      if (carExists) selectCar(carId);
    }, [carExists, carId, selectCar]);

    if (isServerSyncing) {
      return (
        <div className="space-y-6">
          <div className="space-y-1">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{car?.name ?? ""}</h2>
          {car && (
            <p className="text-sm text-muted-foreground">
              {car.currentMileage.toLocaleString()} km
            </p>
          )}
        </div>
        {car && <CarActions car={car} />}
        <ServiceHistory carId={carId} />
        <RuleList carId={carId} />
      </div>
    );
  }
  ```

- [ ] **Step 8.4: Run tests to verify they all pass**

  ```bash
  npx vitest run src/components/cars/car-detail.test.tsx
  ```
  Expected: all PASS.

- [ ] **Step 8.5: Commit**

  ```bash
  git add src/components/cars/car-detail.tsx src/components/cars/car-detail.test.tsx
  git commit -m "feat(car-detail): skeleton loading gates ServiceHistory and RuleList"
  ```

---

### Task 9: Forms — button loading prop on all submit buttons

**Files:**
- Modify: `src/components/cars/log-visit-dialog.tsx`
- Modify: `src/components/cars/edit-visit-dialog.tsx`
- Modify: `src/components/cars/car-form-dialog.tsx`
- Modify: `src/components/cars/rule-form-dialog.tsx`
- Modify: `src/components/cars/standard-rules-dialog.tsx`
- Modify: `src/components/dashboard/mileage-form.tsx`
- Modify: `src/components/account/delete-account-dialog.tsx`

Each change is the same pattern: find the submit `<Button>` and add `loading={busy}` (or `loading={isExecuting}` for `DeleteAccountDialog`).

- [ ] **Step 9.1: `log-visit-dialog.tsx`**

  Find the submit button (near end of file):
  ```tsx
  // Before:
  <Button
    type="submit"
    size="lg"
    className="w-full"
    disabled={busy || selected.length === 0}
  >
  // After:
  <Button
    type="submit"
    size="lg"
    className="w-full"
    loading={busy}
    disabled={selected.length === 0}
  >
  ```

- [ ] **Step 9.2: `edit-visit-dialog.tsx`**

  ```tsx
  // Before:
  <Button
    type="submit"
    size="lg"
    className="w-full"
    disabled={busy || selected.length === 0}
  >
  // After:
  <Button
    type="submit"
    size="lg"
    className="w-full"
    loading={busy}
    disabled={selected.length === 0}
  >
  ```

- [ ] **Step 9.3: `car-form-dialog.tsx`**

  ```tsx
  // Before:
  <Button type="submit" size="lg" className="w-full" disabled={busy}>
  // After:
  <Button type="submit" size="lg" className="w-full" loading={busy}>
  ```

- [ ] **Step 9.4: `rule-form-dialog.tsx`**

  ```tsx
  // Before:
  <Button type="submit" size="lg" className="w-full" disabled={busy}>
  // After:
  <Button type="submit" size="lg" className="w-full" loading={busy}>
  ```

- [ ] **Step 9.5: `standard-rules-dialog.tsx`**

  ```tsx
  // Before:
  <Button
    size="lg"
    className="w-full"
    disabled={busy || selectedKeys.length === 0}
    onClick={handleSubmit}
  >
  // After:
  <Button
    size="lg"
    className="w-full"
    loading={busy}
    disabled={selectedKeys.length === 0}
    onClick={handleSubmit}
  >
  ```

- [ ] **Step 9.6: `mileage-form.tsx`**

  ```tsx
  // Before:
  <Button type="submit" size="lg" disabled={busy}>
  // After:
  <Button type="submit" size="lg" loading={busy}>
  ```

- [ ] **Step 9.7: `delete-account-dialog.tsx`**

  ```tsx
  // Before:
  <Button
    variant="destructive"
    className="w-full"
    disabled={!confirmed || isExecuting}
    onClick={...}
  >
    {isExecuting ? t("common.loading") : t("account.deleteAccount")}
  </Button>
  // After:
  <Button
    variant="destructive"
    className="w-full"
    loading={isExecuting}
    disabled={!confirmed}
    onClick={...}
  >
    {t("account.deleteAccount")}
  </Button>
  ```

- [ ] **Step 9.8: Run full test suite**

  ```bash
  npx vitest run
  ```
  Expected: all PASS.

- [ ] **Step 9.9: Commit**

  ```bash
  git add \
    src/components/cars/log-visit-dialog.tsx \
    src/components/cars/edit-visit-dialog.tsx \
    src/components/cars/car-form-dialog.tsx \
    src/components/cars/rule-form-dialog.tsx \
    src/components/cars/standard-rules-dialog.tsx \
    src/components/dashboard/mileage-form.tsx \
    src/components/account/delete-account-dialog.tsx
  git commit -m "feat(forms): show spinner on all submit buttons while busy"
  ```

---

### Task 10: DeleteAccountDialog — remove section wrapper, subtle trigger

**Files:**
- Modify: `src/components/account/delete-account-dialog.tsx`
- Modify: `src/app/(app)/cars/page.tsx`
- Modify: `src/components/account/delete-account-dialog.test.tsx` (verify or update)

- [ ] **Step 10.1: Read the existing test to check what it asserts**

  ```bash
  cat src/components/account/delete-account-dialog.test.tsx
  ```

- [ ] **Step 10.2: Remove section wrapper from `delete-account-dialog.tsx`**

  Replace the outer `<section ...>` and its `<h3>` with just the `<Dialog>` root. The trigger button becomes a ghost small muted link.

  The full component `return` should become:

  ```tsx
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setConfirmText("");
      }}
    >
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
            {t("account.deleteAccount")}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("account.deleteAccount")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t("account.deleteWarning")}</p>
        <div className="space-y-2">
          <Label htmlFor="confirm-delete">
            {t("account.deleteConfirmInstruction", { word: confirmWord })}
          </Label>
          <Input
            id="confirm-delete"
            autoComplete="off"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
          />
        </div>
        <Button
          variant="destructive"
          className="w-full"
          loading={isExecuting}
          disabled={!confirmed}
          onClick={() => {
            useGarageStore.persist.clearStorage();
            execute();
          }}
        >
          {t("account.deleteAccount")}
        </Button>
      </DialogContent>
    </Dialog>
  );
  ```

- [ ] **Step 10.3: Update test if it asserts on "Danger zone" heading**

  If step 10.1 shows a test asserting `screen.getByText(en.account.dangerZone)`, remove that assertion (the heading is gone). If the test does not check for it, no change is needed.

- [ ] **Step 10.4: Update `cars/page.tsx`**

  Replace the full content of `src/app/(app)/cars/page.tsx`:

  ```tsx
  import { getTranslations } from "next-intl/server";
  import { CarList } from "@/components/cars/car-list";
  import { DeleteAccountDialog } from "@/components/account/delete-account-dialog";

  export default async function GaragePage() {
    const t = await getTranslations("garage");
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">{t("title")}</h2>
        <CarList />
        <div className="pt-8 text-center">
          <DeleteAccountDialog />
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 10.5: Run full test suite**

  ```bash
  npx vitest run
  ```
  Expected: all PASS.

- [ ] **Step 10.6: Final type + lint check**

  ```bash
  npx tsc --noEmit && npx eslint src
  ```
  Expected: no errors.

- [ ] **Step 10.7: Commit**

  ```bash
  git add \
    src/components/account/delete-account-dialog.tsx \
    src/components/account/delete-account-dialog.test.tsx \
    src/app/(app)/cars/page.tsx
  git commit -m "feat(garage): subtle danger zone at page bottom, remove red section"
  ```

---

### Task 11: Final verification

- [ ] **Step 11.1: Run all checks**

  ```bash
  npx vitest run && npx tsc --noEmit && npx eslint src && npm run build
  ```
  Expected: tests PASS, no type errors, no lint errors, build succeeds.

- [ ] **Step 11.2: Commit if any lint auto-fixes were needed**

  If lint applied fixes: `git add -p && git commit -m "chore: lint fixes"`

---

## Self-Review

**Spec coverage check:**
- ✅ Pre-hydration splash — Task 3
- ✅ `isServerSyncing` store flag — Task 1
- ✅ GarageProvider clears flag on success + offline — Task 2
- ✅ Dashboard skeleton via `isServerSyncing` — Task 6
- ✅ CarList skeleton — Task 7
- ✅ CarDetail skeleton gating ServiceHistory + RuleList — Task 8
- ✅ Button `loading` prop — Task 4
- ✅ All 7 form submit buttons — Task 9
- ✅ Garage card: rules count, last service date, due/overdue badge — Task 7
- ✅ i18n keys for garage card — Task 5
- ✅ Danger zone: subtle ghost link at page bottom — Task 10

**Placeholder scan:** No TBDs, no "similar to Task N" shorthand, all code shown.

**Type consistency:**
- `isServerSyncing` defined in Task 1, read in Tasks 6/7/8 — consistent
- `setIsServerSyncing` defined in Task 1, called in Task 2 — consistent
- `loading` prop added to `Button` in Task 4, used identically in all Task 9 callsites — consistent
- `SplashRemover` created in Task 3, imported in Task 3 layout step — consistent
