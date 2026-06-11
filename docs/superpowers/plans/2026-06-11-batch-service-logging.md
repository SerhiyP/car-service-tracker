# Batch Service Logging (Visits) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "service visits" the only way to log maintenance work — one dialog where the user checks everything done in one garage visit, with shared date/mileage and one optional total cost (₴).

**Architecture:** A new `service_visits` Mongo collection holds date/mileage/totalCost; each log created through a visit carries a `visitId`. A new `createVisitAction` creates the visit plus one log per selected component. The old single-log flow (`createLogAction`, `LogServiceDialog`) is removed; the dashboard's per-component buttons open the new dialog with that component preselected. Service history stays a flat list — the only additions are a "Log services" button in its header and a "Visit total" line on the first row of each visit group.

**Tech Stack:** Next.js 16 (Turbopack), Auth.js v5, next-safe-action (`authActionClient`), MongoDB driver, Zustand (persisted), next-intl, Zod, Vitest + Testing Library, shadcn/ui on Base UI.

**Spec:** `docs/superpowers/specs/2026-06-11-batch-service-logging-design.md`

**Branch:** `feat/batch-service-logging` (already checked out — NEVER commit on `main`).

**Codebase notes for the implementer:**
- All user-facing strings are next-intl keys; `src/messages/en.json` and `uk.json` MUST keep identical key sets.
- Server errors are thrown as `ActionError("<i18n key>")` and translated client-side via `actionErrorKey` (`src/lib/action-feedback.ts`).
- Repositories are thin, untested wrappers over the mongodb driver; ObjectId↔string conversion at the boundary.
- shadcn/ui here is on Base UI: `DialogTrigger render={...}`, not `asChild`.
- Run after every task: `npx vitest run` and `npx tsc --noEmit && npx eslint src`. `npm run build` at the end.

---

## File map

| File | Change |
| --- | --- |
| `src/lib/types.ts` | Add `ServiceVisit`; add `visitId?` to `ServiceLog`; add `visits` to `GarageData` |
| `src/lib/schemas/visit.ts` | **New** — `visitInputSchema` |
| `src/lib/schemas/schemas.test.ts` | Add visit schema tests; later remove log-input tests |
| `src/lib/schemas/log.ts` | Eventually only `logDeleteSchema` remains |
| `src/lib/repositories/visits.ts` | **New** — create/delete/list visits |
| `src/lib/repositories/logs.ts` | Add `visitId` to doc mapping, `createLogs`, `countLogsByVisitId`; `deleteLog` returns the deleted log; remove `createLog` |
| `src/actions/visits.ts` | **New** — `createVisitAction` |
| `src/actions/logs.ts` | `deleteLogAction` cleans up orphan visits; `createLogAction` removed |
| `src/actions/garage.ts` | Include visits in `getGarageDataAction` |
| `src/stores/garage.ts` | `visits` state + `addVisit`/`removeVisit`, included in `setAll`/`removeCar`/`partialize` |
| `src/components/cars/log-visit-dialog.tsx` | **New** — the visit dialog |
| `src/components/cars/log-visit-dialog.test.tsx` | **New** — component tests |
| `src/components/cars/service-history.tsx` | Header button, visit totals, visit-aware delete |
| `src/components/dashboard/dashboard.tsx` | Use `LogVisitDialog` with preselected component |
| `src/components/dashboard/log-service-dialog.tsx` | **Deleted** |
| `src/messages/en.json`, `src/messages/uk.json` | New keys; remove `car.logService` |

---

### Task 1: Visit input schema (TDD)

**Files:**
- Create: `src/lib/schemas/visit.ts`
- Modify: `src/lib/schemas/schemas.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/schemas/schemas.test.ts` — new import at the top with the other schema imports:

```ts
import { visitInputSchema } from "./visit";
```

New describe block at the end of the file:

```ts
describe("visit schema", () => {
  const valid = {
    carId: oid,
    componentNames: ["Engine oil", "Air filter"],
    mileageAtService: 120000,
    dateAtService: "2026-01-15",
  };

  it("accepts a valid visit without cost and coerces the date", () => {
    const parsed = visitInputSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.dateAtService).toBeInstanceOf(Date);
      expect(parsed.data.totalCost).toBeUndefined();
    }
  });

  it("accepts a non-negative total cost and rejects bad costs", () => {
    expect(visitInputSchema.safeParse({ ...valid, totalCost: 1500.5 }).success).toBe(true);
    expect(visitInputSchema.safeParse({ ...valid, totalCost: 0 }).success).toBe(true);
    expect(visitInputSchema.safeParse({ ...valid, totalCost: -1 }).success).toBe(false);
    expect(visitInputSchema.safeParse({ ...valid, totalCost: "free" }).success).toBe(false);
    expect(visitInputSchema.safeParse({ ...valid, totalCost: 100_000_000 }).success).toBe(false);
  });

  it("requires at least one component name", () => {
    expect(visitInputSchema.safeParse({ ...valid, componentNames: [] }).success).toBe(false);
    expect(visitInputSchema.safeParse({ ...valid, componentNames: [""] }).success).toBe(false);
  });

  it("rejects future dates and bad car ids", () => {
    const future = new Date(Date.now() + 7 * 86_400_000).toISOString();
    expect(visitInputSchema.safeParse({ ...valid, dateAtService: future }).success).toBe(false);
    expect(visitInputSchema.safeParse({ ...valid, carId: "short" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/schemas/schemas.test.ts`
Expected: FAIL — cannot resolve `./visit`.

- [ ] **Step 3: Write the schema**

Create `src/lib/schemas/visit.ts`:

```ts
import { z } from "zod";
import { mileageSchema, objectIdSchema } from "./common";

// +1 day tolerance so "today" in any client timezone is accepted.
const notInFuture = (d: Date) => d.getTime() <= Date.now() + 86_400_000;

export const visitInputSchema = z.object({
  carId: objectIdSchema,
  componentNames: z
    .array(z.string().trim().min(1, "validation.componentRequired").max(100))
    .min(1, "validation.componentsRequired"),
  mileageAtService: mileageSchema,
  dateAtService: z.coerce.date().refine(notInFuture, "validation.dateFuture"),
  totalCost: z
    .number("validation.costInvalid")
    .min(0, "validation.costInvalid")
    .max(99_999_999, "validation.costInvalid")
    .optional(),
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/schemas/schemas.test.ts`
Expected: PASS (all blocks, including the pre-existing ones).

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas/visit.ts src/lib/schemas/schemas.test.ts
git commit -m "Add visit input schema"
```

---

### Task 2: Types, repositories, garage data

Repositories are deliberately untested (thin driver wrappers — project convention); correctness is checked by `tsc` here and by the action/component layers later.

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/repositories/visits.ts`
- Modify: `src/lib/repositories/logs.ts`
- Modify: `src/actions/garage.ts`

- [ ] **Step 1: Extend types**

In `src/lib/types.ts`, add `visitId` to `ServiceLog`, and add the new interface + `visits` field so the file becomes:

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
  /** Present on logs created through a visit; absent on legacy logs. */
  visitId?: string;
}

export interface ServiceVisit {
  id: string;
  carId: string;
  mileageAtService: number;
  dateAtService: string;
  totalCost?: number;
}

export interface GarageData {
  cars: Car[];
  rules: MaintenanceRule[];
  logs: ServiceLog[];
  visits: ServiceVisit[];
  syncedAt: string;
}
```

- [ ] **Step 2: Create the visits repository**

Create `src/lib/repositories/visits.ts`:

```ts
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import type { ServiceVisit } from "@/lib/types";

interface VisitDoc {
  carId: ObjectId;
  mileageAtService: number;
  dateAtService: Date;
  totalCost?: number;
}

const visits = () => getDb().collection<VisitDoc>("service_visits");

function toVisit(doc: VisitDoc & { _id: ObjectId }): ServiceVisit {
  return {
    id: doc._id.toHexString(),
    carId: doc.carId.toHexString(),
    mileageAtService: doc.mileageAtService,
    dateAtService: doc.dateAtService.toISOString(),
    ...(doc.totalCost !== undefined && { totalCost: doc.totalCost }),
  };
}

export async function listVisitsByCarIds(carIds: string[]): Promise<ServiceVisit[]> {
  if (carIds.length === 0) return [];
  const docs = await visits()
    .find({ carId: { $in: carIds.map((id) => new ObjectId(id)) } })
    .toArray();
  return docs.map(toVisit);
}

export async function createVisit(input: {
  carId: string;
  mileageAtService: number;
  dateAtService: Date;
  totalCost?: number;
}): Promise<ServiceVisit> {
  const doc: VisitDoc = {
    carId: new ObjectId(input.carId),
    mileageAtService: input.mileageAtService,
    dateAtService: input.dateAtService,
    ...(input.totalCost !== undefined && { totalCost: input.totalCost }),
  };
  const result = await visits().insertOne(doc);
  return toVisit({ ...doc, _id: result.insertedId });
}

