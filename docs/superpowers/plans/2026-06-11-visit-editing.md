# Visit Editing, Dashboard Auto-Hide & README Demo Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make saved service visits editable (date, mileage, cost, and the set of services — with legacy logs converting to visits on edit), hide never-serviced rules from the dashboard behind a count hint, and add the live demo link to the README.

**Architecture:** A new `updateVisitAction` diff-syncs a visit's logs (delete unchecked, insert newly checked, rewrite kept) and updates the visit doc, addressed by a discriminated `target: {visitId} | {logId}` so a legacy log converts into a single visit on save. A new `EditVisitDialog` (mounted per edit, prefilled) drives it; the store gains one `applyVisitUpdate` mutation that replaces the visit's log set atomically. The dashboard filters status cards to rules with at least one log and shows a muted count link for the rest.

**Tech Stack:** Next.js 16 (Turbopack), next-safe-action (`authActionClient`), MongoDB driver, Zustand (persisted), next-intl, Zod, Vitest + Testing Library, shadcn/ui on Base UI.

**Spec:** `docs/superpowers/specs/2026-06-11-visit-editing-design.md`
**Branch:** `feat/visit-editing` (already checked out — NEVER commit on `main`).

**Codebase notes for the implementer:**
- All user-facing strings are next-intl keys; `src/messages/en.json` and `uk.json` MUST keep identical key sets.
- Server errors are `ActionError("<i18n key>")`, translated client-side via `actionErrorKey` (`src/lib/action-feedback.ts`).
- Repositories: thin untested wrappers, ObjectId↔string at the boundary, everything scoped by `carId` the action verified.
- shadcn/ui is on Base UI (not Radix).
- Run after every task: `npx vitest run` and `npx tsc --noEmit && npx eslint src`. `npm run build` at the end.

---

## File map

| File | Change |
| --- | --- |
| `src/lib/schemas/visit.ts` | Extract shared field schemas; add `visitUpdateSchema` |
| `src/lib/schemas/schemas.test.ts` | Tests for `visitUpdateSchema` |
| `src/lib/repositories/visits.ts` | Add `getVisit`, `updateVisit` |
| `src/lib/repositories/logs.ts` | Add `getLog`, `listLogsByVisitId`, `deleteLogsByVisitIdAndComponents`, `updateLogsByVisitId` |
| `src/stores/garage.ts` | Add `applyVisitUpdate` |
| `src/stores/garage.test.ts` | Tests for `applyVisitUpdate` |
| `src/actions/visits.ts` | Add `updateVisitAction` |
| `src/messages/en.json`, `uk.json` | New keys (editVisit, saveVisit, visitUpdated, hiddenRules) |
| `src/components/cars/edit-visit-dialog.tsx` | **New** — the edit dialog |
| `src/components/cars/edit-visit-dialog.test.tsx` | **New** — component tests |
| `src/components/cars/service-history.tsx` | Pencil button per row, mounts the edit dialog |
| `src/components/dashboard/dashboard.tsx` | Auto-hide never-serviced rules + hint |
| `src/components/dashboard/dashboard.test.tsx` | **New** — auto-hide tests |
| `README.md` | Demo link |

---

### Task 1: visitUpdateSchema (TDD)

**Files:**
- Modify: `src/lib/schemas/visit.ts`
- Modify: `src/lib/schemas/schemas.test.ts`

- [ ] **Step 1: Write the failing tests**

In `src/lib/schemas/schemas.test.ts`, change the visit import line to:

```ts
import { visitInputSchema, visitUpdateSchema } from "./visit";
```

Append at the end of the file:

```ts
describe("visit update schema", () => {
  const valid = {
    carId: oid,
    target: { visitId: oid },
    componentNames: ["Engine oil"],
    mileageAtService: 120000,
    dateAtService: "2026-01-15",
  };

  it("accepts a visit target and a log target", () => {
    expect(visitUpdateSchema.safeParse(valid).success).toBe(true);
    expect(
      visitUpdateSchema.safeParse({ ...valid, target: { logId: oid } }).success,
    ).toBe(true);
  });

  it("rejects a missing or malformed target", () => {
    expect(visitUpdateSchema.safeParse({ ...valid, target: {} }).success).toBe(false);
    expect(
      visitUpdateSchema.safeParse({ ...valid, target: { visitId: "short" } }).success,
    ).toBe(false);
    const { target: _target, ...withoutTarget } = valid;
    expect(visitUpdateSchema.safeParse(withoutTarget).success).toBe(false);
  });

  it("applies the shared field rules", () => {
    expect(
      visitUpdateSchema.safeParse({ ...valid, componentNames: [] }).success,
    ).toBe(false);
    expect(
      visitUpdateSchema.safeParse({ ...valid, totalCost: -1 }).success,
    ).toBe(false);
    expect(
      visitUpdateSchema.safeParse({ ...valid, totalCost: 2500 }).success,
    ).toBe(true);
    const future = new Date(Date.now() + 7 * 86_400_000).toISOString();
    expect(
      visitUpdateSchema.safeParse({ ...valid, dateAtService: future }).success,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/schemas/schemas.test.ts`
