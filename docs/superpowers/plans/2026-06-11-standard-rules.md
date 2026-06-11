# Standard Maintenance Rules Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users add a curated set of 14 standard maintenance rules (oil, filters, brakes, timing belt…) to a car from a picker dialog instead of creating each rule manually.

**Architecture:** A pure constant (`STANDARD_RULES`) defines keys + intervals; names live in i18n catalogs (`standardRules.*`). A new `addStandardRulesAction` resolves names server-side for the request locale, skips case-insensitive duplicates against the car's existing rules, and bulk-inserts via a new `createRules` repository function. A new `StandardRulesDialog` (Base-UI shadcn Dialog, native checkboxes) is triggered from the rules section, follows the existing direct-action-call + `actionErrorKey` + Zustand garage-store pattern.

**Tech Stack:** Next.js 16, next-intl, next-safe-action (`authActionClient`), Zod v4, MongoDB driver, Zustand, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-11-standard-rules-design.md`

**Branch:** `feature/standard-rules` (never commit on `main`).

---

### Task 1: `STANDARD_RULES` constant + i18n names

**Files:**
- Create: `src/lib/standard-rules.ts`
- Modify: `src/messages/en.json` (new top-level `standardRules` section)
- Modify: `src/messages/uk.json` (same keys)
- Test: `src/lib/standard-rules.test.ts`

- [ ] **Step 1.1: Write the failing test**

Create `src/lib/standard-rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { STANDARD_RULES, STANDARD_RULE_KEYS } from "./standard-rules";
import en from "@/messages/en.json";
import uk from "@/messages/uk.json";

describe("STANDARD_RULES", () => {
  it("has unique keys matching STANDARD_RULE_KEYS exactly", () => {
    const keys = STANDARD_RULES.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual([...STANDARD_RULE_KEYS].sort());
  });

  it("every rule has at least one interval within schema bounds", () => {
    for (const r of STANDARD_RULES) {
      expect(r.intervalKm !== undefined || r.intervalMonths !== undefined).toBe(true);
      if (r.intervalKm !== undefined) {
        expect(r.intervalKm).toBeGreaterThanOrEqual(1);
        expect(r.intervalKm).toBeLessThanOrEqual(1_000_000);
      }
      if (r.intervalMonths !== undefined) {
        expect(r.intervalMonths).toBeGreaterThanOrEqual(1);
        expect(r.intervalMonths).toBeLessThanOrEqual(600);
      }
    }
  });

  it("en and uk catalogs name every standard rule (and nothing else)", () => {
    for (const catalog of [en, uk]) {
      const names = (catalog as { standardRules: Record<string, string> }).standardRules;
      expect(Object.keys(names).sort()).toEqual([...STANDARD_RULE_KEYS].sort());
      for (const key of STANDARD_RULE_KEYS) {
        expect(names[key].length).toBeGreaterThan(0);
      }
    }
  });
});
```

- [ ] **Step 1.2: Run the test to verify it fails**

Run: `npx vitest run src/lib/standard-rules.test.ts`
Expected: FAIL — cannot resolve `./standard-rules`.

- [ ] **Step 1.3: Create the constant**

Create `src/lib/standard-rules.ts`:

```ts
export const STANDARD_RULE_KEYS = [
  "engineOil",
  "airFilter",
  "cabinFilter",
  "fuelFilter",
  "sparkPlugs",
  "brakePadsFront",
  "brakePadsRear",
  "brakeDiscsFront",
  "brakeDiscsRear",
  "brakeFluid",
  "timingBelt",
  "coolant",
  "transmissionOil",
  "battery",
] as const;

export type StandardRuleKey = (typeof STANDARD_RULE_KEYS)[number];

export interface StandardRule {
  key: StandardRuleKey;
  intervalKm?: number;
  intervalMonths?: number;
}

