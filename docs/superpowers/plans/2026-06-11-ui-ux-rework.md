# UI/UX Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bottom nav gains Log (opens visit dialog) and Car (selected car details) actions; car-details page leads with action buttons then history; dashboard cards sort by urgency; mileage form collapses to one line.

**Architecture:** All state already lives in the global zustand garage store (`src/stores/garage.ts`), so `BottomNav` can read `cars`/`selectedCarId`/`rules` directly and host its own `LogVisitDialog`. Car-details action buttons are lifted from `RuleList`/`ServiceHistory` into a new `CarActions` component. A pure compare helper in `src/lib/maintenance.ts` drives the dashboard sort.

**Tech Stack:** Next.js 16 (Turbopack), React, zustand, next-intl, shadcn/ui on Base UI, lucide-react, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-11-ui-ux-rework-design.md`

**Conventions that apply to every task:**
- i18n: any new user-facing string needs the same key in BOTH `src/messages/en.json` and `src/messages/uk.json` (identical key sets).
- Component tests use a real `NextIntlClientProvider` with the en catalog; `vi.mock` factories may only capture values from `vi.hoisted` (see `src/components/dashboard/dashboard.test.tsx`).
- Work happens on branch `ui-ux-rework`. Never commit on `main`.

---

### Task 1: Urgency compare helper in maintenance lib

**Files:**
- Modify: `src/lib/maintenance.ts`
- Test: `src/lib/maintenance.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/maintenance.test.ts` (import `compareMaintenanceUrgency` alongside the existing imports from `./maintenance`):

```ts
describe("compareMaintenanceUrgency", () => {
  const info = (
    status: "green" | "yellow" | "red",
    remainingKm: number | null = null,
    remainingDays: number | null = null,
  ) => ({ status, remainingKm, remainingDays });

  it("orders red before yellow before green", () => {
    const sorted = [info("green", 5000), info("red", -200), info("yellow", 900)].sort(
      compareMaintenanceUrgency,
    );
    expect(sorted.map((i) => i.status)).toEqual(["red", "yellow", "green"]);
  });

  it("breaks ties within a status by least remaining", () => {
    const a = info("yellow", 1200, null);
    const b = info("yellow", 800, null);
    expect([a, b].sort(compareMaintenanceUrgency)).toEqual([b, a]);
  });

  it("uses the smaller of km and days when both exist", () => {
    const kmCloser = info("green", 500, 400); // effective 400
    const daysCloser = info("green", 300, 9000); // effective 300
    expect([kmCloser, daysCloser].sort(compareMaintenanceUrgency)).toEqual([
      daysCloser,
      kmCloser,
    ]);
  });

  it("sorts entries with no remaining figures last within their status", () => {
    const noFigures = info("red"); // never serviced: nulls
    const overdue = info("red", -100);
    expect([noFigures, overdue].sort(compareMaintenanceUrgency)).toEqual([
      overdue,
      noFigures,
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/maintenance.test.ts`
Expected: FAIL — `compareMaintenanceUrgency` is not exported.

- [ ] **Step 3: Implement the helper**

Append to `src/lib/maintenance.ts` (reuses the existing `WORST` record):

```ts
function minRemaining(info: MaintenanceInfo): number {
  return Math.min(info.remainingKm ?? Infinity, info.remainingDays ?? Infinity);
}

// Most-urgent-first ordering for dashboard cards: red, yellow, green.
// Within a status the smaller remaining figure wins — km and days are not
// commensurable, but "fewest units left" is a fine same-status tie-break.
export function compareMaintenanceUrgency(
  a: MaintenanceInfo,
  b: MaintenanceInfo,
): number {
  if (a.status !== b.status) return WORST[b.status] - WORST[a.status];
  return minRemaining(a) - minRemaining(b);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/maintenance.test.ts`
Expected: PASS (all, including pre-existing).

- [ ] **Step 5: Commit**

```bash
git add src/lib/maintenance.ts src/lib/maintenance.test.ts
git commit -m "Add urgency compare helper for maintenance info

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Dashboard sorts cards by urgency

**Files:**
- Modify: `src/components/dashboard/dashboard.tsx`
- Test: `src/components/dashboard/dashboard.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `src/components/dashboard/dashboard.test.tsx`. Car mileage is 120000; intervals make Engine oil green (5000 km left), Air filter red (5000 km overdue), Coolant yellow (1200 km left, under the 1500 = 0.15×interval yellow threshold):

```tsx
describe("Dashboard urgency sort", () => {
  it("orders cards overdue, due soon, then ok", () => {
    useGarageStore.setState({
      logs: [
        oilLog, // Engine oil at 115000, interval 10000 -> green
        {
          id: "l2",
          carId,
          componentName: "Air filter",
          mileageAtService: 95000, // interval 20000 -> -5000 -> red
          dateAtService: "2026-05-01T00:00:00.000Z",
        },
        {
          id: "l3",
          carId,
          componentName: "Coolant",
          mileageAtService: 81200, // interval 40000 -> 1200 left -> yellow
          dateAtService: "2026-05-01T00:00:00.000Z",
        },
      ],
    });
    renderDashboard();
    const names = screen
      .getAllByText(/^(Engine oil|Air filter|Coolant)$/)
      .map((el) => el.textContent);
    expect(names).toEqual(["Air filter", "Coolant", "Engine oil"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/dashboard/dashboard.test.tsx`
Expected: FAIL — order is `["Engine oil", "Air filter", "Coolant"]` (rule order).

- [ ] **Step 3: Sort in the dashboard**

In `src/components/dashboard/dashboard.tsx`:

Add `compareMaintenanceUrgency` to the maintenance import:

```ts
import {
  compareMaintenanceUrgency,
  computeMaintenance,
  latestLogFor,
} from "@/lib/maintenance";
```

Replace the `{servicedRules.map((rule) => { ... })}` block: compute entries first, sort, then render. Above the `return`, after `const now = new Date();` is fine — but `car` is narrowed inside the JSX branch, so compute it right before the JSX list instead. Concretely, replace:

```tsx
          {servicedRules.map((rule) => {
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
```

with:

```tsx
          {servicedRules
            .map((rule) => {
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
              return { rule, last, info };
            })
            .sort((a, b) => compareMaintenanceUrgency(a.info, b.info))
            .map(({ rule, last, info }) => (
              <StatusCard
                key={rule.id}
                componentName={rule.componentName}
                info={info}
                lastService={last}
                onLogService={() => setLogComponent(rule.componentName)}
              />
            ))}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/dashboard/dashboard.test.tsx`
Expected: PASS (new test and pre-existing auto-hide tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/dashboard.tsx src/components/dashboard/dashboard.test.tsx
git commit -m "Sort dashboard cards by urgency

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Compact mileage form

**Files:**
- Modify: `src/components/dashboard/mileage-form.tsx`
- Test: `src/components/dashboard/mileage-form.test.tsx`

- [ ] **Step 1: Rewrite the test file (failing)**

Replace the whole of `src/components/dashboard/mileage-form.test.tsx` with:

```tsx
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import { MileageForm } from "./mileage-form";

afterEach(cleanup);

function renderForm(onSubmit: (mileage: number) => void) {
  const { container } = render(
    <NextIntlClientProvider locale="en" messages={en}>
      <MileageForm currentMileage={120000} onSubmit={onSubmit} />
    </NextIntlClientProvider>,
  );
  return within(container);
}

function expand(view: ReturnType<typeof within>) {
  fireEvent.click(view.getByRole("button", { name: "Edit" }));
}

describe("MileageForm", () => {
  it("is collapsed by default, showing the formatted mileage", () => {
    const view = renderForm(vi.fn());
    expect(view.getByText("120,000 km")).toBeInTheDocument();
    expect(view.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("expands on edit with the current value focused", () => {
    const view = renderForm(vi.fn());
    expand(view);
    const input = view.getByRole("spinbutton");
    expect(input).toHaveValue(120000);
    expect(input).toHaveFocus();
  });

  it("submits the entered mileage and collapses", () => {
    const onSubmit = vi.fn();
    const view = renderForm(onSubmit);
    expand(view);
    fireEvent.change(view.getByRole("spinbutton"), { target: { value: "121500" } });
    fireEvent.click(view.getByRole("button", { name: "Update" }));
    expect(onSubmit).toHaveBeenCalledWith(121500);
    expect(view.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("does not submit an empty value and stays expanded", () => {
    const onSubmit = vi.fn();
    const view = renderForm(onSubmit);
    expand(view);
    fireEvent.change(view.getByRole("spinbutton"), { target: { value: "" } });
    fireEvent.click(view.getByRole("button", { name: "Update" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(view.getByRole("spinbutton")).toBeInTheDocument();
  });

  it("collapses without submitting on Escape", () => {
    const onSubmit = vi.fn();
    const view = renderForm(onSubmit);
    expand(view);
    fireEvent.keyDown(view.getByRole("spinbutton"), { key: "Escape" });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(view.queryByRole("spinbutton")).not.toBeInTheDocument();
  });
});
```

(The old "resets the input when currentMileage changes externally" test is dropped: the input no longer exists while collapsed, and each edit session now starts from the current prop.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/dashboard/mileage-form.test.tsx`
Expected: FAIL — form renders expanded, no Edit button.

- [ ] **Step 3: Implement the collapsed/expanded form**

Replace the whole of `src/components/dashboard/mileage-form.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
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
  const t = useTranslations();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  if (!editing) {
    return (
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{t("dashboard.currentMileage")}</p>
          <p className="font-medium">{currentMileage.toLocaleString()} km</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("common.edit")}
          onClick={() => {
            setValue(String(currentMileage));
            setEditing(true);
          }}
        >
          <Pencil className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const mileage = Number(value);
        if (value === "" || !Number.isFinite(mileage) || mileage < 0) return;
        onSubmit(Math.floor(mileage));
        setEditing(false);
      }}
    >
      <div className="flex-1 space-y-1">
        <Label htmlFor="mileage">{t("dashboard.currentMileage")}</Label>
        <Input
          id="mileage"
          type="number"
          inputMode="numeric"
          min={0}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditing(false);
          }}
        />
      </div>
      <Button type="submit" size="lg">
        {t("dashboard.updateMileage")}
      </Button>
    </form>
  );
}
```

Note: bare `toLocaleString()` matches the formatting used in `car-detail.tsx` and the cards; the test asserts `"120,000 km"`, which holds under Node's default en-US locale (existing tests already rely on this).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/dashboard/mileage-form.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the dashboard tests too (MileageForm is embedded there)**

Run: `npx vitest run src/components/dashboard`
Expected: PASS. If a dashboard test queried the spinbutton directly, update it to expand first via the Edit button.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/mileage-form.tsx src/components/dashboard/mileage-form.test.tsx
git commit -m "Collapse dashboard mileage form to a single line

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Bottom nav — Dashboard · Log · Car · Garage

**Files:**
- Modify: `src/components/bottom-nav.tsx`
- Modify: `src/messages/en.json`, `src/messages/uk.json`
- Test: `src/components/bottom-nav.test.tsx` (create)

- [ ] **Step 1: Add i18n keys**

In `src/messages/en.json`, replace the `nav` block:

```json
  "nav": {
    "dashboard": "Dashboard",
    "log": "Log",
    "car": "Car",
    "garage": "Garage"
  },
```

In `src/messages/uk.json`, replace the `nav` block:

```json
  "nav": {
    "dashboard": "Головна",
    "log": "Запис",
    "car": "Авто",
    "garage": "Гараж"
  },
```

- [ ] **Step 2: Write the failing test**

Create `src/components/bottom-nav.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import { useGarageStore } from "@/stores/garage";

// vi.mock factories are hoisted above imports — anything they capture
// must come from vi.hoisted, or it is "accessed before initialization".
const { pathnameMock, createVisit } = vi.hoisted(() => ({
  pathnameMock: vi.fn(() => "/"),
  createVisit: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: pathnameMock,
}));
vi.mock("@/actions/visits", () => ({
  createVisitAction: createVisit,
}));

import { BottomNav } from "./bottom-nav";

const carId = "65f1a2b3c4d5e6f7a8b9c0d1";
const car = {
  id: carId,
  name: "Octavia",
  currentMileage: 120000,
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const rule = { id: "r1", carId, componentName: "Engine oil", intervalKm: 10000 };

afterEach(cleanup);
beforeEach(() => {
  pathnameMock.mockReturnValue("/");
  useGarageStore.setState({
    cars: [car],
    rules: [rule],
    logs: [],
    visits: [],
    selectedCarId: carId,
    hasHydrated: true,
  });
});

function renderNav() {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <BottomNav />
    </NextIntlClientProvider>,
  );
}

describe("BottomNav", () => {
  it("renders all four items", () => {
    renderNav();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: "Log" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "Car" })).toHaveAttribute(
      "href",
      `/cars/${carId}`,
    );
    expect(screen.getByRole("link", { name: "Garage" })).toHaveAttribute("href", "/cars");
  });

  it("opens the log visit dialog for the selected car", () => {
    renderNav();
    fireEvent.click(screen.getByRole("button", { name: "Log" }));
    expect(screen.getByText("Log services")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Engine oil" })).toBeInTheDocument();
  });

  it("disables Log when the selected car has no rules", () => {
    useGarageStore.setState({ rules: [] });
    renderNav();
    expect(screen.getByRole("button", { name: "Log" })).toBeDisabled();
  });

  it("disables Log and Car when there are no cars", () => {
    useGarageStore.setState({ cars: [], rules: [], selectedCarId: null });
    renderNav();
    expect(screen.getByRole("button", { name: "Log" })).toBeDisabled();
    expect(screen.queryByRole("link", { name: "Car" })).not.toBeInTheDocument();
  });

  it("marks Car (not Garage) current on the selected car's page", () => {
    pathnameMock.mockReturnValue(`/cars/${carId}`);
    renderNav();
    expect(screen.getByRole("link", { name: "Car" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Garage" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("marks Garage current on the garage page", () => {
    pathnameMock.mockReturnValue("/cars");
    renderNav();
    expect(screen.getByRole("link", { name: "Garage" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/components/bottom-nav.test.tsx`
Expected: FAIL — no Log button, no Car link.

- [ ] **Step 4: Rewrite the nav**

Replace the whole of `src/components/bottom-nav.tsx` with:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CarFront,
  LayoutDashboard,
  Warehouse,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useGarageStore } from "@/stores/garage";
import { LogVisitDialog } from "@/components/cars/log-visit-dialog";
import { cn } from "@/lib/utils";

function itemClasses(active: boolean) {
  return cn(
    "flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors",
    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
  );
}

function ItemIcon({ icon: Icon, active }: { icon: LucideIcon; active: boolean }) {
  return (
    <span
      className={cn(
        "flex h-6 w-12 items-center justify-center rounded-full transition-colors",
        active && "bg-primary/10",
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
    </span>
  );
}

export function BottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [logOpen, setLogOpen] = useState(false);
  const cars = useGarageStore((s) => s.cars);
  const rules = useGarageStore((s) => s.rules);
  const selectedCarId = useGarageStore((s) => s.selectedCarId);
  const car = cars.find((c) => c.id === selectedCarId) ?? null;
  const hasRules = car !== null && rules.some((r) => r.carId === car.id);

  const dashboardActive = pathname === "/";
  const carActive = car !== null && pathname === `/cars/${car.id}`;
  const garageActive = pathname === "/cars";

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/80 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-md">
        <Link
          href="/"
          aria-current={dashboardActive ? "page" : undefined}
          className={itemClasses(dashboardActive)}
        >
          <ItemIcon icon={LayoutDashboard} active={dashboardActive} />
          {t("dashboard")}
        </Link>
        <button
          type="button"
          disabled={!hasRules}
          onClick={() => setLogOpen(true)}
          className={cn(itemClasses(false), "disabled:opacity-40")}
        >
          <ItemIcon icon={Wrench} active={false} />
          {t("log")}
        </button>
        {car ? (
          <Link
            href={`/cars/${car.id}`}
            aria-current={carActive ? "page" : undefined}
            className={itemClasses(carActive)}
          >
            <ItemIcon icon={CarFront} active={carActive} />
            {t("car")}
          </Link>
        ) : (
          <span aria-disabled="true" className={cn(itemClasses(false), "opacity-40")}>
            <ItemIcon icon={CarFront} active={false} />
            {t("car")}
          </span>
        )}
        <Link
          href="/cars"
          aria-current={garageActive ? "page" : undefined}
          className={itemClasses(garageActive)}
        >
          <ItemIcon icon={Warehouse} active={garageActive} />
          {t("garage")}
        </Link>
      </div>
      {car && <LogVisitDialog car={car} open={logOpen} onOpenChange={setLogOpen} />}
    </nav>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/bottom-nav.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/bottom-nav.tsx src/components/bottom-nav.test.tsx src/messages/en.json src/messages/uk.json
git commit -m "Bottom nav: add Log action and Car details items

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Car-details page selects the viewed car

**Files:**
- Modify: `src/components/cars/car-detail.tsx`
- Test: `src/components/cars/car-detail.test.tsx` (create)

This keeps the nav's Car tab, the dashboard, and the nav Log dialog in sync with whichever car the user is looking at.

- [ ] **Step 1: Write the failing test**

Create `src/components/cars/car-detail.test.tsx`:

```tsx
import { cleanup, render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import { useGarageStore } from "@/stores/garage";

// vi.mock factories are hoisted above imports — anything they capture
// must come from vi.hoisted, or it is "accessed before initialization".
const { actions } = vi.hoisted(() => ({
  actions: { rule: vi.fn(), log: vi.fn(), visit: vi.fn() },
}));

vi.mock("@/actions/rules", () => ({
  createRuleAction: actions.rule,
  updateRuleAction: actions.rule,
  deleteRuleAction: actions.rule,
  createStandardRulesAction: actions.rule,
}));
vi.mock("@/actions/logs", () => ({
  deleteLogAction: actions.log,
}));
vi.mock("@/actions/visits", () => ({
  createVisitAction: actions.visit,
  updateVisitAction: actions.visit,
}));

import { CarDetail } from "./car-detail";

const carA = {
  id: "65f1a2b3c4d5e6f7a8b9c0d1",
  name: "Octavia",
  currentMileage: 120000,
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const carB = {
  id: "65f1a2b3c4d5e6f7a8b9c0d2",
  name: "Golf",
  currentMileage: 287000,
  updatedAt: "2026-01-01T00:00:00.000Z",
};

afterEach(cleanup);
beforeEach(() => {
  useGarageStore.setState({
    cars: [carA, carB],
    rules: [],
    logs: [],
    visits: [],
    selectedCarId: carA.id,
    hasHydrated: true,
  });
});

describe("CarDetail", () => {
  it("selects the viewed car in the garage store", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <CarDetail carId={carB.id} />
      </NextIntlClientProvider>,
    );
    expect(useGarageStore.getState().selectedCarId).toBe(carB.id);
  });

  it("does not select an unknown car id", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <CarDetail carId="000000000000000000000000" />
      </NextIntlClientProvider>,
    );
    expect(useGarageStore.getState().selectedCarId).toBe(carA.id);
  });
});
```

Note: if the mocked action module exports don't match (vitest will error with "No export named ..."), check the actual export names in `src/actions/rules.ts`, `src/actions/logs.ts`, `src/actions/visits.ts` and mirror them; the mock just has to satisfy the imports of `RuleList`, `ServiceHistory`, and their dialogs.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/cars/car-detail.test.tsx`
Expected: FAIL — `selectedCarId` stays `carA.id` in the first test.

- [ ] **Step 3: Implement the sync**

In `src/components/cars/car-detail.tsx`, add the effect (new imports: `useEffect` from react):

```tsx
"use client";

import { useEffect } from "react";
import { useGarageStore } from "@/stores/garage";
import { RuleList } from "./rule-list";
import { ServiceHistory } from "./service-history";

export function CarDetail({ carId }: { carId: string }) {
  const car = useGarageStore((s) => s.cars).find((c) => c.id === carId);
  const selectCar = useGarageStore((s) => s.selectCar);
  const carExists = car !== undefined;

  // Viewing a car makes it the selected car so the bottom nav's Car/Log
  // items and the dashboard follow it.
  useEffect(() => {
    if (carExists) selectCar(carId);
  }, [carExists, carId, selectCar]);

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
      <RuleList carId={carId} />
      <ServiceHistory carId={carId} />
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/cars/car-detail.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/cars/car-detail.tsx src/components/cars/car-detail.test.tsx
git commit -m "Select the viewed car on the car details page

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Car details — lift actions, reorder sections

**Files:**
- Create: `src/components/cars/car-actions.tsx`
- Modify: `src/components/cars/car-detail.tsx`
- Modify: `src/components/cars/rule-list.tsx` (remove bottom button grid)
- Modify: `src/components/cars/service-history.tsx` (remove header button + log dialog)
- Test: `src/components/cars/car-detail.test.tsx` (extend)

- [ ] **Step 1: Write the failing test**

Append to the `describe("CarDetail", ...)` block in `src/components/cars/car-detail.test.tsx` (add `screen` to the testing-library import):

```tsx
  it("shows the action buttons above the history and rules sections", () => {
    useGarageStore.setState({
      rules: [
        { id: "r1", carId: carB.id, componentName: "Engine oil", intervalKm: 10000 },
      ],
    });
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <CarDetail carId={carB.id} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("button", { name: /Log services/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Add rule/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add standard rules/ })).toBeInTheDocument();
    // History section precedes the rules section in the DOM.
    const history = screen.getByText("Service history");
    const rules = screen.getByText("Maintenance rules");
    expect(
      history.compareDocumentPosition(rules) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
```

Check the exact heading strings against `src/messages/en.json` (`car.history`, `car.rules`) and adjust the `getByText` literals if they differ.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/cars/car-detail.test.tsx`
Expected: FAIL — rules section currently precedes history, and "Log services" lives inside the history header.

- [ ] **Step 3: Create CarActions**

Create `src/components/cars/car-actions.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ClipboardList, ListChecks, Plus } from "lucide-react";
import { useGarageStore } from "@/stores/garage";
import type { Car } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { LogVisitDialog } from "./log-visit-dialog";
import { RuleFormDialog } from "./rule-form-dialog";
import { StandardRulesDialog } from "./standard-rules-dialog";

export function CarActions({ car }: { car: Car }) {
  const t = useTranslations();
  const [logOpen, setLogOpen] = useState(false);
  const hasRules = useGarageStore((s) => s.rules).some((r) => r.carId === car.id);

  return (
    <div className="space-y-2">
      <Button
        size="lg"
        className="w-full"
        disabled={!hasRules}
        onClick={() => setLogOpen(true)}
      >
        <ClipboardList className="size-4" /> {t("car.logServices")}
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <RuleFormDialog
          carId={car.id}
          trigger={
            <Button variant="outline" size="lg">
              <Plus className="size-4" /> {t("car.addRule")}
            </Button>
          }
        />
        <StandardRulesDialog
          carId={car.id}
          trigger={
            <Button variant="outline" size="lg">
              <ListChecks className="size-4" /> {t("car.addStandardRules")}
            </Button>
          }
        />
      </div>
      <LogVisitDialog car={car} open={logOpen} onOpenChange={setLogOpen} />
    </div>
  );
}
```

- [ ] **Step 4: Reorder car-detail and slot in CarActions**

In `src/components/cars/car-detail.tsx`, import CarActions and change the body:

```tsx
import { CarActions } from "./car-actions";
```

```tsx
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
```

- [ ] **Step 5: Strip the buttons from RuleList**

In `src/components/cars/rule-list.tsx`:
- Delete the trailing `<div className="grid grid-cols-2 gap-2">...</div>` block (the create-mode `RuleFormDialog` and `StandardRulesDialog` triggers).
- Remove the now-unused imports: `ListChecks`, `Plus` from lucide-react, and `StandardRulesDialog`. Keep `RuleFormDialog` (still used for per-rule edit) and `Pencil`, `Trash2`, `Wrench`.

- [ ] **Step 6: Strip the header button from ServiceHistory**

In `src/components/cars/service-history.tsx`:
- Replace the header block

```tsx
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">{t("car.history")}</h3>
        {car && (
          <Button
            variant="outline"
            size="sm"
            disabled={!hasRules}
            onClick={() => setLogOpen(true)}
          >
            <ClipboardList className="size-4" /> {t("car.logServices")}
          </Button>
        )}
      </div>
```

with

```tsx
      <h3 className="text-sm font-medium text-muted-foreground">{t("car.history")}</h3>
```

- Delete the `{car && <LogVisitDialog car={car} open={logOpen} onOpenChange={setLogOpen} />}` line, the `const [logOpen, setLogOpen] = useState(false);` state, and the `const hasRules = ...` line.
- Remove now-unused imports: `ClipboardList` from lucide-react and `LogVisitDialog`. Keep `useState` (still used for `editing`), `Button`, `EditVisitDialog`.

- [ ] **Step 7: Run the cars test suites**

Run: `npx vitest run src/components/cars`
Expected: PASS. If `standard-rules-dialog.test.tsx` or others rendered `RuleList`/`ServiceHistory` to reach the removed triggers, update them to render the dialog directly or via `CarActions`.

- [ ] **Step 8: Commit**

```bash
git add src/components/cars
git commit -m "Car details: action buttons on top, history before rules

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: all suites PASS.

- [ ] **Step 2: Types and lint**

Run: `npx tsc --noEmit && npx eslint src`
Expected: no errors. Fix anything reported (likely candidates: unused imports left behind in Task 6).

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: `next build` and `serwist build` both succeed.

- [ ] **Step 4: i18n key parity check**

Run:
```bash
node -e "
const en=require('./src/messages/en.json'),uk=require('./src/messages/uk.json');
const keys=(o,p='')=>Object.entries(o).flatMap(([k,v])=>typeof v==='object'?keys(v,p+k+'.'):[p+k]);
const a=new Set(keys(en)),b=new Set(keys(uk));
const onlyEn=[...a].filter(k=>!b.has(k)),onlyUk=[...b].filter(k=>!a.has(k));
if(onlyEn.length||onlyUk.length){console.error({onlyEn,onlyUk});process.exit(1)}
console.log('key sets identical');
"
```
Expected: `key sets identical`.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "Fix verification fallout from UI rework

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

(Skip if the working tree is clean.)