Expected: FAIL — `visitUpdateSchema` is not exported.

- [ ] **Step 3: Implement**

Rewrite `src/lib/schemas/visit.ts` as (extracts the shared fields so input/update stay in sync):

```ts
import { z } from "zod";
import { mileageSchema, objectIdSchema } from "./common";

// +1 day tolerance so "today" in any client timezone is accepted.
const notInFuture = (d: Date) => d.getTime() <= Date.now() + 86_400_000;

const visitFields = {
  componentNames: z
    .array(z.string().trim().min(1, "validation.componentRequired").max(100))
    .min(1, "validation.componentsRequired")
    .max(100),
  mileageAtService: mileageSchema,
  dateAtService: z.coerce.date().refine(notInFuture, "validation.dateFuture"),
  totalCost: z
    .number("validation.costInvalid")
    .min(0, "validation.costInvalid")
    .max(99_999_999, "validation.costInvalid")
    .optional(),
};

export const visitInputSchema = z.object({
  carId: objectIdSchema,
  ...visitFields,
});

export const visitUpdateSchema = z.object({
  carId: objectIdSchema,
  // An existing visit, or a legacy (pre-visit) log converted on save.
  target: z.union([
    z.object({ visitId: objectIdSchema }),
    z.object({ logId: objectIdSchema }),
  ]),
  ...visitFields,
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/schemas/schemas.test.ts`
Expected: PASS (all blocks, including the pre-existing visit schema block — the refactor must not change `visitInputSchema` behavior).

- [ ] **Step 5: Verify types/lint, commit**

Run: `npx tsc --noEmit && npx eslint src`

```bash
git add src/lib/schemas/visit.ts src/lib/schemas/schemas.test.ts
git commit -m "Add visit update schema with visit/log target union"
```

---

### Task 2: Repository additions + store applyVisitUpdate (store TDD)

Repositories are deliberately untested (project convention); the store mutation gets a unit test.

**Files:**
- Modify: `src/lib/repositories/visits.ts`
- Modify: `src/lib/repositories/logs.ts`
- Modify: `src/stores/garage.ts`
- Modify: `src/stores/garage.test.ts`

- [ ] **Step 1: Write the failing store test**

Append inside the existing `describe("garage store", ...)` block in `src/stores/garage.test.ts` (before its closing `});`):

```ts
  it("applyVisitUpdate upserts the visit, replaces its logs, and drops a converted legacy log", () => {
    const visit = {
      id: "v1",
      carId: "a",
      mileageAtService: 5000,
      dateAtService: "2026-02-01T00:00:00.000Z",
      totalCost: 900,
    };
    const log = (id: string, componentName: string, visitId?: string) => ({
      id,
      carId: "a",
      componentName,
      mileageAtService: 5000,
      dateAtService: "2026-02-01T00:00:00.000Z",
      ...(visitId && { visitId }),
    });
    useGarageStore.setState({
      visits: [{ ...visit, totalCost: 100 }],
      logs: [log("stale1", "Oil", "v1"), log("legacy", "Brakes"), log("other", "Coolant", "v9")],
    });

    useGarageStore
      .getState()
      .applyVisitUpdate(visit, [log("new1", "Oil", "v1"), log("new2", "Brakes", "v1")], "legacy");

    const s = useGarageStore.getState();
    expect(s.visits).toEqual([visit]);
    expect(s.logs.map((l) => l.id).sort()).toEqual(["new1", "new2", "other"]);
  });

  it("applyVisitUpdate inserts a visit it has not seen before", () => {
    useGarageStore.setState({ visits: [], logs: [] });
    const visit = {
      id: "v2",
      carId: "a",
      mileageAtService: 1,
      dateAtService: "2026-02-01T00:00:00.000Z",
    };
    useGarageStore.getState().applyVisitUpdate(visit, [], undefined);
    expect(useGarageStore.getState().visits).toEqual([visit]);
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/stores/garage.test.ts`
Expected: FAIL — `applyVisitUpdate` is not a function.

- [ ] **Step 3: Add the store mutation**

In `src/stores/garage.ts`, in the `GarageState` interface after `removeVisit: (visitId: string) => void;` add:

```ts
  applyVisitUpdate: (
    visit: ServiceVisit,
    visitLogs: ServiceLog[],
    removeLogId?: string,
  ) => void;
```