/** Conservative defaults; users edit the created rules like any other rule. */
export const STANDARD_RULES: readonly StandardRule[] = [
  { key: "engineOil", intervalKm: 10_000, intervalMonths: 12 },
  { key: "airFilter", intervalKm: 30_000, intervalMonths: 24 },
  { key: "cabinFilter", intervalKm: 15_000, intervalMonths: 12 },
  { key: "fuelFilter", intervalKm: 30_000 },
  { key: "sparkPlugs", intervalKm: 60_000 },
  { key: "brakePadsFront", intervalKm: 40_000 },
  { key: "brakePadsRear", intervalKm: 60_000 },
  { key: "brakeDiscsFront", intervalKm: 80_000 },
  { key: "brakeDiscsRear", intervalKm: 100_000 },
  { key: "brakeFluid", intervalKm: 40_000, intervalMonths: 24 },
  { key: "timingBelt", intervalKm: 90_000, intervalMonths: 60 },
  { key: "coolant", intervalKm: 60_000, intervalMonths: 48 },
  { key: "transmissionOil", intervalKm: 60_000 },
  { key: "battery", intervalMonths: 60 },
];
```

- [ ] **Step 1.4: Add i18n names**

In `src/messages/en.json`, add a new top-level section after `"car"` (keep valid JSON commas):

```json
"standardRules": {
  "engineOil": "Engine oil & oil filter",
  "airFilter": "Air filter",
  "cabinFilter": "Cabin filter",
  "fuelFilter": "Fuel filter",
  "sparkPlugs": "Spark plugs",
  "brakePadsFront": "Brake pads (front)",
  "brakePadsRear": "Brake pads (rear)",
  "brakeDiscsFront": "Brake discs (front)",
  "brakeDiscsRear": "Brake discs (rear)",
  "brakeFluid": "Brake fluid",
  "timingBelt": "Timing belt",
  "coolant": "Coolant (antifreeze)",
  "transmissionOil": "Transmission oil",
  "battery": "Battery"
}
```

In `src/messages/uk.json`, same position, same keys:

```json
"standardRules": {
  "engineOil": "Моторна олива та масляний фільтр",
  "airFilter": "Повітряний фільтр",
  "cabinFilter": "Салонний фільтр",
  "fuelFilter": "Паливний фільтр",
  "sparkPlugs": "Свічки запалювання",
  "brakePadsFront": "Гальмівні колодки (передні)",
  "brakePadsRear": "Гальмівні колодки (задні)",
  "brakeDiscsFront": "Гальмівні диски (передні)",
  "brakeDiscsRear": "Гальмівні диски (задні)",
  "brakeFluid": "Гальмівна рідина",
  "timingBelt": "Ремінь ГРМ",
  "coolant": "Охолоджувальна рідина (антифриз)",
  "transmissionOil": "Трансмісійна олива",
  "battery": "Акумулятор"
}
```

- [ ] **Step 1.5: Run the test to verify it passes**

Run: `npx vitest run src/lib/standard-rules.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 1.6: Commit**

```bash
git add src/lib/standard-rules.ts src/lib/standard-rules.test.ts src/messages/en.json src/messages/uk.json
git commit -m "feat: add STANDARD_RULES constant with i18n names"
```

---

### Task 2: Input schema + pure resolve helper

**Files:**
- Modify: `src/lib/schemas/rule.ts` (add `standardRulesInputSchema`)
- Modify: `src/lib/standard-rules.ts` (add `resolveStandardRules`)
- Test: `src/lib/schemas/schemas.test.ts` (extend), `src/lib/standard-rules.test.ts` (extend)

- [ ] **Step 2.1: Write the failing schema tests**

Append to `src/lib/schemas/schemas.test.ts` (also add `standardRulesInputSchema` to the existing `./rule` import):

```ts
describe("standard rules schema", () => {
  it("accepts known keys", () => {
    expect(
      standardRulesInputSchema.safeParse({ carId: oid, keys: ["engineOil", "battery"] })
        .success,
    ).toBe(true);
  });
  it("rejects unknown keys, empty list, and bad carId", () => {
    expect(
      standardRulesInputSchema.safeParse({ carId: oid, keys: ["notAKey"] }).success,
    ).toBe(false);
    expect(standardRulesInputSchema.safeParse({ carId: oid, keys: [] }).success).toBe(false);
    expect(
      standardRulesInputSchema.safeParse({ carId: "short", keys: ["engineOil"] }).success,
    ).toBe(false);
  });
});
```