export async function deleteVisit(visitId: string, carId: string): Promise<boolean> {
  const result = await visits().deleteOne({
    _id: new ObjectId(visitId),
    carId: new ObjectId(carId),
  });
  return result.deletedCount === 1;
}
```

- [ ] **Step 3: Extend the logs repository**

Rewrite `src/lib/repositories/logs.ts` as below. Changes: `LogDoc.visitId?`, `visitId` in `toLog`, new `createLogs` + `countLogsByVisitId`, and `deleteLog` now returns the deleted log (the delete action needs its `visitId` for orphan-visit cleanup). `createLog` stays for now — the old single-log flow still compiles until Task 8 removes it.

```ts
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import type { ServiceLog } from "@/lib/types";

interface LogDoc {
  carId: ObjectId;
  componentName: string;
  mileageAtService: number;
  dateAtService: Date;
  visitId?: ObjectId;
}

const logs = () => getDb().collection<LogDoc>("service_logs");

function toLog(doc: LogDoc & { _id: ObjectId }): ServiceLog {
  return {
    id: doc._id.toHexString(),
    carId: doc.carId.toHexString(),
    componentName: doc.componentName,
    mileageAtService: doc.mileageAtService,
    dateAtService: doc.dateAtService.toISOString(),
    ...(doc.visitId !== undefined && { visitId: doc.visitId.toHexString() }),
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

export async function createLogs(input: {
  carId: string;
  visitId: string;
  componentNames: string[];
  mileageAtService: number;
  dateAtService: Date;
}): Promise<ServiceLog[]> {
  if (input.componentNames.length === 0) return [];
  const docs: LogDoc[] = input.componentNames.map((componentName) => ({
    carId: new ObjectId(input.carId),
    componentName,
    mileageAtService: input.mileageAtService,
    dateAtService: input.dateAtService,
    visitId: new ObjectId(input.visitId),
  }));
  const result = await logs().insertMany(docs);
  return docs.map((doc, i) => toLog({ ...doc, _id: result.insertedIds[i] }));
}

export async function countLogsByVisitId(visitId: string, carId: string): Promise<number> {
  return logs().countDocuments({
    visitId: new ObjectId(visitId),
    carId: new ObjectId(carId),
  });
}

export async function deleteLog(logId: string, carId: string): Promise<ServiceLog | null> {
  const doc = await logs().findOneAndDelete({
    _id: new ObjectId(logId),
    carId: new ObjectId(carId),
  });
  return doc ? toLog(doc) : null;
}
```

- [ ] **Step 4: Include visits in garage data**

`src/actions/garage.ts` — fetch visits alongside rules and logs:

```ts
"use server";

import { authActionClient } from "@/lib/safe-action";
import { listCars } from "@/lib/repositories/cars";
import { listRulesByCarIds } from "@/lib/repositories/rules";
import { listLogsByCarIds } from "@/lib/repositories/logs";
import { listVisitsByCarIds } from "@/lib/repositories/visits";
import type { GarageData } from "@/lib/types";

export const getGarageDataAction = authActionClient.action(
  async ({ ctx }): Promise<GarageData> => {
    const cars = await listCars(ctx.userId);
    const carIds = cars.map((c) => c.id);
    const [rules, logs, visits] = await Promise.all([
      listRulesByCarIds(carIds),
      listLogsByCarIds(carIds),
      listVisitsByCarIds(carIds),
    ]);
    return { cars, rules, logs, visits, syncedAt: new Date().toISOString() };
  },
);
```

- [ ] **Step 5: Update the store so the project compiles**

`src/stores/garage.ts` — `setAll` consumes `GarageData` which now has `visits`, so add visit state in the same step. Changes:

In `GarageState`, after `logs: ServiceLog[];` add:

```ts
  visits: ServiceVisit[];
```

In the interface, after `removeLog: (logId: string) => void;` add:

```ts
  addVisit: (visit: ServiceVisit) => void;
  removeVisit: (visitId: string) => void;
```

Update the type import:

```ts
import type { Car, GarageData, MaintenanceRule, ServiceLog, ServiceVisit } from "@/lib/types";
```

In the initial state, after `logs: [],` add `visits: [],`.

In `setAll`, after `logs: data.logs,` add `visits: data.visits,`.

In `removeCar`, extend the returned object with:

```ts
            visits: s.visits.filter((v) => v.carId !== carId),
```

After `removeLog`, add the two new actions:

```ts
      addVisit: (visit) => set((s) => ({ visits: [visit, ...s.visits] })),

      removeVisit: (visitId) =>
        set((s) => ({ visits: s.visits.filter((v) => v.id !== visitId) })),
```

In `partialize`, after `logs: s.logs,` add `visits: s.visits,`. (No persist version bump: zustand's default shallow merge keeps the initial `visits: []` for previously persisted state that lacks the key.)

- [ ] **Step 6: Verify**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/types.ts src/lib/repositories/visits.ts src/lib/repositories/logs.ts src/actions/garage.ts src/stores/garage.ts
git commit -m "Add service visit model, repository, and store state"
```

---

### Task 3: i18n keys

**Files:**
- Modify: `src/messages/en.json`
- Modify: `src/messages/uk.json`

Both files MUST end up with identical key sets. `car.logService` is NOT removed yet (the old dialog still uses it until Task 8).

- [ ] **Step 1: Add English keys**

In `src/messages/en.json`, inside `"car"` after `"standardRulesAdded"`, add:

```json
    "logServices": "Log services",
    "logVisitDescription": "Select the work done during this visit. Date, mileage, and cost apply to everything selected.",
    "logVisitSubmit": "Log selected ({count})",
    "visitLogged": "{count, plural, one {# service logged} other {# services logged}}",
    "totalCost": "Total cost (₴, optional)",
    "visitTotal": "Visit total: {amount}"
```

Inside `"validation"` after `"codeInvalid"`, add:

```json
    "costInvalid": "Enter a valid cost",
    "componentsRequired": "Select at least one service item"
```

- [ ] **Step 2: Add Ukrainian keys**

In `src/messages/uk.json`, inside `"car"` after `"standardRulesAdded"`, add:

```json
    "logServices": "Записати сервіси",
    "logVisitDescription": "Позначте роботи, виконані під час цього візиту. Дата, пробіг і вартість стосуються всього вибраного.",
    "logVisitSubmit": "Записати вибрані ({count})",
    "visitLogged": "{count, plural, one {Записано # роботу} few {Записано # роботи} many {Записано # робіт} other {Записано # роботи}}",
    "totalCost": "Загальна вартість (₴, необовʼязково)",
    "visitTotal": "Разом за візит: {amount}"
```

Inside `"validation"` after `"codeInvalid"`, add:

```json
    "costInvalid": "Введіть коректну вартість",
    "componentsRequired": "Виберіть хоча б одну роботу"
```

- [ ] **Step 3: Verify key sets match**

Run:

```bash
node -e "
const en = require('./src/messages/en.json'), uk = require('./src/messages/uk.json');
const keys = (o, p='') => Object.entries(o).flatMap(([k,v]) => typeof v === 'object' ? keys(v, p+k+'.') : [p+k]);
const a = new Set(keys(en)), b = new Set(keys(uk));
const diff = [...a].filter(k => !b.has(k)).concat([...b].filter(k => !a.has(k)));
console.log(diff.length ? 'MISMATCH: ' + diff.join(', ') : 'OK');
"
```

Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add src/messages/en.json src/messages/uk.json
git commit -m "Add i18n keys for visit logging"
```

---

### Task 4: createVisitAction and orphan-visit cleanup on delete

**Files:**
- Create: `src/actions/visits.ts`
- Modify: `src/actions/logs.ts`

Actions follow the project convention of being exercised through component tests with mocked actions (Task 5) plus `tsc`; there is no direct action test harness.

- [ ] **Step 1: Create the visit action**

Create `src/actions/visits.ts`:

```ts
"use server";

import { ActionError, authActionClient } from "@/lib/safe-action";
import { visitInputSchema } from "@/lib/schemas/visit";
import { getCar, setCarMileage } from "@/lib/repositories/cars";
import { listRulesByCarIds } from "@/lib/repositories/rules";
import { createLogs } from "@/lib/repositories/logs";
import { createVisit } from "@/lib/repositories/visits";

export const createVisitAction = authActionClient
  .inputSchema(visitInputSchema)
  .action(async ({ parsedInput, ctx }) => {
    const car = await getCar(ctx.userId, parsedInput.carId);
    if (!car) throw new ActionError("errors.notFound");

    // Only the car's own rules may be logged — never trust client-supplied names.
    const rules = await listRulesByCarIds([parsedInput.carId]);
    const ruleNames = new Set(rules.map((r) => r.componentName));
    if (!parsedInput.componentNames.every((name) => ruleNames.has(name)))
      throw new ActionError("errors.notFound");

    const visit = await createVisit({
      carId: parsedInput.carId,
      mileageAtService: parsedInput.mileageAtService,
      dateAtService: parsedInput.dateAtService,
      ...(parsedInput.totalCost !== undefined && { totalCost: parsedInput.totalCost }),
    });
    const logs = await createLogs({
      carId: parsedInput.carId,
      visitId: visit.id,
      componentNames: parsedInput.componentNames,
      mileageAtService: parsedInput.mileageAtService,
      dateAtService: parsedInput.dateAtService,
    });

    // Spec: a service at a higher mileage raises the car's current mileage.
    let newCarMileage: number | null = null;
    if (parsedInput.mileageAtService > car.currentMileage) {
      await setCarMileage(ctx.userId, parsedInput.carId, parsedInput.mileageAtService);
      newCarMileage = parsedInput.mileageAtService;
    }

    return { visit, logs, newCarMileage };
  });
```

- [ ] **Step 2: Update deleteLogAction**

In `src/actions/logs.ts`, leave `createLogAction` untouched and replace `deleteLogAction` with:

```ts
export const deleteLogAction = authActionClient
  .inputSchema(logDeleteSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!(await getCar(ctx.userId, parsedInput.carId)))
      throw new ActionError("errors.notFound");
    const deleted = await deleteLog(parsedInput.logId, parsedInput.carId);
    if (!deleted) throw new ActionError("errors.notFound");

    // Last log of a visit gone → remove the now-orphaned visit.
    let removedVisitId: string | null = null;
    if (deleted.visitId) {
      const remaining = await countLogsByVisitId(deleted.visitId, parsedInput.carId);
      if (remaining === 0) {
        await deleteVisit(deleted.visitId, parsedInput.carId);
        removedVisitId = deleted.visitId;
      }
    }
    return { ok: true, removedVisitId };
  });