In the implementation after `removeVisit`, add:

```ts
      // Server result is authoritative for an edited visit: swap the visit in,
      // replace every log carrying its id, and drop a converted legacy log.
      applyVisitUpdate: (visit, visitLogs, removeLogId) =>
        set((s) => ({
          visits: s.visits.some((v) => v.id === visit.id)
            ? s.visits.map((v) => (v.id === visit.id ? visit : v))
            : [visit, ...s.visits],
          logs: [
            ...visitLogs,
            ...s.logs.filter((l) => l.visitId !== visit.id && l.id !== removeLogId),
          ],
        })),
```

- [ ] **Step 4: Run store tests to verify they pass**

Run: `npx vitest run src/stores/garage.test.ts`
Expected: PASS.

- [ ] **Step 5: Add visit repository functions**

In `src/lib/repositories/visits.ts`, append:

```ts
export async function getVisit(visitId: string, carId: string): Promise<ServiceVisit | null> {
  const doc = await visits().findOne({
    _id: new ObjectId(visitId),
    carId: new ObjectId(carId),
  });
  return doc ? toVisit(doc) : null;
}

export async function updateVisit(input: {
  visitId: string;
  carId: string;
  mileageAtService: number;
  dateAtService: Date;
  totalCost?: number;
}): Promise<ServiceVisit | null> {
  const doc = await visits().findOneAndUpdate(
    { _id: new ObjectId(input.visitId), carId: new ObjectId(input.carId) },
    {
      $set: {
        mileageAtService: input.mileageAtService,
        dateAtService: input.dateAtService,
        ...(input.totalCost !== undefined && { totalCost: input.totalCost }),
      },
      // Clearing the cost field in the form clears the stored cost.
      ...(input.totalCost === undefined && { $unset: { totalCost: "" } }),
    },
    { returnDocument: "after" },
  );
  return doc ? toVisit(doc) : null;
}
```

- [ ] **Step 6: Add log repository functions**

In `src/lib/repositories/logs.ts`, append:

```ts
export async function getLog(logId: string, carId: string): Promise<ServiceLog | null> {
  const doc = await logs().findOne({
    _id: new ObjectId(logId),
    carId: new ObjectId(carId),
  });
  return doc ? toLog(doc) : null;
}

export async function listLogsByVisitId(visitId: string, carId: string): Promise<ServiceLog[]> {
  const docs = await logs()
    .find({ visitId: new ObjectId(visitId), carId: new ObjectId(carId) })
    .toArray();
  return docs.map(toLog);
}

export async function deleteLogsByVisitIdAndComponents(
  visitId: string,
  carId: string,
  componentNames: string[],
): Promise<number> {
  if (componentNames.length === 0) return 0;
  const result = await logs().deleteMany({
    visitId: new ObjectId(visitId),
    carId: new ObjectId(carId),
    componentName: { $in: componentNames },
  });
  return result.deletedCount;
}

export async function updateLogsByVisitId(
  visitId: string,
  carId: string,
  update: { mileageAtService: number; dateAtService: Date },
): Promise<number> {
  const result = await logs().updateMany(
    { visitId: new ObjectId(visitId), carId: new ObjectId(carId) },
    { $set: { mileageAtService: update.mileageAtService, dateAtService: update.dateAtService } },
  );
  return result.modifiedCount;
}
```

- [ ] **Step 7: Verify and commit**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: all pass.

```bash
git add src/lib/repositories/visits.ts src/lib/repositories/logs.ts src/stores/garage.ts src/stores/garage.test.ts
git commit -m "Add visit/log repository updates and applyVisitUpdate store mutation"
```

---

### Task 3: updateVisitAction

**Files:**
- Modify: `src/actions/visits.ts`

Actions follow the project convention of being exercised through component tests with mocked actions (Task 5) plus `tsc`.

- [ ] **Step 1: Add the action**

In `src/actions/visits.ts`, update imports to:

```ts
import { ActionError, authActionClient } from "@/lib/safe-action";
import { visitInputSchema, visitUpdateSchema } from "@/lib/schemas/visit";
import { getCar, setCarMileage } from "@/lib/repositories/cars";
import { listRulesByCarIds } from "@/lib/repositories/rules";
import {
  createLogs,
  deleteLog,
  deleteLogsByVisitIdAndComponents,
  getLog,
  listLogsByVisitId,
  updateLogsByVisitId,
} from "@/lib/repositories/logs";
import {
  createVisit,
  deleteVisit,
  getVisit,
  updateVisit,
} from "@/lib/repositories/visits";
import type { ServiceLog, ServiceVisit } from "@/lib/types";
```

`createVisitAction` stays untouched. Append:

```ts
export const updateVisitAction = authActionClient
  .inputSchema(visitUpdateSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { carId, target } = parsedInput;
    const car = await getCar(ctx.userId, carId);
    if (!car) throw new ActionError("errors.notFound");

    // Resolve the target: an existing visit, or a legacy log converted on save.
    let existingLogs: ServiceLog[];
    let convertedLog: ServiceLog | null = null;
    if ("visitId" in target) {
      if (!(await getVisit(target.visitId, carId)))
        throw new ActionError("errors.notFound");
      existingLogs = await listLogsByVisitId(target.visitId, carId);
    } else {
      const log = await getLog(target.logId, carId);
      // Visit-backed rows must be edited through their visit.
      if (!log || log.visitId) throw new ActionError("errors.notFound");
      convertedLog = log;
      existingLogs = [];
    }

    // Selected components must come from the car's rules or the entry being edited.
    const rules = await listRulesByCarIds([carId]);
    const allowed = new Set([
      ...rules.map((r) => r.componentName),
      ...existingLogs.map((l) => l.componentName),
      ...(convertedLog ? [convertedLog.componentName] : []),
    ]);
    if (!parsedInput.componentNames.every((name) => allowed.has(name)))
      throw new ActionError("errors.notFound");
    const componentNames = [...new Set(parsedInput.componentNames)];

    // Apply to the visit doc (create it when converting a legacy log).
    let visit: ServiceVisit;
    if (convertedLog) {
      visit = await createVisit({
        carId,
        mileageAtService: parsedInput.mileageAtService,
        dateAtService: parsedInput.dateAtService,
        ...(parsedInput.totalCost !== undefined && { totalCost: parsedInput.totalCost }),
      });
    } else {
      const updated = await updateVisit({
        visitId: (target as { visitId: string }).visitId,
        carId,
        mileageAtService: parsedInput.mileageAtService,
        dateAtService: parsedInput.dateAtService,
        ...(parsedInput.totalCost !== undefined && { totalCost: parsedInput.totalCost }),
      });
      if (!updated) throw new ActionError("errors.notFound");
      visit = updated;
    }

    // Diff-sync the visit's logs against the selection.
    const existingNames = new Set(existingLogs.map((l) => l.componentName));
    const toDelete = existingLogs
      .filter((l) => !componentNames.includes(l.componentName))
      .map((l) => l.componentName);
    const toInsert = componentNames.filter((name) => !existingNames.has(name));

    await deleteLogsByVisitIdAndComponents(visit.id, carId, toDelete);
    await updateLogsByVisitId(visit.id, carId, {
      mileageAtService: parsedInput.mileageAtService,
      dateAtService: parsedInput.dateAtService,
    });
    await createLogs({
      carId,
      visitId: visit.id,
      componentNames: toInsert,
      mileageAtService: parsedInput.mileageAtService,
      dateAtService: parsedInput.dateAtService,
    });
    // Converting a legacy log: remove the original last, so a mid-flight
    // failure leaves the source row intact (accepted non-transactional stance).
    if (convertedLog) await deleteLog(convertedLog.id, carId);

    const logs = await listLogsByVisitId(visit.id, carId);

    // Spec: a service at a higher mileage raises the car's current mileage.
    let newCarMileage: number | null = null;
    if (parsedInput.mileageAtService > car.currentMileage) {
      await setCarMileage(ctx.userId, carId, parsedInput.mileageAtService);
      newCarMileage = parsedInput.mileageAtService;
    }

    return { visit, logs, newCarMileage };
  });
```

- [ ] **Step 2: Verify and commit**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: all pass.

```bash
git add src/actions/visits.ts
git commit -m "Add updateVisitAction with diff-sync and legacy log conversion"
```

---

### Task 4: i18n keys

**Files:**
- Modify: `src/messages/en.json`, `src/messages/uk.json`

- [ ] **Step 1: English.** In `src/messages/en.json`, inside `"car"` after `"visitTotal"`, add:

```json
    "editVisit": "Edit service entry",
    "saveVisit": "Save changes ({count})",
    "visitUpdated": "Entry updated"
```

Inside `"dashboard"` after `"statusOverdue"`, add:

```json
    "hiddenRules": "{count, plural, one {# item} other {# items}} not serviced yet"
```

- [ ] **Step 2: Ukrainian.** In `src/messages/uk.json`, inside `"car"` after `"visitTotal"`, add:

```json
    "editVisit": "Редагувати запис",
    "saveVisit": "Зберегти зміни ({count})",
    "visitUpdated": "Запис оновлено"
```

Inside `"dashboard"` after `"statusOverdue"`, add:

```json
    "hiddenRules": "{count, plural, one {# компонент ще не обслуговувався} few {# компоненти ще не обслуговувалися} many {# компонентів ще не обслуговувалися} other {# компонента ще не обслуговувалося}}"
```

