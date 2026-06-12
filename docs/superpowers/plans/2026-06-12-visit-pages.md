# Visit Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `LogVisitDialog` and `EditVisitDialog` modals with dedicated full-page routes so the form uses the full mobile viewport.

**Architecture:** Two new pages under `(app)/cars/[carId]/` — `log-visit/` and `edit-visit/[logId]/`. Each is a thin server route that awaits params and renders a `"use client"` component. A shared `VisitForm` component holds the form UI. All four callsites (BottomNav, CarActions, Dashboard, ServiceHistory) switch from opening a dialog to calling `router.push`. Both dialog files and their test files are deleted at the end.

**Tech Stack:** Next.js 16 App Router, React, next-intl, Zustand (garage store), lucide-react, shadcn/ui Button/Input/Label, Tailwind CSS.

---

### Task 1: Add `common.back` i18n key

**Files:**
- Modify: `src/messages/en.json:10`
- Modify: `src/messages/uk.json:10`

- [ ] **Step 1: Add key to en.json**

In `src/messages/en.json`, add `"back"` after `"confirmDelete"` on line 10 (inside the `"common"` object):

```json
    "confirmDelete": "Are you sure? This cannot be undone.",
    "back": "Back"
```

- [ ] **Step 2: Add key to uk.json**

In `src/messages/uk.json`, add `"back"` after `"confirmDelete"` on line 10 (inside the `"common"` object):

```json
    "confirmDelete": "Ви впевнені? Цю дію не можна скасувати.",
    "back": "Назад"
```

- [ ] **Step 3: Verify both files compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/messages/en.json src/messages/uk.json
git commit -m "feat(i18n): add common.back key"
```

---

### Task 2: Create shared `VisitForm` component

**Files:**
- Create: `src/components/cars/visit-form.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/cars/visit-form.tsx` with this exact content:

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function VisitForm({
  listedNames,
  initialChecked,
  initialMileage,
  initialDate,
  initialCost,
  submitLabel,
  busy,
  onSubmit,
}: {
  listedNames: string[];
  initialChecked: string[];
  initialMileage: number;
  initialDate: string;
  initialCost?: number;
  submitLabel: (count: number) => string;
  busy: boolean;
  onSubmit: (values: {
    componentNames: string[];
    mileage: number;
    date: string;
    cost: string;
  }) => void;
}) {
  const t = useTranslations("car");
  const today = new Date().toISOString().slice(0, 10);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const isChecked = (name: string) => checked[name] ?? initialChecked.includes(name);
  const selected = listedNames.filter(isChecked);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    onSubmit({
      componentNames: selected,
      mileage: Number(data.get("mileage")),
      date: String(data.get("date")),
      cost: String(data.get("cost") ?? "").trim(),
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1">
        {listedNames.map((name) => (
          <label
            key={name}
            className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-accent"
          >
            <input
              type="checkbox"
              className="size-4 accent-primary"
              aria-label={name}
              checked={isChecked(name)}
              disabled={busy}
              onChange={(e) =>
                setChecked((c) => ({ ...c, [name]: e.target.checked }))
              }
            />
            <span className="flex-1 font-medium">{name}</span>
          </label>
        ))}
      </div>
      <div className="space-y-2">
        <Label htmlFor="visit-mileage">{t("serviceMileage")}</Label>
        <Input
          id="visit-mileage"
          name="mileage"
          type="number"
          inputMode="numeric"
          min={0}
          defaultValue={initialMileage}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="visit-date">{t("serviceDate")}</Label>
        <Input
          id="visit-date"
          name="date"
          type="date"
          max={today}
          defaultValue={initialDate}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="visit-cost">{t("totalCost")}</Label>
        <Input
          id="visit-cost"
          name="cost"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          defaultValue={initialCost ?? ""}
        />
      </div>
      <Button
        type="submit"
        size="lg"
        className="w-full"
        loading={busy}
        disabled={selected.length === 0}
      >
        {submitLabel(selected.length)}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/cars/visit-form.tsx
git commit -m "feat(visit): add shared VisitForm component"
```

---

### Task 3: Create log-visit page

**Files:**
- Create: `src/app/(app)/cars/[carId]/log-visit/page.tsx`
- Create: `src/components/cars/log-visit-page.tsx`