```

Update the imports in that file:

```ts
import { createLog, countLogsByVisitId, deleteLog } from "@/lib/repositories/logs";
import { deleteVisit } from "@/lib/repositories/visits";
```

- [ ] **Step 3: Verify**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/actions/visits.ts src/actions/logs.ts
git commit -m "Add createVisitAction and orphan-visit cleanup on log delete"
```

---

### Task 5: LogVisitDialog component (TDD)

**Files:**
- Create: `src/components/cars/log-visit-dialog.test.tsx`
- Create: `src/components/cars/log-visit-dialog.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/cars/log-visit-dialog.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import { useGarageStore } from "@/stores/garage";

// vi.mock factories are hoisted above imports — anything they capture
// must come from vi.hoisted, or it is "accessed before initialization".
const { createVisit } = vi.hoisted(() => ({
  createVisit: vi.fn(),
}));

vi.mock("@/actions/visits", () => ({
  createVisitAction: createVisit,
}));

import { LogVisitDialog } from "./log-visit-dialog";

const carId = "65f1a2b3c4d5e6f7a8b9c0d1";
const car = {
  id: carId,
  name: "Octavia",
  currentMileage: 120000,
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const rules = [
  { id: "r1", carId, componentName: "Engine oil", intervalKm: 10000 },
  { id: "r2", carId, componentName: "Air filter", intervalKm: 20000 },
];

afterEach(cleanup);
beforeEach(() => {
  createVisit.mockReset();
  useGarageStore.setState({
    cars: [car],
    rules,
    logs: [],
    visits: [],
    selectedCarId: carId,
  });
});

function renderDialog(preselectedComponent: string | null = null) {
  const onOpenChange = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <LogVisitDialog
        car={car}
        open
        onOpenChange={onOpenChange}
        preselectedComponent={preselectedComponent}
      />
    </NextIntlClientProvider>,
  );
  return onOpenChange;
}

describe("LogVisitDialog", () => {
  it("lists a checkbox per rule, unchecked, with submit disabled", () => {
    renderDialog();
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(rules.length);
    for (const box of boxes) expect(box).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Log selected (0)" })).toBeDisabled();
  });

  it("pre-checks the preselected component", () => {
    renderDialog("Engine oil");
    expect(screen.getByRole("checkbox", { name: "Engine oil" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Air filter" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Log selected (1)" })).toBeEnabled();
  });

  it("submits selection with shared mileage/date/cost and applies the result", async () => {
    const visit = {
      id: "v1",
      carId,
      mileageAtService: 121000,
      dateAtService: "2026-06-10T00:00:00.000Z",
      totalCost: 1500,
    };
    const logs = [
      {
        id: "l1",
        carId,
        componentName: "Engine oil",
        mileageAtService: 121000,
        dateAtService: "2026-06-10T00:00:00.000Z",
        visitId: "v1",
      },
    ];
    createVisit.mockResolvedValue({ data: { visit, logs, newCarMileage: 121000 } });

    const onOpenChange = renderDialog();
    fireEvent.click(screen.getByRole("checkbox", { name: "Engine oil" }));
    fireEvent.change(screen.getByLabelText("Mileage at service (km)"), {
      target: { value: "121000" },
    });
    fireEvent.change(screen.getByLabelText(/Total cost/), {
      target: { value: "1500" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log selected (1)" }));

    await vi.waitFor(() =>
      expect(createVisit).toHaveBeenCalledWith(
        expect.objectContaining({
          carId,
          componentNames: ["Engine oil"],
          mileageAtService: 121000,
          totalCost: 1500,
        }),
      ),
    );
    await vi.waitFor(() => expect(useGarageStore.getState().visits).toEqual([visit]));
    expect(useGarageStore.getState().logs).toEqual(logs);
    expect(useGarageStore.getState().cars[0].currentMileage).toBe(121000);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("omits totalCost when the cost field is left empty", async () => {
    createVisit.mockResolvedValue({
      data: {
        visit: { id: "v2", carId, mileageAtService: 120000, dateAtService: "2026-06-10T00:00:00.000Z" },
        logs: [],
        newCarMileage: null,
      },
    });
    renderDialog("Engine oil");
    fireEvent.click(screen.getByRole("button", { name: "Log selected (1)" }));
    await vi.waitFor(() => expect(createVisit).toHaveBeenCalled());
    expect(createVisit.mock.calls[0][0]).not.toHaveProperty("totalCost");
  });

  it("keeps the store unchanged and stays open on failure", async () => {
    createVisit.mockResolvedValue({ serverError: "errors.notFound" });
    const onOpenChange = renderDialog("Engine oil");
    fireEvent.click(screen.getByRole("button", { name: "Log selected (1)" }));
    await vi.waitFor(() => expect(createVisit).toHaveBeenCalled());
    expect(useGarageStore.getState().visits).toEqual([]);
    expect(useGarageStore.getState().logs).toEqual([]);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/cars/log-visit-dialog.test.tsx`