- [ ] **Step 3: Verify parity and commit**

```bash
node -e "
const en = require('./src/messages/en.json'), uk = require('./src/messages/uk.json');
const keys = (o, p='') => Object.entries(o).flatMap(([k,v]) => typeof v === 'object' ? keys(v, p+k+'.') : [p+k]);
const a = new Set(keys(en)), b = new Set(keys(uk));
const diff = [...a].filter(k => !b.has(k)).concat([...b].filter(k => !a.has(k)));
console.log(diff.length ? 'MISMATCH: ' + diff.join(', ') : 'OK');
"
```

Expected: `OK`. Then `npx vitest run && npx tsc --noEmit && npx eslint src`, then:

```bash
git add src/messages/en.json src/messages/uk.json
git commit -m "Add i18n keys for visit editing and dashboard hint"
```

Note: `dashboard.neverServiced` stays — `status-card.tsx:65` still references it as a fallback.

---

### Task 5: EditVisitDialog (TDD)

**Files:**
- Create: `src/components/cars/edit-visit-dialog.test.tsx`
- Create: `src/components/cars/edit-visit-dialog.tsx`

The dialog is **mounted fresh per edit** (conditional render by the parent), so prefill uses `defaultValue` and there is no reset logic. Props: `{ car, editedLog, onOpenChange }`; `open` is always true while mounted.

- [ ] **Step 1: Write the failing tests**

Create `src/components/cars/edit-visit-dialog.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import { useGarageStore } from "@/stores/garage";
import type { ServiceLog } from "@/lib/types";

// vi.mock factories are hoisted above imports — anything they capture
// must come from vi.hoisted, or it is "accessed before initialization".
const { updateVisit } = vi.hoisted(() => ({
  updateVisit: vi.fn(),
}));

vi.mock("@/actions/visits", () => ({
  updateVisitAction: updateVisit,
}));

import { EditVisitDialog } from "./edit-visit-dialog";

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
const visit = {
  id: "v1",
  carId,
  mileageAtService: 110000,
  dateAtService: "2026-03-05T00:00:00.000Z",
  totalCost: 800,
};
const visitLog: ServiceLog = {
  id: "l1",
  carId,
  componentName: "Engine oil",
  mileageAtService: 110000,
  dateAtService: "2026-03-05T00:00:00.000Z",
  visitId: "v1",
};
const legacyLog: ServiceLog = {
  id: "l9",
  carId,
  componentName: "Brake fluid",
  mileageAtService: 90000,
  dateAtService: "2025-11-20T00:00:00.000Z",
};

afterEach(cleanup);
beforeEach(() => {
  updateVisit.mockReset();
  useGarageStore.setState({
    cars: [car],
    rules,
    logs: [visitLog, legacyLog],
    visits: [visit],
    selectedCarId: carId,
  });
});

function renderDialog(editedLog: ServiceLog) {
  const onOpenChange = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <EditVisitDialog car={car} editedLog={editedLog} onOpenChange={onOpenChange} />
    </NextIntlClientProvider>,
  );
  return onOpenChange;
}

describe("EditVisitDialog", () => {
  it("prefills from the visit: components checked, date/mileage/cost filled", () => {
    renderDialog(visitLog);
    expect(screen.getByRole("checkbox", { name: "Engine oil" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Air filter" })).not.toBeChecked();
    expect(screen.getByLabelText("Mileage at service (km)")).toHaveValue(110000);
    expect(screen.getByLabelText("Service date")).toHaveValue("2026-03-05");
    expect(screen.getByLabelText(/Total cost/)).toHaveValue(800);
    expect(screen.getByRole("button", { name: "Save changes (1)" })).toBeEnabled();
  });

  it("prefills from a legacy log and lists its component even without a rule", () => {
    renderDialog(legacyLog);
    expect(screen.getByRole("checkbox", { name: "Brake fluid" })).toBeChecked();
    expect(screen.getByLabelText("Mileage at service (km)")).toHaveValue(90000);
    expect(screen.getByLabelText("Service date")).toHaveValue("2025-11-20");
    expect(screen.getByLabelText(/Total cost/)).toHaveValue(null);
  });

  it("submits a visit target with the edited selection and applies the result", async () => {
    const updatedVisit = { ...visit, mileageAtService: 111000, totalCost: 950 };
    const newLogs = [
      { ...visitLog, mileageAtService: 111000 },
      {
        id: "l2",
        carId,
        componentName: "Air filter",
        mileageAtService: 111000,
        dateAtService: "2026-03-05T00:00:00.000Z",
        visitId: "v1",
      },
    ];
    updateVisit.mockResolvedValue({
      data: { visit: updatedVisit, logs: newLogs, newCarMileage: null },
    });

    const onOpenChange = renderDialog(visitLog);
    fireEvent.click(screen.getByRole("checkbox", { name: "Air filter" }));
    fireEvent.change(screen.getByLabelText("Mileage at service (km)"), {
      target: { value: "111000" },
    });
    fireEvent.change(screen.getByLabelText(/Total cost/), { target: { value: "950" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes (2)" }));

    await vi.waitFor(() =>
      expect(updateVisit).toHaveBeenCalledWith(
        expect.objectContaining({
          carId,
          target: { visitId: "v1" },
          componentNames: ["Engine oil", "Air filter"],
          mileageAtService: 111000,
          totalCost: 950,
        }),
      ),
    );
    await vi.waitFor(() =>
      expect(useGarageStore.getState().visits).toEqual([updatedVisit]),
    );
    expect(useGarageStore.getState().logs.map((l) => l.id).sort()).toEqual([
      "l1",
      "l2",
      "l9",
    ]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("submits a log target for a legacy row and removes the converted log", async () => {
    const newVisit = {
      id: "v2",
      carId,
      mileageAtService: 90000,
      dateAtService: "2025-11-20T00:00:00.000Z",
    };
    const newLogs = [{ ...legacyLog, id: "l10", visitId: "v2" }];
    updateVisit.mockResolvedValue({
      data: { visit: newVisit, logs: newLogs, newCarMileage: null },
    });

    renderDialog(legacyLog);
    fireEvent.click(screen.getByRole("button", { name: "Save changes (1)" }));

    await vi.waitFor(() =>
      expect(updateVisit).toHaveBeenCalledWith(
        expect.objectContaining({
          target: { logId: "l9" },
          componentNames: ["Brake fluid"],
        }),
      ),
    );
    expect(updateVisit.mock.calls[0][0]).not.toHaveProperty("totalCost");
    await vi.waitFor(() =>
      expect(useGarageStore.getState().logs.map((l) => l.id).sort()).toEqual([
        "l1",
        "l10",
      ]),
    );
  });

  it("submits without totalCost when the prefilled cost is cleared", async () => {
    updateVisit.mockResolvedValue({
      data: { visit: { ...visit, totalCost: undefined }, logs: [visitLog], newCarMileage: null },
    });
    renderDialog(visitLog);
    fireEvent.change(screen.getByLabelText(/Total cost/), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes (1)" }));
    await vi.waitFor(() => expect(updateVisit).toHaveBeenCalled());
    expect(updateVisit.mock.calls[0][0]).not.toHaveProperty("totalCost");
  });

  it("keeps the store unchanged and stays open on failure", async () => {
    updateVisit.mockResolvedValue({ serverError: "errors.notFound" });
    const onOpenChange = renderDialog(visitLog);
    fireEvent.click(screen.getByRole("button", { name: "Save changes (1)" }));
    await vi.waitFor(() => expect(updateVisit).toHaveBeenCalled());
    expect(useGarageStore.getState().visits).toEqual([visit]);
    expect(useGarageStore.getState().logs).toEqual([visitLog, legacyLog]);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/cars/edit-visit-dialog.test.tsx`
