# Visit-grouped Service History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the per-log service history with one card per visit (a wrapping row of type icons), let each maintenance rule store a user-picked icon, and split the car detail page into History/Rules tabs.

**Architecture:** No DB collection redesign — visit grouping happens in the view from the flat `logs` + `visits` already in the store. A new `MaintenanceRule.icon?` field (a curated enum) is the primary icon source; a bilingual keyword inference and a `wrench` fallback cover legacy/custom names. Icon rendering lives in `src/lib/component-icons.tsx`; the enum + key list live in `src/lib/types.ts` so server-side schemas can import the keys without pulling in React/Lucide.

**Tech Stack:** Next.js 16, React 19, next-intl, Zustand, Zod, Base UI (shadcn), Lucide icons, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-13-visit-grouped-history-design.md`

**Conventions reminder:** never commit on `main` (work is on branch `visit-history-redesign`); `en.json` and `uk.json` must keep identical key sets; run `npx tsc --noEmit && npx eslint src`, `npx vitest run`, and `npm run build` before considering the work done.

---

## File structure

| File | Responsibility | Action |
|---|---|---|
| `src/lib/types.ts` | `ComponentIconKey`, `COMPONENT_ICON_KEYS`, `MaintenanceRule.icon?` | Modify |
| `src/lib/component-icons.tsx` | `iconByKey`, `inferIconKey`, `resolveIcon` | Create |
| `src/lib/component-icons.test.ts` | unit tests for the resolver + catalog/i18n parity | Create |
| `src/messages/en.json`, `uk.json` | `componentIcons.*`, `car.icon/iconAuto/deleteVisitConfirm/visitDeleted` | Modify |
| `src/lib/schemas/rule.ts` | `icon` on rule input/update schemas | Modify |
| `src/lib/repositories/rules.ts` | persist `icon` | Modify |
| `src/lib/standard-rules.ts` | default icons + carry through `resolveStandardRules` | Modify |
| `src/components/cars/rule-form-dialog.tsx` | icon dropdown | Modify |
| `src/lib/schemas/visit.ts` | `visitDeleteSchema` | Modify |
| `src/lib/repositories/logs.ts` | `deleteLogsByVisitId` | Modify |
| `src/actions/visits.ts` | `deleteVisitAction` | Modify |
| `src/stores/garage.ts` | `removeVisitAndLogs` | Modify |
| `src/components/cars/service-history.tsx` | visit-grouped cards | Rewrite |
| `src/components/cars/service-history.test.tsx` | grouping + delete-visit tests | Create |
| `src/components/cars/rule-list.tsx` | drop redundant `h3` (tab is the heading) | Modify |
| `src/components/cars/car-detail.tsx` | History/Rules pill switcher | Modify |
| `src/components/cars/car-detail.test.tsx` | update for tabs | Modify |
| `src/lib/schemas/schemas.test.ts` | rule-icon + visit-delete schema tests | Modify |
| `src/stores/garage.test.ts` | `removeVisitAndLogs` test | Modify |
| `src/lib/standard-rules.test.ts` | default-icon assertions | Modify |

---

## Task 1: Icon key type + catalog list in `types.ts`

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add the icon key type, the catalog tuple, and the rule field**

In `src/lib/types.ts`, add near the top (after the existing imports, before `Car`):

```ts
export const COMPONENT_ICON_KEYS = [
  "oil",
  "filter",
  "spark",
  "brake",
  "belt",
  "coolant",
  "transmission",
  "battery",
  "tire",
  "light",
  "fluid",
  "wrench",
] as const;

export type ComponentIconKey = (typeof COMPONENT_ICON_KEYS)[number];
```

Then add the optional field to `MaintenanceRule`:

```ts
export interface MaintenanceRule {
  id: string;
  carId: string;
  componentName: string;
  intervalKm?: number;
  intervalMonths?: number;
  /** User-picked icon; when absent the icon is inferred from componentName. */
  icon?: ComponentIconKey;
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add ComponentIconKey catalog and rule.icon field"
```

---

## Task 2: Icon resolver `component-icons.tsx` (TDD)

**Files:**
- Create: `src/lib/component-icons.tsx`
- Create: `src/lib/component-icons.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/component-icons.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CircleStop, Filter, Wrench } from "lucide-react";
import en from "@/messages/en.json";
import uk from "@/messages/uk.json";
import { COMPONENT_ICON_KEYS } from "@/lib/types";
import { inferIconKey, resolveIcon } from "./component-icons";