Expected: FAIL — cannot resolve `./log-visit-dialog`.

- [ ] **Step 3: Implement the dialog**

Create `src/components/cars/log-visit-dialog.tsx`. Notes: creates are non-optimistic (server ids needed); the checked map resets on close so each visit starts clean; `isChecked` falls back to the preselected component so the dashboard flow works without state churn.

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createVisitAction } from "@/actions/visits";
import { actionErrorKey } from "@/lib/action-feedback";
import { useGarageStore } from "@/stores/garage";
import type { Car } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LogVisitDialog({
  car,
  open,
  onOpenChange,
  preselectedComponent = null,
}: {
  car: Car;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedComponent?: string | null;
}) {
  const t = useTranslations();
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const store = useGarageStore();
  const ruleNames = useGarageStore((s) => s.rules)
    .filter((r) => r.carId === car.id)
    .map((r) => r.componentName);

  const isChecked = (name: string) => checked[name] ?? name === preselectedComponent;
  const selected = ruleNames.filter(isChecked);

  function handleOpenChange(next: boolean) {
    if (!next) setChecked({});
    onOpenChange(next);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const mileage = Number(data.get("mileage"));
    const date = String(data.get("date"));
    const cost = String(data.get("cost") ?? "").trim();

    setBusy(true);
    try {
      const result = await createVisitAction({
        carId: car.id,
        componentNames: selected,
        mileageAtService: mileage,
        dateAtService: new Date(date),
        ...(cost !== "" && { totalCost: Number(cost) }),
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
        handleOpenChange(false);
      }
    } finally {
      setBusy(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("car.logServices")}</DialogTitle>
          <DialogDescription>{t("car.logVisitDescription")}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="max-h-[40vh] space-y-1 overflow-y-auto">
            {ruleNames.map((name) => (
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
            <Label htmlFor="visit-mileage">{t("car.serviceMileage")}</Label>
            <Input
              id="visit-mileage"
              name="mileage"
              type="number"
              inputMode="numeric"
              min={0}
              defaultValue={car.currentMileage}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="visit-date">{t("car.serviceDate")}</Label>
            <Input
              id="visit-date"
              name="date"
              type="date"
              max={today}
              defaultValue={today}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="visit-cost">{t("car.totalCost")}</Label>
            <Input
              id="visit-cost"
              name="cost"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
            />
          </div>
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={busy || selected.length === 0}
          >
            {t("car.logVisitSubmit", { count: selected.length })}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/cars/log-visit-dialog.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/cars/log-visit-dialog.tsx src/components/cars/log-visit-dialog.test.tsx
git commit -m "Add LogVisitDialog for batch service logging"
```

---

### Task 6: Service history — header button, visit totals, visit-aware delete

**Files:**
- Modify: `src/components/cars/service-history.tsx`

- [ ] **Step 1: Rewrite the component**

Replace `src/components/cars/service-history.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ClipboardList, Trash2 } from "lucide-react";
import { deleteLogAction } from "@/actions/logs";
import { actionErrorKey } from "@/lib/action-feedback";
import { useGarageStore } from "@/stores/garage";
import type { ServiceLog } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LogVisitDialog } from "./log-visit-dialog";

export function ServiceHistory({ carId }: { carId: string }) {
  const t = useTranslations();
  const format = useFormatter();
  const [logOpen, setLogOpen] = useState(false);
  const car = useGarageStore((s) => s.cars).find((c) => c.id === carId);
  const hasRules = useGarageStore((s) => s.rules).some((r) => r.carId === carId);
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
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      }),
                    })}
                  </p>
                )}
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
        );
      })}
      {car && <LogVisitDialog car={car} open={logOpen} onOpenChange={setLogOpen} />}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/cars/service-history.tsx