Expected: FAIL — cannot resolve `./edit-visit-dialog`.

- [ ] **Step 3: Implement**

Create `src/components/cars/edit-visit-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { updateVisitAction } from "@/actions/visits";
import { actionErrorKey } from "@/lib/action-feedback";
import { useGarageStore } from "@/stores/garage";
import type { Car, ServiceLog } from "@/lib/types";
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

// Mounted fresh per edit (parent renders it conditionally), so all prefill
// can use defaultValue and the checked map needs no reset logic.
export function EditVisitDialog({
  car,
  editedLog,
  onOpenChange,
}: {
  car: Car;
  editedLog: ServiceLog;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations();
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const store = useGarageStore();
  const visit = useGarageStore((s) => s.visits).find((v) => v.id === editedLog.visitId);
  const currentComponents = useGarageStore((s) => s.logs)
    .filter((l) => editedLog.visitId && l.visitId === editedLog.visitId)
    .map((l) => l.componentName);
  if (currentComponents.length === 0) currentComponents.push(editedLog.componentName);

  const ruleNames = useGarageStore((s) => s.rules)
    .filter((r) => r.carId === car.id)
    .map((r) => r.componentName);
  // A component whose rule was deleted can still be kept or removed.
  const listedNames = [
    ...ruleNames,
    ...currentComponents.filter((name) => !ruleNames.includes(name)),
  ];

  const isChecked = (name: string) => checked[name] ?? currentComponents.includes(name);
  const selected = listedNames.filter(isChecked);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const mileage = Number(data.get("mileage"));
    const date = String(data.get("date"));
    const cost = String(data.get("cost") ?? "").trim();

    setBusy(true);
    try {
      const result = await updateVisitAction({
        carId: car.id,
        target: editedLog.visitId
          ? { visitId: editedLog.visitId }
          : { logId: editedLog.id },
        componentNames: selected,
        mileageAtService: mileage,
        dateAtService: new Date(date),
        ...(cost !== "" && { totalCost: Number(cost) }),
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
        onOpenChange(false);
      }
    } finally {
      setBusy(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const initialDate = (visit?.dateAtService ?? editedLog.dateAtService).slice(0, 10);
  const initialMileage = visit?.mileageAtService ?? editedLog.mileageAtService;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("car.editVisit")}</DialogTitle>
          <DialogDescription>{t("car.logVisitDescription")}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="max-h-[40vh] space-y-1 overflow-y-auto">
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
            <Label htmlFor="edit-visit-mileage">{t("car.serviceMileage")}</Label>
            <Input
              id="edit-visit-mileage"
              name="mileage"
              type="number"
              inputMode="numeric"
              min={0}
              defaultValue={initialMileage}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-visit-date">{t("car.serviceDate")}</Label>
            <Input
              id="edit-visit-date"
              name="date"
              type="date"
              max={today}
              defaultValue={initialDate}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-visit-cost">{t("car.totalCost")}</Label>
            <Input
              id="edit-visit-cost"
              name="cost"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              defaultValue={visit?.totalCost ?? ""}
            />
          </div>
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={busy || selected.length === 0}
          >
            {t("car.saveVisit", { count: selected.length })}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/cars/edit-visit-dialog.test.tsx`