- [ ] **Step 1: Create the client component**

Create `src/components/cars/log-visit-page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { createVisitAction } from "@/actions/visits";
import { actionErrorKey } from "@/lib/action-feedback";
import { useGarageStore } from "@/stores/garage";
import { Button } from "@/components/ui/button";
import { VisitForm } from "./visit-form";

export function LogVisitPage({ carId }: { carId: string }) {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const store = useGarageStore();
  const car = useGarageStore((s) => s.cars).find((c) => c.id === carId) ?? null;
  const ruleNames = useGarageStore((s) => s.rules)
    .filter((r) => r.carId === carId)
    .map((r) => r.componentName);

  useEffect(() => {
    if (!car) router.replace("/");
  }, [car, router]);

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }

  async function handleSubmit(values: {
    componentNames: string[];
    mileage: number;
    date: string;
    cost: string;
  }) {
    if (!car) return;
    setBusy(true);
    try {
      const result = await createVisitAction({
        carId: car.id,
        componentNames: values.componentNames,
        mileageAtService: values.mileage,
        dateAtService: new Date(values.date),
        ...(values.cost !== "" && { totalCost: Number(values.cost) }),
      });
      const errorKey = actionErrorKey(result);
      if (errorKey) {
        toast.error(t(errorKey));
      } else {
        const { visit, logs, newCarMileage } = result!.data!;
        store.addVisit(visit);
        for (const log of logs) store.addLog(log);
        if (newCarMileage !== null) store.setCarMileage(car.id, newCarMileage);
        toast.success(t("car.visitLogged", { count: logs.length }));
        goBack();
      }
    } finally {
      setBusy(false);
    }
  }

  if (!car) return null;

  const preselectedComponent = searchParams.get("component");
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label={t("common.back")} onClick={goBack}>
          <ArrowLeft className="size-5" />
        </Button>
        <h2 className="text-lg font-semibold">{t("car.logServices")}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{t("car.logVisitDescription")}</p>
      <VisitForm
        listedNames={ruleNames}
        initialChecked={preselectedComponent ? [preselectedComponent] : []}
        initialMileage={car.currentMileage}
        initialDate={today}
        submitLabel={(count) => t("car.logVisitSubmit", { count })}
        busy={busy}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create the server route**

Create `src/app/(app)/cars/[carId]/log-visit/page.tsx`:

```tsx
import { Suspense } from "react";
import { LogVisitPage } from "@/components/cars/log-visit-page";