git commit -m "Add visit logging entry point and visit totals to service history"
```

---

### Task 7: Dashboard uses the visit dialog

**Files:**
- Modify: `src/components/dashboard/dashboard.tsx`

- [ ] **Step 1: Swap the dialog**

In `src/components/dashboard/dashboard.tsx`:

Replace the import

```tsx
import { LogServiceDialog } from "./log-service-dialog";
```

with

```tsx
import { LogVisitDialog } from "@/components/cars/log-visit-dialog";
```

Replace the dialog usage at the bottom of the JSX

```tsx
      <LogServiceDialog
        car={car}
        componentName={logComponent}
        open={logComponent !== null}
        onOpenChange={(open) => !open && setLogComponent(null)}
      />
```

with

```tsx
      <LogVisitDialog
        car={car}
        preselectedComponent={logComponent}
        open={logComponent !== null}
        onOpenChange={(open) => !open && setLogComponent(null)}
      />
```

Everything else (the `logComponent` state, `StatusCard.onLogService`) stays as is.

- [ ] **Step 2: Verify**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/dashboard.tsx
git commit -m "Open the visit dialog from dashboard status cards"
```

---

### Task 8: Remove the old single-log flow

**Files:**
- Delete: `src/components/dashboard/log-service-dialog.tsx`
- Modify: `src/actions/logs.ts`
- Modify: `src/lib/schemas/log.ts`
- Modify: `src/lib/repositories/logs.ts`
- Modify: `src/lib/schemas/schemas.test.ts`
- Modify: `src/messages/en.json`, `src/messages/uk.json`