Expected: PASS (6 tests). Then the full gates: `npx vitest run && npx tsc --noEmit && npx eslint src`.

- [ ] **Step 5: Commit**

```bash
git add src/components/cars/edit-visit-dialog.tsx src/components/cars/edit-visit-dialog.test.tsx
git commit -m "Add EditVisitDialog with legacy log conversion"
```

---

### Task 6: Service history — pencil button wiring

**Files:**
- Modify: `src/components/cars/service-history.tsx`

- [ ] **Step 1: Wire the edit dialog**

In `src/components/cars/service-history.tsx`:

1. Extend the lucide import: `import { ClipboardList, Pencil, Trash2 } from "lucide-react";`
2. Add the dialog import: `import { EditVisitDialog } from "./edit-visit-dialog";`
3. Add state next to `logOpen`:

```tsx
  const [editing, setEditing] = useState<ServiceLog | null>(null);
```

4. In the row JSX, add a pencil button before the existing delete button (wrap both in the existing flex container — the delete `Button` is currently the only sibling of the text `div`; put the two buttons in a `div className="flex gap-1"` exactly like `rule-list.tsx` does):

```tsx
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("common.edit")}
                  onClick={() => setEditing(log)}
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
```

5. Mount the dialog next to the existing `LogVisitDialog` line at the bottom:

```tsx
      {car && editing && (
        <EditVisitDialog
          car={car}
          editedLog={editing}
          onOpenChange={(open) => !open && setEditing(null)}
        />
      )}
```

- [ ] **Step 2: Verify and commit**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: all pass.

```bash
git add src/components/cars/service-history.tsx
git commit -m "Add edit entry point to service history rows"
```

---

### Task 7: Dashboard auto-hide (TDD)

**Files:**
- Create: `src/components/dashboard/dashboard.test.tsx`
- Modify: `src/components/dashboard/dashboard.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/dashboard/dashboard.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import { useGarageStore } from "@/stores/garage";

// vi.mock factories are hoisted above imports — anything they capture
// must come from vi.hoisted, or it is "accessed before initialization".
const { updateMileage, createVisit } = vi.hoisted(() => ({
  updateMileage: vi.fn(),
  createVisit: vi.fn(),
}));

vi.mock("@/actions/cars", () => ({
  updateCarMileageAction: updateMileage,
}));
vi.mock("@/actions/visits", () => ({
  createVisitAction: createVisit,
}));

import { Dashboard } from "./dashboard";

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
  { id: "r3", carId, componentName: "Coolant", intervalKm: 40000 },
];
const oilLog = {
  id: "l1",
  carId,
  componentName: "Engine oil",
  mileageAtService: 115000,
  dateAtService: "2026-05-01T00:00:00.000Z",
};

afterEach(cleanup);
beforeEach(() => {
  useGarageStore.setState({
    cars: [car],
    rules,
    logs: [oilLog],
    visits: [],
    selectedCarId: carId,
    hasHydrated: true,
  });
});

function renderDashboard() {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <Dashboard />
    </NextIntlClientProvider>,
  );
}

describe("Dashboard auto-hide", () => {
  it("shows cards only for serviced rules and a hint for the rest", () => {
    renderDashboard();
    expect(screen.getByText("Engine oil")).toBeInTheDocument();
    expect(screen.queryByText("Air filter")).not.toBeInTheDocument();
    expect(screen.queryByText("Coolant")).not.toBeInTheDocument();
    const hint = screen.getByRole("link", { name: "2 items not serviced yet" });
    expect(hint).toHaveAttribute("href", `/cars/${carId}`);
  });

  it("shows only the hint when nothing is serviced yet", () => {
    useGarageStore.setState({ logs: [] });
    renderDashboard();
    expect(screen.queryByText("Engine oil")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "3 items not serviced yet" }),
    ).toBeInTheDocument();
  });

  it("shows no hint when every rule is serviced", () => {
    useGarageStore.setState({
      logs: rules.map((r, i) => ({
        id: `log-${i}`,
        carId,
        componentName: r.componentName,
        mileageAtService: 115000,
        dateAtService: "2026-05-01T00:00:00.000Z",
      })),
    });
    renderDashboard();
    expect(screen.getByText("Coolant")).toBeInTheDocument();
    expect(screen.queryByText(/not serviced yet/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/dashboard/dashboard.test.tsx`