- [ ] **Step 2.2: Write the failing resolver tests**

Append to `src/lib/standard-rules.test.ts` (add `resolveStandardRules` to the import from `./standard-rules`):

```ts
describe("resolveStandardRules", () => {
  const t = (key: string) => `name:${key}`;

  it("maps selected keys to rule inputs with translated names", () => {
    const result = resolveStandardRules(["engineOil", "battery"], [], t);
    expect(result).toEqual([
      { componentName: "name:engineOil", intervalKm: 10_000, intervalMonths: 12 },
      { componentName: "name:battery", intervalMonths: 60 },
    ]);
  });

  it("skips names that already exist on the car, case-insensitively", () => {
    const result = resolveStandardRules(
      ["engineOil", "airFilter"],
      ["NAME:ENGINEOIL"],
      t,
    );
    expect(result).toEqual([
      { componentName: "name:airFilter", intervalKm: 30_000, intervalMonths: 24 },
    ]);
  });

  it("ignores duplicate selected keys", () => {
    const result = resolveStandardRules(["battery", "battery"], [], t);
    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 2.3: Run tests to verify they fail**

Run: `npx vitest run src/lib/standard-rules.test.ts src/lib/schemas/schemas.test.ts`
Expected: FAIL — `standardRulesInputSchema` and `resolveStandardRules` not exported.

- [ ] **Step 2.4: Implement schema**

In `src/lib/schemas/rule.ts`, add at the top:

```ts
import { STANDARD_RULE_KEYS } from "@/lib/standard-rules";
```

and at the bottom:

```ts
export const standardRulesInputSchema = z.object({
  carId: objectIdSchema,
  keys: z
    .array(z.enum(STANDARD_RULE_KEYS))
    .min(1, "validation.componentRequired")
    .max(STANDARD_RULE_KEYS.length),
});
```

- [ ] **Step 2.5: Implement resolver**

Append to `src/lib/standard-rules.ts`:

```ts
export interface StandardRuleResolved {
  componentName: string;
  intervalKm?: number;
  intervalMonths?: number;
}

/**
 * Maps selected keys to rule inputs, translating names with `t` and skipping
 * names that already exist on the car (case-insensitive).
 */
export function resolveStandardRules(
  keys: readonly StandardRuleKey[],
  existingComponentNames: readonly string[],
  t: (key: StandardRuleKey) => string,
): StandardRuleResolved[] {
  const existing = new Set(existingComponentNames.map((n) => n.toLowerCase()));
  const selected = new Set(keys);
  return STANDARD_RULES.filter(
    (r) => selected.has(r.key) && !existing.has(t(r.key).toLowerCase()),
  ).map((r) => ({
    componentName: t(r.key),
    ...(r.intervalKm !== undefined && { intervalKm: r.intervalKm }),
    ...(r.intervalMonths !== undefined && { intervalMonths: r.intervalMonths }),
  }));
}
```

- [ ] **Step 2.6: Run tests to verify they pass**

Run: `npx vitest run src/lib/standard-rules.test.ts src/lib/schemas/schemas.test.ts`
Expected: PASS.

- [ ] **Step 2.7: Commit**

```bash
git add src/lib/standard-rules.ts src/lib/standard-rules.test.ts src/lib/schemas/rule.ts src/lib/schemas/schemas.test.ts
git commit -m "feat: add standard-rules input schema and resolve helper"
```

---

### Task 3: `createRules` repository function + server action

Repositories are thin untested wrappers by project convention — no repo test. The action's only logic (dedup/translation) is already unit-tested via `resolveStandardRules`.

**Files:**
- Modify: `src/lib/repositories/rules.ts` (add `createRules`)
- Modify: `src/actions/rules.ts` (add `addStandardRulesAction`)

- [ ] **Step 3.1: Add `createRules` to `src/lib/repositories/rules.ts`**

Append after `createRule`:

```ts
export async function createRules(
  carId: string,
  inputs: {
    componentName: string;
    intervalKm?: number;
    intervalMonths?: number;
  }[],
): Promise<MaintenanceRule[]> {
  if (inputs.length === 0) return [];
  const docs: RuleDoc[] = inputs.map((input) => ({
    carId: new ObjectId(carId),
    componentName: input.componentName,
    ...(input.intervalKm !== undefined && { intervalKm: input.intervalKm }),
    ...(input.intervalMonths !== undefined && { intervalMonths: input.intervalMonths }),
  }));
  const result = await rules().insertMany(docs);
  return docs.map((doc, i) => toRule({ ...doc, _id: result.insertedIds[i] }));
}
```

- [ ] **Step 3.2: Add the action to `src/actions/rules.ts`**

Update imports:

```ts
import { getTranslations } from "next-intl/server";
import {
  ruleDeleteSchema,
  ruleInputSchema,
  ruleUpdateSchema,
  standardRulesInputSchema,
} from "@/lib/schemas/rule";
import {
  createRule,
  createRules,
  deleteRule,
  listRulesByCarIds,
  updateRule,
} from "@/lib/repositories/rules";
import { resolveStandardRules } from "@/lib/standard-rules";
```

Append the action:

```ts
export const addStandardRulesAction = authActionClient
  .inputSchema(standardRulesInputSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!(await ownsCar(ctx.userId, parsedInput.carId)))
      throw new ActionError("errors.notFound");
    const t = await getTranslations("standardRules");
    const existing = await listRulesByCarIds([parsedInput.carId]);
    const inputs = resolveStandardRules(
      parsedInput.keys,
      existing.map((r) => r.componentName),
      t,
    );
    return await createRules(parsedInput.carId, inputs);
  });