export default async function LogVisitRoute({
  params,
}: {
  params: Promise<{ carId: string }>;
}) {
  const { carId } = await params;
  return (
    <Suspense>
      <LogVisitPage carId={carId} />
    </Suspense>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/cars/[carId]/log-visit/page.tsx src/components/cars/log-visit-page.tsx
git commit -m "feat(visit): add log-visit page"
```

---

### Task 4: Create edit-visit page

**Files:**
- Create: `src/app/(app)/cars/[carId]/edit-visit/[logId]/page.tsx`
- Create: `src/components/cars/edit-visit-page.tsx`

- [ ] **Step 1: Create the client component**

Create `src/components/cars/edit-visit-page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { updateVisitAction } from "@/actions/visits";
import { actionErrorKey } from "@/lib/action-feedback";
import { useGarageStore } from "@/stores/garage";
import { Button } from "@/components/ui/button";
import { VisitForm } from "./visit-form";

export function EditVisitPage({ carId, logId }: { carId: string; logId: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const store = useGarageStore();
  const car = useGarageStore((s) => s.cars).find((c) => c.id === carId) ?? null;
  const editedLog = useGarageStore((s) => s.logs).find((l) => l.id === logId) ?? null;
  const visit = useGarageStore((s) => s.visits).find((v) => v.id === editedLog?.visitId) ?? null;
  const currentComponents = useGarageStore((s) => s.logs)
    .filter((l) => editedLog?.visitId != null && l.visitId === editedLog.visitId)
    .map((l) => l.componentName);
  if (currentComponents.length === 0 && editedLog) {
    currentComponents.push(editedLog.componentName);
  }
  const ruleNames = useGarageStore((s) => s.rules)
    .filter((r) => r.carId === carId)
    .map((r) => r.componentName);
  const listedNames = [
    ...ruleNames,
    ...currentComponents.filter((name) => !ruleNames.includes(name)),
  ];

  useEffect(() => {
    if (!car || !editedLog) router.replace("/");
  }, [car, editedLog, router]);

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }

  async function handleSubmit(values: {
    componentNames: string[];
    mileage: number;
    date: string;
    cost: string;
  }) {
    if (!car || !editedLog) return;
    setBusy(true);
    try {
      const result = await updateVisitAction({
        carId: car.id,
        target: editedLog.visitId
          ? { visitId: editedLog.visitId }
          : { logId: editedLog.id },
        componentNames: values.componentNames,
        mileageAtService: values.mileage,
        dateAtService: new Date(values.date),
        ...(values.cost !== "" && { totalCost: Number(values.cost) }),
      });
      const errorKey = actionErrorKey(result);
      if (errorKey) {
        toast.error(t(errorKey));
      } else {
        const { visit: updatedVisit, logs, newCarMileage } = result!.data!;
        store.applyVisitUpdate(
          updatedVisit,
          logs,
          editedLog.visitId ? undefined : editedLog.id,
        );
        if (newCarMileage !== null) store.setCarMileage(car.id, newCarMileage);
        toast.success(t("car.visitUpdated"));
        goBack();
      }
    } finally {
      setBusy(false);
    }
  }

  if (!car || !editedLog) return null;

  const today = new Date().toISOString().slice(0, 10);
  const initialDate = (visit?.dateAtService ?? editedLog.dateAtService).slice(0, 10);
  const initialMileage = visit?.mileageAtService ?? editedLog.mileageAtService;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label={t("common.back")} onClick={goBack}>
          <ArrowLeft className="size-5" />
        </Button>
        <h2 className="text-lg font-semibold">{t("car.editVisit")}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{t("car.logVisitDescription")}</p>
      <VisitForm
        listedNames={listedNames}
        initialChecked={currentComponents}
        initialMileage={initialMileage}
        initialDate={initialDate}
        initialCost={visit?.totalCost ?? undefined}
        submitLabel={(count) => t("car.saveVisit", { count })}
        busy={busy}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create the server route**

Create `src/app/(app)/cars/[carId]/edit-visit/[logId]/page.tsx`:

```tsx
import { EditVisitPage } from "@/components/cars/edit-visit-page";

export default async function EditVisitRoute({
  params,
}: {
  params: Promise<{ carId: string; logId: string }>;
}) {
  const { carId, logId } = await params;
  return <EditVisitPage carId={carId} logId={logId} />;
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/cars/[carId]/edit-visit/[logId]/page.tsx src/components/cars/edit-visit-page.tsx
git commit -m "feat(visit): add edit-visit page"
```

---

### Task 5: Update BottomNav callsite

**Files:**
- Modify: `src/components/bottom-nav.tsx`

- [ ] **Step 1: Update the file**

Replace the entire `bottom-nav.tsx` with the following (removes `logOpen`/`setLogOpen`, `prevCarId`/`setPrevCarId` state, `LogVisitDialog` import and render; adds `useRouter`; changes button to navigate):

```tsx
"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CarFront,
  LayoutDashboard,
  Warehouse,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useGarageStore } from "@/stores/garage";
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
  const router = useRouter();
  // The persisted store rehydrates synchronously on the client, so without
  // this gate the first client render (cars present) would not match the
  // server HTML (no cars) and hydration would fail.
  // useSyncExternalStore returns the serverSnapshot on the server / first
  // hydration pass and switches to the clientSnapshot only after mount.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const cars = useGarageStore((s) => s.cars);
  const rules = useGarageStore((s) => s.rules);
  const selectedCarId = useGarageStore((s) => s.selectedCarId);
  const car = mounted ? (cars.find((c) => c.id === selectedCarId) ?? null) : null;
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
          onClick={() => car && router.push(`/cars/${car.id}/log-visit`)}
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
    </nav>
  );
}
```

- [ ] **Step 2: Type-check and lint**

```bash
npx tsc --noEmit && npx eslint src/components/bottom-nav.tsx
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/bottom-nav.tsx
git commit -m "feat(visit): bottom-nav navigates to log-visit page"
```

---

### Task 6: Update CarActions callsite

**Files:**
- Modify: `src/components/cars/car-actions.tsx`

- [ ] **Step 1: Update the file**

Replace the entire `car-actions.tsx` (removes `logOpen`/`setLogOpen` state, `LogVisitDialog` import and render; adds `useRouter`; changes button to navigate):

```tsx
"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ClipboardList, ListChecks, Plus } from "lucide-react";
import { useGarageStore } from "@/stores/garage";
import { cn } from "@/lib/utils";
import type { Car } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { RuleFormDialog } from "./rule-form-dialog";
import { StandardRulesDialog } from "./standard-rules-dialog";

export function CarActions({ car }: { car: Car }) {
  const t = useTranslations();
  const router = useRouter();
  const ruleCount = useGarageStore((s) => s.rules).filter(
    (r) => r.carId === car.id,
  ).length;
  const hasRules = ruleCount > 0;
  // The standard-rules picker is an onboarding shortcut; once the car has a
  // real rule set, hide it so a bulk add can't trample tuned intervals.
  const showStandardRules = ruleCount <= 3;

  return (
    <div className="space-y-2">
      <Button
        size="lg"
        className="w-full"
        disabled={!hasRules}
        title={!hasRules ? t("car.noRulesHint") : undefined}
        onClick={() => router.push(`/cars/${car.id}/log-visit`)}
      >
        <ClipboardList className="size-4" /> {t("car.logServices")}
      </Button>
      <div className={cn("grid gap-2", showStandardRules ? "grid-cols-2" : "grid-cols-1")}>
        <RuleFormDialog
          carId={car.id}
          trigger={
            <Button variant="outline" size="lg">
              <Plus className="size-4" /> {t("car.addRule")}
            </Button>
          }
        />
        {showStandardRules && (
          <StandardRulesDialog
            carId={car.id}
            trigger={
              <Button variant="outline" size="lg">
                <ListChecks className="size-4" /> {t("car.addStandardRules")}
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check and lint**

```bash
npx tsc --noEmit && npx eslint src/components/cars/car-actions.tsx
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/cars/car-actions.tsx
git commit -m "feat(visit): car-actions navigates to log-visit page"
```

---

### Task 7: Update Dashboard callsite

**Files:**
- Modify: `src/components/dashboard/dashboard.tsx`

- [ ] **Step 1: Update the file**

Replace the entire `dashboard.tsx` (removes `logComponent` state, `LogVisitDialog` import and render; adds `useRouter`; changes `onLogService` to navigate):

```tsx
"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { actionErrorKey } from "@/lib/action-feedback";
import { updateCarMileageAction } from "@/actions/cars";
import {
  compareMaintenanceUrgency,
  computeMaintenance,
  latestLogFor,
} from "@/lib/maintenance";
import { useGarageStore } from "@/stores/garage";
import { Skeleton } from "@/components/ui/skeleton";
import { CarSwitcher } from "./car-switcher";
import { MileageForm } from "./mileage-form";
import { StatusCard } from "./status-card";

export function Dashboard() {
  const t = useTranslations("dashboard");
  const tRoot = useTranslations();
  const router = useRouter();
  const store = useGarageStore();
  const { cars, rules, logs, selectedCarId, isServerSyncing } = store;

  if (isServerSyncing) {
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
  // Never-serviced rules are hidden from the dashboard to keep it focused;
  // the hint below links to the car page where first services get logged.
  const servicedRules = carRules.filter(
    (rule) => latestLogFor(logs, car.id, rule.componentName) !== null,
  );
  const hiddenCount = carRules.length - servicedRules.length;
  const now = new Date();

  async function handleMileage(mileage: number) {
    if (!car) return false;
    const previous = car.currentMileage;
    store.setCarMileage(car.id, mileage);
    const result = await updateCarMileageAction({ carId: car.id, mileage });
    if (!result?.data) {
      store.setCarMileage(car.id, previous);
      const errorKey = actionErrorKey(result);
      if (errorKey) toast.error(tRoot(errorKey));
      return false;
    }
    return true;
  }

  return (
    <div className="space-y-4">
      <CarSwitcher />
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
                onLogService={() =>
                  router.push(
                    `/cars/${car.id}/log-visit?component=${encodeURIComponent(rule.componentName)}`,
                  )
                }
              />
            ))}
          {hiddenCount > 0 && (
            <p className="text-center text-sm text-muted-foreground">
              <Link href={`/cars/${car.id}`} className="underline">
                {t("hiddenRules", { count: hiddenCount })}
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check and lint**

```bash
npx tsc --noEmit && npx eslint src/components/dashboard/dashboard.tsx
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/dashboard.tsx
git commit -m "feat(visit): dashboard navigates to log-visit page"
```

---

### Task 8: Update ServiceHistory callsite

**Files:**
- Modify: `src/components/cars/service-history.tsx`

- [ ] **Step 1: Update the file**

Replace the entire `service-history.tsx` (removes `editing` state, `EditVisitDialog` import and render; adds `useRouter`; changes edit button to navigate):

```tsx
"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { deleteLogAction } from "@/actions/logs";
import { actionErrorKey } from "@/lib/action-feedback";
import { useGarageStore } from "@/stores/garage";
import type { ServiceLog } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ServiceHistory({ carId }: { carId: string }) {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const visits = useGarageStore((s) => s.visits);
  const logs = useGarageStore((s) => s.logs)
    .filter((l) => l.carId === carId)
    .sort((a, b) => b.dateAtService.localeCompare(a.dateAtService));
  const store = useGarageStore();

  // The visit total renders once per visit, on its first (newest) row.
  function visitTotalFor(log: ServiceLog, index: number): number | null {
    if (!log.visitId) return null;
    if (logs.findIndex((l) => l.visitId === log.visitId) !== index) return null;
    return visits.find((v) => v.id === log.visitId)?.totalCost ?? null;
  }

  async function handleDelete(logId: string) {
    if (!window.confirm(t("car.deleteLogConfirm"))) return;
    const previous = store.logs;
    store.removeLog(logId);
    const result = await deleteLogAction({ logId, carId });
    const errorKey = actionErrorKey(result);
    if (errorKey) {
      useGarageStore.setState({ logs: previous });
      toast.error(t(errorKey));
    } else if (result?.data?.removedVisitId) {
      store.removeVisit(result.data.removedVisitId);
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">{t("car.history")}</h3>
      {logs.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("car.noLogs")}</p>
      )}
      {logs.map((log, index) => {
        const visitTotal = visitTotalFor(log, index);
        return (
          <Card key={log.id}>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="font-medium">{log.componentName}</p>
                <p className="text-sm text-muted-foreground">
                  {format.dateTime(new Date(log.dateAtService), {
                    dateStyle: "medium",
                  })}
                  {" · "}
                  {log.mileageAtService.toLocaleString()} km
                </p>
                {visitTotal !== null && (
                  <p className="text-sm text-muted-foreground">
                    {t("car.visitTotal", {
                      amount: format.number(visitTotal, {
                        style: "currency",
                        currency: "UAH",
                        currencyDisplay: "narrowSymbol",
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      }),
                    })}
                  </p>
                )}
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("common.edit")}
                  onClick={() => router.push(`/cars/${carId}/edit-visit/${log.id}`)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("common.delete")}
                  onClick={() => handleDelete(log.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Type-check and lint**

```bash
npx tsc --noEmit && npx eslint src/components/cars/service-history.tsx
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/cars/service-history.tsx
git commit -m "feat(visit): service-history navigates to edit-visit page"
```

---

### Task 9: Delete dialog files and run full verification

**Files:**
- Delete: `src/components/cars/log-visit-dialog.tsx`
- Delete: `src/components/cars/log-visit-dialog.test.tsx`
- Delete: `src/components/cars/edit-visit-dialog.tsx`
- Delete: `src/components/cars/edit-visit-dialog.test.tsx`

- [ ] **Step 1: Delete the files**

```bash
rm src/components/cars/log-visit-dialog.tsx \
   src/components/cars/log-visit-dialog.test.tsx \
   src/components/cars/edit-visit-dialog.tsx \
   src/components/cars/edit-visit-dialog.test.tsx
```

- [ ] **Step 2: Run full verification suite**

```bash
npx vitest run
```

Expected: all tests pass (the deleted dialog tests no longer exist; no other tests should reference the deleted files).

```bash
npx tsc --noEmit && npx eslint src
```

Expected: no errors.

```bash
npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(visit): remove log-visit and edit-visit dialogs"
```