- [ ] **Step 1: Delete the old dialog**

```bash
git rm src/components/dashboard/log-service-dialog.tsx
```

- [ ] **Step 2: Remove createLogAction**

`src/actions/logs.ts` becomes:

```ts
"use server";

import { ActionError, authActionClient } from "@/lib/safe-action";
import { logDeleteSchema } from "@/lib/schemas/log";
import { getCar } from "@/lib/repositories/cars";
import { countLogsByVisitId, deleteLog } from "@/lib/repositories/logs";
import { deleteVisit } from "@/lib/repositories/visits";

export const deleteLogAction = authActionClient
  .inputSchema(logDeleteSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!(await getCar(ctx.userId, parsedInput.carId)))
      throw new ActionError("errors.notFound");
    const deleted = await deleteLog(parsedInput.logId, parsedInput.carId);
    if (!deleted) throw new ActionError("errors.notFound");

    // Last log of a visit gone → remove the now-orphaned visit.
    let removedVisitId: string | null = null;
    if (deleted.visitId) {
      const remaining = await countLogsByVisitId(deleted.visitId, parsedInput.carId);
      if (remaining === 0) {
        await deleteVisit(deleted.visitId, parsedInput.carId);
        removedVisitId = deleted.visitId;
      }
    }
    return { ok: true, removedVisitId };
  });
```