```

- [ ] **Step 3.3: Verify types and lint**

Run: `npx tsc --noEmit && npx eslint src`
Expected: clean.

- [ ] **Step 3.4: Commit**

```bash
git add src/lib/repositories/rules.ts src/actions/rules.ts
git commit -m "feat: add addStandardRulesAction with bulk rule insert"
```

---

### Task 4: `StandardRulesDialog` component (TDD)

**Files:**
- Create: `src/components/cars/standard-rules-dialog.tsx`
- Modify: `src/messages/en.json`, `src/messages/uk.json` (dialog strings in `car` section)
- Test: `src/components/cars/standard-rules-dialog.test.tsx`

- [ ] **Step 4.1: Add i18n dialog strings**

In `src/messages/en.json` `car` section, after `"noRulesHint"`:

```json
"addStandardRules": "Add standard rules",
"standardRulesDescription": "Typical service items with common intervals. Uncheck what you don't need — you can edit everything later.",
"standardRulesAlreadyAdded": "Already added",
"standardRulesSubmit": "Add selected ({count})",
"standardRulesAdded": "{count, plural, one {# rule added} other {# rules added}}"
```

In `src/messages/uk.json` `car` section, same position:

```json
"addStandardRules": "Додати стандартні правила",
"standardRulesDescription": "Типові сервісні роботи зі звичними інтервалами. Зніміть позначки з непотрібного — все можна змінити пізніше.",
"standardRulesAlreadyAdded": "Вже додано",
"standardRulesSubmit": "Додати вибрані ({count})",
"standardRulesAdded": "{count, plural, one {Додано # правило} few {Додано # правила} many {Додано # правил} other {Додано # правила}}"
```

- [ ] **Step 4.2: Write the failing component test**

Create `src/components/cars/standard-rules-dialog.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import { useGarageStore } from "@/stores/garage";
import { STANDARD_RULES } from "@/lib/standard-rules";

// vi.mock factories are hoisted above imports — anything they capture
// must come from vi.hoisted, or it is "accessed before initialization".
const { addStandardRules } = vi.hoisted(() => ({
  addStandardRules: vi.fn(),
}));

vi.mock("@/actions/rules", () => ({
  addStandardRulesAction: addStandardRules,
}));

import { StandardRulesDialog } from "./standard-rules-dialog";

const carId = "65f1a2b3c4d5e6f7a8b9c0d1";