Expected: FAIL — "Air filter"/"Coolant" cards render and no hint link exists (current behavior shows every rule).

- [ ] **Step 3: Implement the filter**

In `src/components/dashboard/dashboard.tsx`, after the `const carRules = ...` line add:

```tsx
  // Never-serviced rules are hidden from the dashboard to keep it focused;
  // the hint below links to the car page where first services get logged.
  const servicedRules = carRules.filter(
    (rule) => latestLogFor(logs, car.id, rule.componentName) !== null,
  );
  const hiddenCount = carRules.length - servicedRules.length;
```

Replace the rules block of the JSX (the `carRules.length === 0 ? ... : ...` ternary) with:

```tsx
      {carRules.length === 0 ? (
        <div className="space-y-2 py-8 text-center text-muted-foreground">
          <p>{t("noRules")}</p>
          <Link href={`/cars/${car.id}`} className="underline">
            {t("addRulesHint")}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
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
          {hiddenCount > 0 && (
            <p className="text-center text-sm text-muted-foreground">
              <Link href={`/cars/${car.id}`} className="underline">
                {t("hiddenRules", { count: hiddenCount })}
              </Link>
            </p>
          )}
        </div>
      )}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/dashboard/dashboard.test.tsx`
Expected: PASS (3 tests). Then full gates: `npx vitest run && npx tsc --noEmit && npx eslint src`.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/dashboard.tsx src/components/dashboard/dashboard.test.tsx
git commit -m "Hide never-serviced rules from the dashboard behind a count hint"
```

---

### Task 8: README demo link

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add the link.** After the intro paragraph (the line ending `multi-user, multi-vehicle, EN/UK.`) insert a blank line and:

```md
**Demo:** <https://car-service-tracker-flame.vercel.app/>
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Link the live demo in the README"
```

---

### Task 9: Full verification + PR

- [ ] **Step 1: Run the full required suite**

```bash
npx vitest run
npx tsc --noEmit && npx eslint src
npm run build
```

Expected: everything passes, including the service-worker build.

- [ ] **Step 2: Fix anything that surfaced, re-run until green**

- [ ] **Step 3: Push and open a PR to main**

```bash
git push -u origin feat/visit-editing
gh pr create --title "Visit editing, dashboard auto-hide, README demo link" --body "..."
```

(PR body: summarize the spec — edit dialog with diff-sync and legacy conversion, dashboard hides never-serviced rules behind a count hint, demo link. End with the standard generation footer.)

---

## Self-review notes

- **Spec coverage:** editor UI + prefill (Task 5), pencil entry point (Task 6), diff-sync action with target union, cost unset, mileage raise-only, rule∪current validation (Tasks 1–3), store `applyVisitUpdate` (Task 2), dashboard auto-hide + hint + all-unserviced case (Task 7), README (Task 8), i18n both locales incl. keeping `dashboard.neverServiced` (Task 4), tests per spec (Tasks 1, 2, 5, 7). Out-of-scope items have no tasks — correct.
- **Type consistency:** `applyVisitUpdate(visit, visitLogs, removeLogId?)` matches Tasks 2/5; `updateVisit` returning `ServiceVisit | null` matches Task 3; `target: {visitId}|{logId}` matches Tasks 1/3/5; repo signatures in Task 2 match every call in Task 3.
- **Ordering:** schema → repos/store → action → i18n → dialog (mocks the action, needs i18n keys) → wiring → dashboard → README. Each task leaves the suite green.
