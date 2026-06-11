# Standard Maintenance Rules Picker — Design

**Date:** 2026-06-11
**Status:** Approved

## Problem

After adding a car, users must create every maintenance rule from scratch.
Most cars share the same core service items (oil, filters, brakes, timing
belt…), so the app should offer a standard set the user can add in one step.

## Decision Summary

- A **picker dialog** with the standard set, reachable from two entry points:
  an "Add standard rules" button in the rules section and a callout in the
  rules empty state. Works for new and existing cars.
- All items pre-checked; items whose component name already exists on the car
  are unchecked and disabled with an "already added" hint.
- Names are i18n keys at display time but stored as **plain strings in the
  user's current UI locale** at insertion (matches the existing free-text
  `componentName` model).

## Standard Set (14 items)

| key | en name | km | months |
|---|---|---|---|
| engineOil | Engine oil + oil filter | 10 000 | 12 |
| airFilter | Air filter | 30 000 | 24 |
| cabinFilter | Cabin filter | 15 000 | 12 |
| fuelFilter | Fuel filter | 30 000 | — |
| sparkPlugs | Spark plugs | 60 000 | — |
| brakePadsFront | Brake pads (front) | 40 000 | — |
| brakePadsRear | Brake pads (rear) | 60 000 | — |
| brakeDiscsFront | Brake discs (front) | 80 000 | — |
| brakeDiscsRear | Brake discs (rear) | 100 000 | — |
| brakeFluid | Brake fluid | 40 000 | 24 |
| timingBelt | Timing belt | 90 000 | 60 |
| coolant | Coolant (antifreeze) | 60 000 | 48 |
| transmissionOil | Transmission oil | 60 000 | — |
| battery | Battery | — | 60 |

Ukrainian names live in `uk.json` (e.g. timingBelt → «Ремінь ГРМ»). Intervals
are conservative defaults; users edit rules afterwards like any other rule.

## Architecture

### `src/lib/standard-rules.ts` (new)

```ts
export const STANDARD_RULES = [
  { key: "engineOil", intervalKm: 10000, intervalMonths: 12 },
  // …14 entries
] as const;
export type StandardRuleKey = (typeof STANDARD_RULES)[number]["key"];
```

No display names in the constant — each `key` maps to i18n messages under
`standardRules.<key>` in `src/messages/en.json` and `uk.json` (identical key
sets, per project convention).

### Server action — `addStandardRulesAction` (`src/actions/rules.ts`)

- `authActionClient`, input `{ carId: string, keys: string[] }`.
- Zod validates `keys` against the known `StandardRuleKey` set (min 1,
  deduplicated) — arbitrary strings are rejected.
- Ownership check via `ownsCar(carId, ctx.userId)`; throws
  `ActionError("car.notFound")` (same key as `createRuleAction`) on failure.
- Resolves names server-side with next-intl `getTranslations` for the request
  locale (`standardRules` namespace).
- Skips keys whose resolved name already exists on the car
  **case-insensitively** (compare against existing rules' `componentName`).
- Bulk-inserts the rest via new repository function; returns the created
  `MaintenanceRule[]`.

### Repository — `createRules` (`src/lib/repositories/rules.ts`)

`createRules(carId: string, inputs: RuleInput[]): Promise<MaintenanceRule[]>`
— `insertMany` into `maintenance_rules`, ObjectId↔string conversion at the
boundary, same shape as existing `createRule`. Returns `[]` for empty input
without hitting the driver.

### UI — `src/components/cars/standard-rules-dialog.tsx` (new)

- Dialog (shadcn/Base UI — `render={...}`, not `asChild`) listing the 14
  items: translated name + interval summary + checkbox.
- Pre-checked by default; entries matching an existing rule name
  (case-insensitive) are unchecked and disabled with an "already added" hint.
- Submit calls `addStandardRulesAction` with the checked keys via `useAction`.
  Non-optimistic (creates need server ids): on success → toast + close +
  `router.refresh()`; on error → toast via `actionErrorKey`.
- Entry points (rules section of the dashboard):
  - "Add standard rules" secondary button next to the existing "Add rule"
    button.
  - The rules empty state mentions/offers the same dialog.

### i18n additions (`en.json` + `uk.json`)

- `standardRules.*` — the 14 component names.
- Dialog strings: title, description, submit button (with count), "already
  added" hint, success toast.

## Error Handling

- Unknown keys → Zod validation failure (never reaches the DB).
- Foreign/unknown `carId` → `ActionError("car.notFound")`.
- All selected items already exist → action succeeds with an empty result;
  dialog UI prevents this case by disabling existing items, but the server
  tolerates it (no error, nothing inserted).

## Testing

- `standard-rules-dialog.test.tsx` — follows `verify-form.test.tsx` pattern
  (real `NextIntlClientProvider` + en catalog, `vi.hoisted` mocks, mocked
  `useAction`): renders all items, disables existing ones, submits selected
  keys, handles success/error.
- Unit test for the action input schema (rejects unknown keys, requires ≥1)
  and for the case-insensitive skip logic.
- Full gate: `npx vitest run`, `npx tsc --noEmit && npx eslint src`,
  `npm run build`.

## Out of Scope

- Auto-seeding on car creation (rejected in favor of explicit picker).
- Per-fuel-type/engine variants of the set (e.g. diesel-specific intervals).
- Translating existing stored rule names when the UI locale changes.