(Note: `setCarMileage` import was only used by `createLogAction` — gone with it.)

- [ ] **Step 3: Shrink the log schema**

`src/lib/schemas/log.ts` becomes:

```ts
import { z } from "zod";
import { objectIdSchema } from "./common";

export const logDeleteSchema = z.object({
  logId: objectIdSchema,
  carId: objectIdSchema,
});
```

- [ ] **Step 4: Remove createLog from the repository**

In `src/lib/repositories/logs.ts`, delete the whole `createLog` function (the single-insert one added back in Task 2's listing — `createLogs`, `countLogsByVisitId`, `deleteLog`, `listLogsByCarIds`, `toLog`, and `LogDoc` all stay).

- [ ] **Step 5: Remove the old schema tests**

In `src/lib/schemas/schemas.test.ts`:
- Remove the import line `import { logInputSchema } from "./log";`
- Remove the entire `describe("log schema", ...)` block (the one testing `logInputSchema` — the `describe("visit schema", ...)` block from Task 1 stays).

- [ ] **Step 6: Remove the now-unused i18n key**

Remove `"logService"` from the `"car"` namespace in BOTH `src/messages/en.json` (`"logService": "Log service",`) and `src/messages/uk.json` (`"logService": "Записати сервіс",`). Do NOT touch `"dashboard.logService"` — the status-card button still uses it.

Confirm nothing references the removed key:

```bash
grep -rn '"car.logService"\|t("logService")' src
```

Expected: no matches (a `car` namespace `t("logService")` only existed in the deleted dialog).

Re-run the key-set parity check from Task 3 Step 3. Expected: `OK`.

- [ ] **Step 7: Verify**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: all pass, no references to `createLogAction`, `logInputSchema`, or `LogServiceDialog` remain:

```bash
grep -rn "createLogAction\|logInputSchema\|LogServiceDialog" src
```

Expected: no matches.

- [ ] **Step 8: Commit**

```bash
git add -A src/actions/logs.ts src/lib/schemas/log.ts src/lib/repositories/logs.ts src/lib/schemas/schemas.test.ts src/messages/en.json src/messages/uk.json
git commit -m "Remove the single-log flow in favor of visits"
```

---

### Task 9: Full verification

- [ ] **Step 1: Run the full required suite**

```bash
npx vitest run
npx tsc --noEmit && npx eslint src
npm run build
```

Expected: everything passes, including the service-worker build (`serwist build`).

- [ ] **Step 2: Fix anything that surfaced, re-run until green, then commit any fixes**

If all green with no changes, nothing to commit.

- [ ] **Step 3: Push and open a PR to main**

```bash
git push -u origin feat/batch-service-logging
gh pr create --title "Batch service logging with visit-level cost" --body "..."
```

(PR body: summarize the spec — visits as the single logging path, total cost per visit, flat history with visit totals. End with the standard generation footer.)

---

## Self-review notes

- **Spec coverage:** visits-only logging (Tasks 5/7/8), shared fields + total cost (Task 5), ₴ plain number (Tasks 1/6), history header trigger + dashboard preselect (Tasks 6/7), flat history + total-once rendering (Task 6), orphan cleanup (Task 4), store/sync (Task 2), i18n both locales (Tasks 3/8), tests (Tasks 1/5), removal of old flow incl. keys and tests (Task 8). Out-of-scope items from the spec have no tasks — correct.
- **Ordering:** old flow keeps compiling until Task 8 because `createLog`/`createLogAction`/`car.logService` are removed only after the dashboard switches (Task 7).
- **Type consistency:** `createLogs({ carId, visitId, componentNames, mileageAtService, dateAtService })` matches between Task 2 and Task 4; `deleteLog` returning `ServiceLog | null` matches Task 4's usage; `removedVisitId` matches Task 6's client handling; store API `addVisit`/`removeVisit` matches Tasks 5/6.