afterEach(cleanup);
beforeEach(() => {
  addStandardRules.mockReset();
  useGarageStore.setState({ cars: [], rules: [], logs: [], selectedCarId: carId });
});

function renderDialog() {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <StandardRulesDialog carId={carId} trigger={<button>open</button>} />
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "open" }));
}

describe("StandardRulesDialog", () => {
  it("lists all standard rules pre-checked", () => {
    renderDialog();
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(STANDARD_RULES.length);
    for (const box of boxes) expect(box).toBeChecked();
    expect(
      screen.getByRole("button", { name: `Add selected (${STANDARD_RULES.length})` }),
    ).toBeEnabled();
  });

  it("disables and unchecks rules that already exist on the car (case-insensitive)", () => {
    useGarageStore.setState({
      rules: [
        {
          id: "r1",
          carId,
          componentName: "ENGINE OIL & OIL FILTER",
          intervalKm: 15000,
        },
      ],
    });
    renderDialog();
    const oilBox = screen.getByRole("checkbox", { name: /Engine oil & oil filter/ });
    expect(oilBox).toBeDisabled();
    expect(oilBox).not.toBeChecked();
    expect(screen.getByText("Already added")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `Add selected (${STANDARD_RULES.length - 1})` }),
    ).toBeEnabled();
  });

  it("submits only the checked keys and upserts the created rules", async () => {
    const created = [
      { id: "n1", carId, componentName: "Engine oil & oil filter", intervalKm: 10000, intervalMonths: 12 },
    ];
    addStandardRules.mockResolvedValue({ data: created });
    renderDialog();
    // Uncheck everything except engine oil
    for (const box of screen.getAllByRole("checkbox")) {
      if (!/Engine oil/.test(box.getAttribute("aria-label") ?? "")) fireEvent.click(box);
    }
    fireEvent.click(screen.getByRole("button", { name: "Add selected (1)" }));
    await vi.waitFor(() =>
      expect(addStandardRules).toHaveBeenCalledWith({ carId, keys: ["engineOil"] }),
    );
    await vi.waitFor(() =>
      expect(useGarageStore.getState().rules).toEqual(created),
    );
  });

  it("shows a translated error toast and keeps the store unchanged on failure", async () => {
    addStandardRules.mockResolvedValue({ serverError: "errors.notFound" });
    renderDialog();
    fireEvent.click(
      screen.getByRole("button", { name: `Add selected (${STANDARD_RULES.length})` }),
    );
    await vi.waitFor(() => expect(addStandardRules).toHaveBeenCalled());
    expect(useGarageStore.getState().rules).toEqual([]);
  });
});
```

- [ ] **Step 4.3: Run the test to verify it fails**

Run: `npx vitest run src/components/cars/standard-rules-dialog.test.tsx`
Expected: FAIL — cannot resolve `./standard-rules-dialog`.

- [ ] **Step 4.4: Implement the dialog**

Create `src/components/cars/standard-rules-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { addStandardRulesAction } from "@/actions/rules";
import { actionErrorKey } from "@/lib/action-feedback";
import { STANDARD_RULES, type StandardRuleKey } from "@/lib/standard-rules";
import { useGarageStore } from "@/stores/garage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function intervalSummary(rule: { intervalKm?: number; intervalMonths?: number }) {
  return [
    rule.intervalKm !== undefined && `${rule.intervalKm.toLocaleString()} km`,
    rule.intervalMonths !== undefined && `${rule.intervalMonths} mo`,
  ]
    .filter(Boolean)
    .join(" / ");
}