describe("inferIconKey", () => {
  it("infers from English keywords", () => {
    expect(inferIconKey("Engine oil & oil filter")).toBe("oil");
    expect(inferIconKey("Air filter")).toBe("filter");
    expect(inferIconKey("Spark plugs")).toBe("spark");
    expect(inferIconKey("Brake fluid")).toBe("brake");
    expect(inferIconKey("Battery")).toBe("battery");
  });

  it("infers from Ukrainian keywords", () => {
    expect(inferIconKey("Моторна олива та масляний фільтр")).toBe("oil");
    expect(inferIconKey("Гальмівні колодки (передні)")).toBe("brake");
    expect(inferIconKey("Акумулятор")).toBe("battery");
    expect(inferIconKey("Ремінь ГРМ")).toBe("belt");
  });

  it("returns null when nothing matches", () => {
    expect(inferIconKey("Headlight polish")).toBeNull();
  });
});

describe("resolveIcon", () => {
  it("uses the stored key over inference", () => {
    expect(resolveIcon({ name: "Engine oil", storedKey: "brake" })).toBe(CircleStop);
  });

  it("falls back to inference when no stored key", () => {
    expect(resolveIcon({ name: "Air filter" })).toBe(Filter);
  });

  it("falls back to the wrench icon when nothing matches", () => {
    expect(resolveIcon({ name: "Custom service" })).toBe(Wrench);
  });
});