export function StandardRulesDialog({
  carId,
  trigger,
}: {
  carId: string;
  trigger: React.ReactElement;
}) {
  const t = useTranslations();
  const tNames = useTranslations("standardRules");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<Partial<Record<StandardRuleKey, boolean>>>({});
  const { upsertRule } = useGarageStore();
  const existingNames = new Set(
    useGarageStore((s) => s.rules)
      .filter((r) => r.carId === carId)
      .map((r) => r.componentName.toLowerCase()),
  );

  const alreadyAdded = (key: StandardRuleKey) =>
    existingNames.has(tNames(key).toLowerCase());
  const selectedKeys = STANDARD_RULES.filter(
    (r) => !alreadyAdded(r.key) && (checked[r.key] ?? true),
  ).map((r) => r.key);

  function handleOpenChange(next: boolean) {
    if (next) setChecked({});
    setOpen(next);
  }

  async function handleSubmit() {
    setBusy(true);
    try {
      const result = await addStandardRulesAction({ carId, keys: selectedKeys });
      const errorKey = actionErrorKey(result);
      if (errorKey) {
        toast.error(t(errorKey));
      } else {
        for (const rule of result!.data!) upsertRule(rule);
        toast.success(t("car.standardRulesAdded", { count: result!.data!.length }));
        setOpen(false);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("car.addStandardRules")}</DialogTitle>
          <DialogDescription>{t("car.standardRulesDescription")}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] space-y-1 overflow-y-auto">
          {STANDARD_RULES.map((rule) => {
            const disabled = alreadyAdded(rule.key);
            return (
              <label
                key={rule.key}
                className={`flex items-center gap-3 rounded-md p-2 ${
                  disabled ? "opacity-50" : "cursor-pointer hover:bg-accent"
                }`}
              >
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  aria-label={tNames(rule.key)}
                  checked={disabled ? false : (checked[rule.key] ?? true)}
                  disabled={disabled || busy}
                  onChange={(e) =>
                    setChecked((c) => ({ ...c, [rule.key]: e.target.checked }))
                  }
                />
                <span className="flex-1">
                  <span className="block font-medium">{tNames(rule.key)}</span>
                  <span className="block text-sm text-muted-foreground">
                    {disabled
                      ? t("car.standardRulesAlreadyAdded")
                      : intervalSummary(rule)}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        <Button
          size="lg"
          className="w-full"
          disabled={busy || selectedKeys.length === 0}
          onClick={handleSubmit}
        >
          {t("car.standardRulesSubmit", { count: selectedKeys.length })}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4.5: Run the test to verify it passes**

Run: `npx vitest run src/components/cars/standard-rules-dialog.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 4.6: Commit**

```bash
git add src/components/cars/standard-rules-dialog.tsx src/components/cars/standard-rules-dialog.test.tsx src/messages/en.json src/messages/uk.json
git commit -m "feat: add StandardRulesDialog picker component"
```

---

### Task 5: Wire the dialog into the rules section

**Files:**
- Modify: `src/components/cars/rule-list.tsx` (two-button row at the bottom; visible in the empty state too, satisfying both entry points)

- [ ] **Step 5.1: Replace the bottom `RuleFormDialog` trigger block**

In `src/components/cars/rule-list.tsx`, add imports:

```tsx
import { ListChecks } from "lucide-react";
import { StandardRulesDialog } from "./standard-rules-dialog";
```

(`ListChecks` joins the existing `lucide-react` import list.)

Replace the trailing block (lines 77-84, the full-width "Add rule" `RuleFormDialog`) with:

```tsx
      <div className="grid grid-cols-2 gap-2">
        <RuleFormDialog
          carId={carId}
          trigger={
            <Button variant="outline" size="lg">
              <Plus className="size-4" /> {t("car.addRule")}
            </Button>
          }
        />
        <StandardRulesDialog
          carId={carId}
          trigger={
            <Button variant="outline" size="lg">
              <ListChecks className="size-4" /> {t("car.addStandardRules")}
            </Button>
          }
        />
      </div>
```

- [ ] **Step 5.2: Verify component tests still pass**

Run: `npx vitest run src/components`
Expected: PASS.

- [ ] **Step 5.3: Commit**

```bash
git add src/components/cars/rule-list.tsx
git commit -m "feat: offer standard rules picker from the rules section"
```

---

### Task 6: Full verification gate

- [ ] **Step 6.1: Run the full gate (project requirement)**

```bash
npx vitest run
npx tsc --noEmit
npx eslint src
npm run build
```

Expected: all pass. Fix anything that fails before proceeding.

- [ ] **Step 6.2: Commit any fixes**

Only if 6.1 required changes:

```bash
git add -A src
git commit -m "fix: address verification gate findings"
```