describe("componentIcons i18n parity", () => {
  it("en and uk name every icon key (and nothing else)", () => {
    for (const catalog of [en, uk]) {
      const names = (catalog as { componentIcons: Record<string, string> }).componentIcons;
      expect(Object.keys(names).sort()).toEqual([...COMPONENT_ICON_KEYS].sort());
      for (const key of COMPONENT_ICON_KEYS) {
        expect(names[key].length).toBeGreaterThan(0);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/component-icons.test.ts`
Expected: FAIL — cannot resolve `./component-icons` (and `componentIcons` missing from catalogs; that key is added in Task 3).

- [ ] **Step 3: Write the implementation**

Create `src/lib/component-icons.tsx`:

```tsx
import {
  BatteryCharging,
  CircleDot,
  CircleStop,
  Cog,
  Droplet,
  Droplets,
  Filter,
  Lightbulb,
  Settings2,
  Snowflake,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ComponentIconKey } from "@/lib/types";

const ICONS: Record<ComponentIconKey, LucideIcon> = {
  oil: Droplet,
  filter: Filter,
  spark: Zap,
  brake: CircleStop,
  belt: Cog,
  coolant: Snowflake,
  transmission: Settings2,
  battery: BatteryCharging,
  tire: CircleDot,
  light: Lightbulb,
  fluid: Droplets,
  wrench: Wrench,
};

export function iconByKey(key: ComponentIconKey): LucideIcon {
  return ICONS[key] ?? Wrench;
}

// Ordered: first match wins, so "brake fluid" resolves to brake (not a fluid key).
const INFERENCE: ReadonlyArray<readonly [ComponentIconKey, readonly string[]]> = [
  ["oil", ["oil", "олив", "масл"]],
  ["filter", ["filter", "фільтр"]],
  ["spark", ["spark", "свічк"]],
  ["brake", ["brake", "гальмів"]],
  ["belt", ["belt", "timing", "ремінь", "грм"]],
  ["coolant", ["coolant", "antifreeze", "охолодж", "антифриз"]],
  ["transmission", ["transmission", "трансмісій", "коробк"]],
  ["battery", ["battery", "акумулятор"]],
  ["tire", ["tire", "tyre", "шин", "колес"]],
];

export function inferIconKey(name: string): ComponentIconKey | null {
  const lower = name.toLowerCase();
  for (const [key, keywords] of INFERENCE) {
    if (keywords.some((kw) => lower.includes(kw))) return key;
  }
  return null;
}

export function resolveIcon({
  name,
  storedKey,
}: {
  name: string;
  storedKey?: ComponentIconKey;
}): LucideIcon {
  if (storedKey) return iconByKey(storedKey);
  const inferred = inferIconKey(name);
  return inferred ? iconByKey(inferred) : Wrench;
}
```

- [ ] **Step 4: Run test (resolver cases will pass; i18n-parity case still fails until Task 3)**

Run: `npx vitest run src/lib/component-icons.test.ts`
Expected: the `inferIconKey` and `resolveIcon` describes PASS; the `componentIcons i18n parity` test FAILS (key not yet added). This is expected — Task 3 makes it pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/component-icons.tsx src/lib/component-icons.test.ts
git commit -m "feat: add icon resolver (stored key, keyword inference, wrench fallback)"
```

---

## Task 3: i18n keys in both catalogs

**Files:**
- Modify: `src/messages/en.json`
- Modify: `src/messages/uk.json`

- [ ] **Step 1: Add icon names + new car keys to `en.json`**

Add a new top-level `componentIcons` object (place it alongside `standardRules`):

```json
"componentIcons": {
  "oil": "Oil",
  "filter": "Filter",
  "spark": "Spark plugs",
  "brake": "Brakes",
  "belt": "Belt",
  "coolant": "Coolant",
  "transmission": "Transmission",
  "battery": "Battery",
  "tire": "Tires",
  "light": "Lights",
  "fluid": "Fluid",
  "wrench": "Other"
}
```

Inside the existing `"car"` object add these four keys:

```json
"icon": "Icon",
"iconAuto": "Auto (from name)",
"deleteVisitConfirm": "Delete this visit and all its services?",
"visitDeleted": "Visit deleted"
```

- [ ] **Step 2: Add the matching keys to `uk.json`**

Add the `componentIcons` object:

```json
"componentIcons": {
  "oil": "Олива",
  "filter": "Фільтр",
  "spark": "Свічки",
  "brake": "Гальма",
  "belt": "Ремінь",
  "coolant": "Антифриз",
  "transmission": "Трансмісія",
  "battery": "Акумулятор",
  "tire": "Шини",
  "light": "Світло",
  "fluid": "Рідина",
  "wrench": "Інше"
}
```

Inside the `"car"` object add:

```json
"icon": "Іконка",
"iconAuto": "Авто (за назвою)",
"deleteVisitConfirm": "Видалити цей запис і всі його роботи?",
"visitDeleted": "Запис видалено"
```

- [ ] **Step 3: Verify both catalogs parse and key sets match**

Run:
```bash
node -e "const a=require('./src/messages/en.json'),b=require('./src/messages/uk.json');const ka=Object.keys(a.componentIcons).sort(),kb=Object.keys(b.componentIcons).sort();if(JSON.stringify(ka)!==JSON.stringify(kb))throw new Error('componentIcons keys differ');const ca=Object.keys(a.car).sort(),cb=Object.keys(b.car).sort();if(JSON.stringify(ca)!==JSON.stringify(cb))throw new Error('car keys differ');console.log('OK',ka.length,'icon keys,',ca.length,'car keys')"
```
Expected: `OK 12 icon keys, 33 car keys`

- [ ] **Step 4: Run the icon test — now fully green**

Run: `npx vitest run src/lib/component-icons.test.ts`
Expected: PASS (all three describes, including i18n parity).

- [ ] **Step 5: Commit**

```bash
git add src/messages/en.json src/messages/uk.json
git commit -m "feat: add componentIcons and visit-delete i18n keys"
```

---

## Task 4: Persist `icon` on rules (schema + repository)

**Files:**
- Modify: `src/lib/schemas/rule.ts`
- Modify: `src/lib/repositories/rules.ts`
- Modify: `src/lib/schemas/schemas.test.ts`

- [ ] **Step 1: Write the failing schema test**

In `src/lib/schemas/schemas.test.ts`, inside the existing `describe("rule schema", ...)` block, add:

```ts
  it("accepts a valid icon and rejects an unknown one", () => {
    expect(
      ruleInputSchema.safeParse({
        carId: oid,
        componentName: "Oil",
        intervalKm: 10000,
        icon: "oil",
      }).success,
    ).toBe(true);
    expect(
      ruleInputSchema.safeParse({
        carId: oid,
        componentName: "Oil",
        intervalKm: 10000,
        icon: "rocket",
      }).success,
    ).toBe(false);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/schemas/schemas.test.ts -t "accepts a valid icon"`
Expected: FAIL — `icon: "rocket"` currently passes (unknown key not rejected) because there is no `icon` field yet.

- [ ] **Step 3: Add `icon` to the rule schemas**

In `src/lib/schemas/rule.ts`, add to the imports:

```ts
import { COMPONENT_ICON_KEYS } from "@/lib/types";
```

Add this near the interval constants:

```ts
const iconSchema = z.enum(COMPONENT_ICON_KEYS);
```

Add `icon: iconSchema.optional(),` to BOTH `ruleInputSchema` and `ruleUpdateSchema` object shapes (alongside `intervalMonths`).

- [ ] **Step 4: Persist `icon` in the repository**

In `src/lib/repositories/rules.ts`:

Add the import:
```ts
import type { ComponentIconKey, MaintenanceRule } from "@/lib/types";
```

Add `icon?: ComponentIconKey;` to the `RuleDoc` interface.

In `toRule`, add (after the `intervalMonths` spread):
```ts
    ...(doc.icon !== undefined && { icon: doc.icon }),
```

Add `icon?: ComponentIconKey;` to the input type of `createRule`, and in its `doc` object add:
```ts
    ...(input.icon !== undefined && { icon: input.icon }),
```

Add `icon?: ComponentIconKey;` to the per-item input type of `createRules`, and in its mapped doc add:
```ts
    ...(input.icon !== undefined && { icon: input.icon }),
```

Add `icon?: ComponentIconKey;` to the input type of `updateRule`, and in its `replaceOne` replacement document add:
```ts
      ...(input.icon !== undefined && { icon: input.icon }),
```

(`createRuleAction`/`updateRuleAction` already forward the whole `parsedInput`, so no change is needed in `src/actions/rules.ts` for create/update.)

- [ ] **Step 5: Run schema test + typecheck**

Run: `npx vitest run src/lib/schemas/schemas.test.ts -t "accepts a valid icon"` → PASS
Run: `npx tsc --noEmit` → PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/schemas/rule.ts src/lib/repositories/rules.ts src/lib/schemas/schemas.test.ts
git commit -m "feat: persist optional icon on maintenance rules"
```

---

## Task 5: Default icons on standard rules

**Files:**
- Modify: `src/lib/standard-rules.ts`
- Modify: `src/lib/standard-rules.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/lib/standard-rules.test.ts`, inside `describe("resolveStandardRules", ...)`, add:

```ts
  it("carries the default icon through to the resolved input", () => {
    const result = resolveStandardRules(["engineOil", "battery"], [], t);
    expect(result).toEqual([
      { componentName: "name:engineOil", intervalKm: 10_000, intervalMonths: 12, icon: "oil" },
      { componentName: "name:battery", intervalMonths: 60, icon: "battery" },
    ]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/standard-rules.test.ts -t "carries the default icon"`
Expected: FAIL — resolved objects have no `icon`.

- [ ] **Step 3: Add icons to `STANDARD_RULES` and the resolver**

In `src/lib/standard-rules.ts`:

Add the import:
```ts
import type { ComponentIconKey } from "@/lib/types";
```

Add `icon: ComponentIconKey;` to the `StandardRule` interface and `icon?: ComponentIconKey;` to `StandardRuleResolved`.

Replace the `STANDARD_RULES` array with the icon-annotated version:

```ts
export const STANDARD_RULES: readonly StandardRule[] = [
  { key: "engineOil", intervalKm: 10_000, intervalMonths: 12, icon: "oil" },
  { key: "airFilter", intervalKm: 30_000, intervalMonths: 24, icon: "filter" },
  { key: "cabinFilter", intervalKm: 15_000, intervalMonths: 12, icon: "filter" },
  { key: "fuelFilter", intervalKm: 30_000, icon: "filter" },
  { key: "sparkPlugs", intervalKm: 60_000, icon: "spark" },
  { key: "brakePadsFront", intervalKm: 40_000, icon: "brake" },
  { key: "brakePadsRear", intervalKm: 60_000, icon: "brake" },
  { key: "brakeDiscsFront", intervalKm: 80_000, icon: "brake" },
  { key: "brakeDiscsRear", intervalKm: 100_000, icon: "brake" },
  { key: "brakeFluid", intervalKm: 40_000, intervalMonths: 24, icon: "fluid" },
  { key: "timingBelt", intervalKm: 90_000, intervalMonths: 60, icon: "belt" },
  { key: "coolant", intervalKm: 60_000, intervalMonths: 48, icon: "coolant" },
  { key: "transmissionOil", intervalKm: 60_000, icon: "transmission" },
  { key: "battery", intervalMonths: 60, icon: "battery" },
];
```

In `resolveStandardRules`, add `icon: r.icon,` to the returned object (after the interval spreads):

```ts
  ).map((r) => ({
    componentName: t(r.key),
    ...(r.intervalKm !== undefined && { intervalKm: r.intervalKm }),
    ...(r.intervalMonths !== undefined && { intervalMonths: r.intervalMonths }),
    icon: r.icon,
  }));
```

- [ ] **Step 4: Run the standard-rules tests**

Run: `npx vitest run src/lib/standard-rules.test.ts`
Expected: PASS (the existing `maps selected keys` test still matches because it asserts with `toEqual` — UPDATE it: add `icon: "oil"` and `icon: "battery"` to its two expected objects, and `icon: "filter"` to the `skips names that already exist` expected object).

Specifically update the two existing assertions:
```ts
    // maps selected keys ...
    expect(result).toEqual([
      { componentName: "name:engineOil", intervalKm: 10_000, intervalMonths: 12, icon: "oil" },
      { componentName: "name:battery", intervalMonths: 60, icon: "battery" },
    ]);
    // skips names that already exist ...
    expect(result).toEqual([
      { componentName: "name:airFilter", intervalKm: 30_000, intervalMonths: 24, icon: "filter" },
    ]);
```

Re-run: `npx vitest run src/lib/standard-rules.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/standard-rules.ts src/lib/standard-rules.test.ts
git commit -m "feat: default icons for standard maintenance rules"
```

---

## Task 6: Icon dropdown in the rule form

**Files:**
- Modify: `src/components/cars/rule-form-dialog.tsx`

- [ ] **Step 1: Add icon state and wire it into the form**

In `src/components/cars/rule-form-dialog.tsx`:

Add to imports:
```ts
import { useGarageStore } from "@/stores/garage";
import { iconByKey } from "@/lib/component-icons";
import { COMPONENT_ICON_KEYS, type ComponentIconKey, type MaintenanceRule } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
```

(Note: `MaintenanceRule` and `useGarageStore` are already imported — merge the new named imports into the existing import lines rather than duplicating.)

Inside the component, add icon translations and state:
```ts
  const tIcons = useTranslations("componentIcons");
  const [icon, setIcon] = useState<ComponentIconKey | "auto">(rule?.icon ?? "auto");
```

In `handleSubmit`, compute the value to send (place right after the interval validation, before `setBusy(true)`):
```ts
    const iconValue = icon === "auto" ? undefined : icon;
```

Pass `icon: iconValue` into BOTH the optimistic `updated` object and the `updateRuleAction({...})` call, AND into the `createRuleAction({...})` call. Concretely:

- In the edit branch:
```ts
        const updated: MaintenanceRule = {
          ...rule,
          componentName,
          intervalKm,
          intervalMonths,
          icon: iconValue,
        };
        // ...
        const result = await updateRuleAction({
          ruleId: rule.id,
          carId,
          componentName,
          intervalKm,
          intervalMonths,
          icon: iconValue,
        });
```
- In the create branch:
```ts
        const result = await createRuleAction({
          carId,
          componentName,
          intervalKm,
          intervalMonths,
          icon: iconValue,
        });
```

- [ ] **Step 2: Add the dropdown to the form JSX**

Insert this block inside the `<form>`, right after the component-name field's `<div className="space-y-2">…</div>` and before the interval grid:

```tsx
          <div className="space-y-2">
            <Label>{t("car.icon")}</Label>
            <Select value={icon} onValueChange={(v) => v && setIcon(v as ComponentIconKey | "auto")}>
              <SelectTrigger className="w-full" aria-label={t("car.icon")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">{t("car.iconAuto")}</SelectItem>
                {COMPONENT_ICON_KEYS.map((key) => {
                  const Icon = iconByKey(key);
                  return (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <Icon className="size-4" />
                        {tIcons(key)}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/components/cars/rule-form-dialog.tsx`
Expected: PASS.

- [ ] **Step 4: Run the existing standard-rules dialog test (sanity — shares no state but confirms no regressions in rule UI imports)**

Run: `npx vitest run src/components/cars/standard-rules-dialog.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/cars/rule-form-dialog.tsx
git commit -m "feat: icon picker dropdown in the rule form"
```

---

## Task 7: Delete-whole-visit backend (schema, repo, action, store)

**Files:**
- Modify: `src/lib/schemas/visit.ts`
- Modify: `src/lib/repositories/logs.ts`
- Modify: `src/actions/visits.ts`
- Modify: `src/stores/garage.ts`
- Modify: `src/lib/schemas/schemas.test.ts`
- Modify: `src/stores/garage.test.ts`

- [ ] **Step 1: Write the failing schema test**

In `src/lib/schemas/schemas.test.ts`, add the import at the top (merge with the existing `./visit` import):
```ts
import { visitDeleteSchema, visitInputSchema, visitUpdateSchema } from "./visit";
```

Add a new describe block:
```ts
describe("visit delete schema", () => {
  it("accepts a valid carId + visitId and rejects malformed ids", () => {
    expect(visitDeleteSchema.safeParse({ carId: oid, visitId: oid }).success).toBe(true);
    expect(visitDeleteSchema.safeParse({ carId: oid, visitId: "short" }).success).toBe(false);
    expect(visitDeleteSchema.safeParse({ carId: oid }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/schemas/schemas.test.ts -t "visit delete schema"`
Expected: FAIL — `visitDeleteSchema` does not exist (import error).

- [ ] **Step 3: Add the schema**

In `src/lib/schemas/visit.ts`, append:
```ts
export const visitDeleteSchema = z.object({
  carId: objectIdSchema,
  visitId: objectIdSchema,
});
```

- [ ] **Step 4: Add the repository helper**

In `src/lib/repositories/logs.ts`, add:
```ts
export async function deleteLogsByVisitId(visitId: string, carId: string): Promise<number> {
  const result = await logs().deleteMany({
    visitId: new ObjectId(visitId),
    carId: new ObjectId(carId),
  });
  return result.deletedCount;
}
```

- [ ] **Step 5: Add the action**

In `src/actions/visits.ts`:

Add to the schema import:
```ts
import { visitDeleteSchema, visitInputSchema, visitUpdateSchema } from "@/lib/schemas/visit";
```
Add `deleteLogsByVisitId` to the logs-repository import list.

Append the action:
```ts
export const deleteVisitAction = authActionClient
  .inputSchema(visitDeleteSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { carId, visitId } = parsedInput;
    if (!(await getCar(ctx.userId, carId))) throw new ActionError("errors.notFound");
    if (!(await getVisit(visitId, carId))) throw new ActionError("errors.notFound");
    await deleteLogsByVisitId(visitId, carId);
    await deleteVisit(visitId, carId);
    return { ok: true };
  });
```

- [ ] **Step 6: Write the failing store test**

In `src/stores/garage.test.ts`, add inside `describe("garage store", ...)`:
```ts
  it("removeVisitAndLogs drops the visit and all its logs, leaving others", () => {
    useGarageStore.setState({
      visits: [
        { id: "v1", carId: "c1", mileageAtService: 100, dateAtService: "2026-01-01T00:00:00.000Z" },
        { id: "v2", carId: "c1", mileageAtService: 200, dateAtService: "2026-02-01T00:00:00.000Z" },
      ],
      logs: [
        { id: "l1", carId: "c1", componentName: "Oil", mileageAtService: 100, dateAtService: "2026-01-01T00:00:00.000Z", visitId: "v1" },
        { id: "l2", carId: "c1", componentName: "Air filter", mileageAtService: 100, dateAtService: "2026-01-01T00:00:00.000Z", visitId: "v1" },
        { id: "l3", carId: "c1", componentName: "Battery", mileageAtService: 200, dateAtService: "2026-02-01T00:00:00.000Z", visitId: "v2" },
      ],
    });
    useGarageStore.getState().removeVisitAndLogs("v1");
    const s = useGarageStore.getState();
    expect(s.visits.map((v) => v.id)).toEqual(["v2"]);
    expect(s.logs.map((l) => l.id)).toEqual(["l3"]);
  });
```

- [ ] **Step 7: Run store test to verify it fails**

Run: `npx vitest run src/stores/garage.test.ts -t "removeVisitAndLogs"`
Expected: FAIL — `removeVisitAndLogs` is not a function.

- [ ] **Step 8: Add the store method**

In `src/stores/garage.ts`:

Add to the `GarageState` interface (after `removeVisit`):
```ts
  removeVisitAndLogs: (visitId: string) => void;
```

Add the implementation (after the `removeVisit` impl):
```ts
      removeVisitAndLogs: (visitId) =>
        set((s) => ({
          visits: s.visits.filter((v) => v.id !== visitId),
          logs: s.logs.filter((l) => l.visitId !== visitId),
        })),
```

- [ ] **Step 9: Run the schema + store tests, typecheck**

Run: `npx vitest run src/lib/schemas/schemas.test.ts src/stores/garage.test.ts`
Expected: PASS.
Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/lib/schemas/visit.ts src/lib/repositories/logs.ts src/actions/visits.ts src/stores/garage.ts src/lib/schemas/schemas.test.ts src/stores/garage.test.ts
git commit -m "feat: delete-whole-visit action, repo helper, and store method"
```

---

## Task 8: Rewrite ServiceHistory as visit cards (TDD)

**Files:**
- Rewrite: `src/components/cars/service-history.tsx`
- Create: `src/components/cars/service-history.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/cars/service-history.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import { useGarageStore } from "@/stores/garage";

const { actions, routerPush } = vi.hoisted(() => ({
  actions: { deleteVisit: vi.fn(), deleteLog: vi.fn() },
  routerPush: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: routerPush }) }));
vi.mock("@/actions/visits", () => ({ deleteVisitAction: actions.deleteVisit }));
vi.mock("@/actions/logs", () => ({ deleteLogAction: actions.deleteLog }));

import { ServiceHistory } from "./service-history";

const carId = "65f1a2b3c4d5e6f7a8b9c0d1";

function renderHistory() {
  render(
    <NextIntlClientProvider locale="en" timeZone="UTC" messages={en}>
      <ServiceHistory carId={carId} />
    </NextIntlClientProvider>,
  );
}

afterEach(cleanup);
beforeEach(() => {
  actions.deleteVisit.mockReset();
  actions.deleteLog.mockReset();
  routerPush.mockReset();
  useGarageStore.setState({
    cars: [{ id: carId, name: "Octavia", currentMileage: 152000, updatedAt: "2026-01-01T00:00:00.000Z" }],
    rules: [
      { id: "r1", carId, componentName: "Engine oil", intervalKm: 10000, icon: "oil" },
      { id: "r2", carId, componentName: "Air filter", intervalKm: 30000, icon: "filter" },
    ],
    visits: [
      { id: "v1", carId, mileageAtService: 152000, dateAtService: "2026-06-13T00:00:00.000Z", totalCost: 4500 },
    ],
    logs: [
      { id: "l1", carId, componentName: "Engine oil", mileageAtService: 152000, dateAtService: "2026-06-13T00:00:00.000Z", visitId: "v1" },
      { id: "l2", carId, componentName: "Air filter", mileageAtService: 152000, dateAtService: "2026-06-13T00:00:00.000Z", visitId: "v1" },
      { id: "legacy1", carId, componentName: "Brake pads", mileageAtService: 90000, dateAtService: "2025-01-01T00:00:00.000Z" },
    ],
    selectedCarId: carId,
    isServerSyncing: false,
  });
});

describe("ServiceHistory", () => {
  it("renders one card per visit with an icon per service", () => {
    renderHistory();
    // The two-service visit shows both component icons (aria-labelled).
    expect(screen.getByLabelText("Engine oil")).toBeInTheDocument();
    expect(screen.getByLabelText("Air filter")).toBeInTheDocument();
    // Visit total renders once.
    expect(screen.getByText(/Visit total/)).toBeInTheDocument();
  });

  it("renders a legacy log as its own card", () => {
    renderHistory();
    expect(screen.getByLabelText("Brake pads")).toBeInTheDocument();
  });

  it("deletes the whole visit optimistically and calls the action", async () => {
    actions.deleteVisit.mockResolvedValue({ data: { ok: true } });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderHistory();

    // Two delete buttons (visit card + legacy card); the visit card is first (newest).
    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => expect(actions.deleteVisit).toHaveBeenCalledWith({ carId, visitId: "v1" }));
    expect(useGarageStore.getState().visits.some((v) => v.id === "v1")).toBe(false);
    expect(useGarageStore.getState().logs.some((l) => l.visitId === "v1")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/cars/service-history.test.tsx`
Expected: FAIL — current component renders one card per log and has no per-visit icon row / delete-visit wiring.

- [ ] **Step 3: Rewrite the component**

Replace the entire contents of `src/components/cars/service-history.tsx`:

```tsx
"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { deleteLogAction } from "@/actions/logs";
import { deleteVisitAction } from "@/actions/visits";
import { actionErrorKey } from "@/lib/action-feedback";
import { resolveIcon } from "@/lib/component-icons";
import { useGarageStore } from "@/stores/garage";
import type { ServiceLog } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Entry = {
  kind: "visit" | "legacy";
  id: string;
  date: string;
  mileage: number;
  totalCost: number | null;
  logs: ServiceLog[];
};

export function ServiceHistory({ carId }: { carId: string }) {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const visits = useGarageStore((s) => s.visits);
  const rules = useGarageStore((s) => s.rules);
  const allLogs = useGarageStore((s) => s.logs);
  const store = useGarageStore();

  const carLogs = allLogs.filter((l) => l.carId === carId);

  const entries: Entry[] = [];
  for (const visit of visits.filter((v) => v.carId === carId)) {
    const logs = carLogs.filter((l) => l.visitId === visit.id);
    if (logs.length === 0) continue;
    entries.push({
      kind: "visit",
      id: visit.id,
      date: visit.dateAtService,
      mileage: visit.mileageAtService,
      totalCost: visit.totalCost ?? null,
      logs,
    });
  }
  for (const log of carLogs.filter((l) => !l.visitId)) {
    entries.push({
      kind: "legacy",
      id: log.id,
      date: log.dateAtService,
      mileage: log.mileageAtService,
      totalCost: null,
      logs: [log],
    });
  }
  entries.sort((a, b) => b.date.localeCompare(a.date));

  function iconFor(log: ServiceLog) {
    const rule = rules.find((r) => r.carId === carId && r.componentName === log.componentName);
    return resolveIcon({ name: log.componentName, storedKey: rule?.icon });
  }

  async function handleDeleteVisit(visitId: string) {
    if (!window.confirm(t("car.deleteVisitConfirm"))) return;
    const snapshot = { visits: store.visits, logs: store.logs };
    store.removeVisitAndLogs(visitId);
    const result = await deleteVisitAction({ carId, visitId });
    const errorKey = actionErrorKey(result);
    if (errorKey) {
      useGarageStore.setState(snapshot);
      toast.error(t(errorKey));
    } else {
      toast.success(t("car.visitDeleted"));
    }
  }

  async function handleDeleteLog(logId: string) {
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
      {entries.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("car.noLogs")}</p>
      )}
      {entries.map((entry) => (
        <Card key={entry.id}>
          <CardContent className="flex items-start justify-between">
            <div className="space-y-2">
              <div>
                <p className="font-medium">
                  {format.dateTime(new Date(entry.date), { dateStyle: "medium" })}
                  {" · "}
                  {entry.mileage.toLocaleString()} km
                </p>
                {entry.totalCost !== null && (
                  <p className="text-sm text-muted-foreground">
                    {t("car.visitTotal", {
                      amount: format.number(entry.totalCost, {
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
              <div className="flex flex-wrap gap-2">
                {entry.logs.map((log) => {
                  const Icon = iconFor(log);
                  return (
                    <Icon
                      key={log.id}
                      className="size-5 text-muted-foreground"
                      aria-label={log.componentName}
                    />
                  );
                })}
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("common.edit")}
                onClick={() => router.push(`/cars/${carId}/edit-visit/${entry.logs[0].id}`)}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("common.delete")}
                onClick={() =>
                  entry.kind === "visit"
                    ? handleDeleteVisit(entry.id)
                    : handleDeleteLog(entry.id)
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/cars/service-history.test.tsx`
Expected: PASS (all three tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/cars/service-history.tsx src/components/cars/service-history.test.tsx
git commit -m "feat: group service history into one card per visit with type icons"
```

---

## Task 9: History/Rules tabs on the car detail page

**Files:**
- Modify: `src/components/cars/rule-list.tsx`
- Modify: `src/components/cars/car-detail.tsx`
- Modify: `src/components/cars/car-detail.test.tsx`

- [ ] **Step 1: Drop the now-redundant heading from RuleList**

In `src/components/cars/rule-list.tsx`, remove this line (the tab label now serves as the section heading):
```tsx
      <h3 className="text-sm font-medium text-muted-foreground">{t("car.rules")}</h3>
```
Leave the rest of the component unchanged.

- [ ] **Step 2: Add the pill switcher to CarDetail**

In `src/components/cars/car-detail.tsx`:

Add/extend imports:
```ts
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
```
(merge `useState` into the existing `react` import; `useEffect` is already imported.)

Inside the component, after the `selectCar` line, add:
```ts
  const t = useTranslations();
  const [tab, setTab] = useState<"history" | "rules">("history");
```

Replace the two stacked sections at the bottom of the returned JSX:
```tsx
      <ServiceHistory carId={carId} />
      <RuleList carId={carId} />
```
with:
```tsx
      <div className="flex gap-2">
        {(["history", "rules"] as const).map((key) => {
          const selected = tab === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={selected}
              onClick={() => setTab(key)}
              className={cn(
                "h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors",
                selected
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {key === "history" ? t("car.history") : t("car.rules")}
            </button>
          );
        })}
      </div>
      {tab === "history" ? <ServiceHistory carId={carId} /> : <RuleList carId={carId} />}
```

- [ ] **Step 3: Update the car-detail test for tabs**

In `src/components/cars/car-detail.test.tsx`, replace the test `"shows the action buttons above the history and rules sections"` with:

```ts
  it("shows History by default and reveals Rules when its tab is selected", () => {
    useGarageStore.setState({
      rules: [
        { id: "r1", carId: carB.id, componentName: "Engine oil", intervalKm: 10000 },
      ],
    });
    render(
      <NextIntlClientProvider locale="en" timeZone="UTC" messages={en}>
        <CarDetail carId={carB.id} />
      </NextIntlClientProvider>,
    );
    // Action buttons live above the tabs and are always visible.
    expect(screen.getByRole("button", { name: /Log services/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Add rule/ })).toBeInTheDocument();
    // History tab is active by default; the rule's name is not shown yet.
    const historyTab = screen.getByRole("button", { name: "Service history" });
    expect(historyTab).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Engine oil")).not.toBeInTheDocument();
    // Switching to Rules reveals the rule list.
    fireEvent.click(screen.getByRole("button", { name: "Maintenance rules" }));
    expect(screen.getByText("Engine oil")).toBeInTheDocument();
  });
```

Add `fireEvent` to the testing-library import at the top:
```ts
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
```

The existing `"shows skeleton while isServerSyncing"` test still passes: during sync the tabs are not rendered, so `queryByText("Service history")` and `queryByText("Maintenance rules")` are both absent.

- [ ] **Step 4: Run the car-detail test**

Run: `npx vitest run src/components/cars/car-detail.test.tsx`
Expected: PASS (all tests, including the updated tab test and the unchanged skeleton/selection tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/cars/rule-list.tsx src/components/cars/car-detail.tsx src/components/cars/car-detail.test.tsx
git commit -m "feat: History/Rules tabs on the car detail page"
```

---

## Task 10: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src`
Expected: PASS, no errors.

- [ ] **Step 2: Full test suite**

Run: `npx vitest run`
Expected: PASS — all suites green, including `component-icons`, `service-history`, `car-detail`, `garage`, `standard-rules`, `schemas`.

- [ ] **Step 3: Production build (incl. service worker)**

Run: `npm run build`
Expected: build completes successfully (`next build && serwist build`).

- [ ] **Step 4: Commit any incidental fixes**

If steps 1–3 surfaced fixes, commit them:
```bash
git add -A
git commit -m "fix: verification follow-ups for visit-grouped history"
```

---

## Self-review notes (verified while writing)

- **Spec coverage:** visit-grouped flat cards (Task 8), icon row + no tooltips (Task 8), bilingual inference + wrench fallback (Task 2), stored rule icon + dropdown (Tasks 1/4/6), standard-rule default icons (Task 5), delete-whole-visit (Task 7), legacy single-log delete preserved (Task 8), History/Rules tabs default History (Task 9), i18n parity (Task 3), tests for resolver/grouping/delete/schemas/store/standard-rules (Tasks 2/4/5/7/8/9). All spec sections map to a task.
- **Type consistency:** `ComponentIconKey`/`COMPONENT_ICON_KEYS` (types.ts) used identically in component-icons, rule schema, repo, standard-rules, and rule form; `resolveIcon({name, storedKey})` signature matches all call sites; `removeVisitAndLogs(visitId)` and `deleteVisitAction({carId, visitId})` names match between definition (Task 7) and use (Task 8).
- **No placeholders:** every code step shows full code; commands include expected output.
