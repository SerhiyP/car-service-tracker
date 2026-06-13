# Visit-grouped service history, stored rule icons, tabbed car detail

**Date:** 2026-06-13
**Branch:** `visit-history-redesign`

## Problem

The service history lists one card per service log. A single visit (one
date/mileage, several components changed) spreads across several rows, with the
visit total awkwardly rendered only on the first row. The user wants one card
per visit, with small per-service type icons showing what was changed — the
visit, not the individual log, is the unit of the history.

## Decisions (from brainstorming)

- **One card per visit.** Services shown as a wrapping **row of type icons**,
  no tooltips (mobile-first). Exact names remain reachable via the editor.
- **Unknown/custom service names**: resolve the icon by **bilingual keyword
  inference**, falling back to a generic wrench.
- **Icon is also a stored, user-chosen property of the maintenance rule** — a
  dropdown in the rule form. Stored choice wins over inference.
- **Card actions**: one Edit (existing visit editor) + one Delete (removes the
  whole visit). Legacy single-log cards keep per-log delete.
- **History layout**: flat list, newest-first. No month grouping, no monthly
  totals, no visit title, no leading avatar.
- **Car detail**: two tabs — **History** (default) and **Rules** — using the
  existing dashboard pill-switcher pattern, not a new Tabs component.

## Data model

No collection redesign. One additive field:

```ts
// src/lib/types.ts
export type ComponentIconKey =
  | "oil" | "filter" | "spark" | "brake" | "belt" | "coolant"
  | "transmission" | "battery" | "tire" | "light" | "fluid" | "wrench";

export interface MaintenanceRule {
  // ...existing...
  icon?: ComponentIconKey; // optional; unset → inferred from name
}
```

`ComponentIconKey` **and** the `COMPONENT_ICON_KEYS` tuple live in
`src/lib/types.ts` (plain module, no `"use client"`) so the server-side Zod
schema and `standard-rules.ts` can import the key list without pulling in
React/Lucide. `component-icons.tsx` imports the keys from there and owns only
the icon-component mapping + resolver.

`service_logs` / `service_visits` are unchanged. Grouping happens in the view:
the store keeps the flat `logs` + `visits` it already has.

## Components & data flow

### `src/lib/component-icons.tsx` (new)

The single source of truth for icon **rendering** (the key list itself lives in
`types.ts`, see Data model).

- `iconByKey(key: ComponentIconKey): LucideIcon` — maps a key to a Lucide icon:
  `oil`→`Droplet`, `filter`→`Filter`, `spark`→`Zap`, `brake`→`CircleStop`,
  `belt`→`Cog`, `coolant`→`Snowflake`, `transmission`→`Settings2`,
  `battery`→`BatteryCharging`, `tire`→`CircleDot`, `light`→`Lightbulb`,
  `fluid`→`Droplets`, `wrench`→`Wrench`.
- `inferIconKey(name: string): ComponentIconKey | null` — lowercases `name` and
  scans a bilingual (EN + UK) keyword table, first match wins:

  | key | keywords (substring, lowercased) |
  |---|---|
  | oil | `oil`, `олив`, `масл` |
  | filter | `filter`, `фільтр` |
  | spark | `spark`, `свічк` |
  | brake | `brake`, `гальмів` |
  | belt | `belt`, `timing`, `ремінь`, `грм` |
  | coolant | `coolant`, `antifreeze`, `охолодж`, `антифриз` |
  | transmission | `transmission`, `трансмісій`, `коробк` |
  | battery | `battery`, `акумулятор` |
  | tire | `tire`, `tyre`, `шин`, `колес` |

  (`light`, `fluid`, `wrench` are picker-only / fallback — not inferred except
  `wrench` as the floor.)
- `resolveIcon({ name, storedKey }): LucideIcon` — `storedKey` present →
  `iconByKey(storedKey)`; else `inferIconKey(name)` → its icon; else `Wrench`.

Keyword order in the table resolves overlaps deterministically (e.g. "brake
fluid" matches `brake` before any `fluid`-style key — `brake` precedes).

### `src/components/cars/service-history.tsx` (rewrite)

Builds **history entries** from the store, newest-first:

- **Visit entry**: a `ServiceVisit` + the logs whose `visitId` matches it.
  Sort key = visit `dateAtService`.
- **Legacy entry**: a single log with no `visitId`. Sort key = its
  `dateAtService`.

Per card:
- Heading line: `format.dateTime(date, {dateStyle:"medium"}) · mileage km`.
- Visit total (if `visit.totalCost != null`), formatted exactly as today.
- A wrapping `flex` row of icons — one per log in the entry. Each icon resolved
  via `resolveIcon({ name: log.componentName, storedKey: ruleIconFor(name) })`,
  where `ruleIconFor` looks up the car's rule by `componentName` and returns its
  `icon`. Icons are small, monochrome, `aria-label`ed with the component name
  for a11y.
- Edit button → `router.push('/cars/${carId}/edit-visit/${firstLog.id}')`
  (editor already resolves the whole visit by `visitId`; converts legacy on
  save). Unchanged route/editor.
- Delete button:
  - Visit entry → `handleDeleteVisit(visit.id)` (confirm
    `car.deleteVisitConfirm`).
  - Legacy entry → existing `deleteLogAction` path (confirm
    `car.deleteLogConfirm`).

### `src/components/cars/car-detail.tsx`

Replace the stacked `<ServiceHistory>` + `<RuleList>` with a two-pill
segmented switcher (local `useState<"history" | "rules">`, default
`"history"`) styled like `CarSwitcher` (rounded-full buttons, `aria-pressed`),
rendering the active panel below. Skeleton state keeps showing both stubbed
sections.

### `src/components/cars/rule-form-dialog.tsx`

Add an optional **icon dropdown** (`Select` from `components/ui/select.tsx`).
Options = `COMPONENT_ICON_KEYS`, each rendering its icon + the translated
`componentIcons.<key>` name; an explicit "auto / none" choice leaves `icon`
unset. Default value = `rule?.icon`. Wired through both the optimistic update
and non-optimistic create paths (include `icon` in the action payload and the
`upsertRule` object). Base UI `Select` `onValueChange` may pass `null` — treat
that as unset.

## Actions, schemas, repositories

### Delete a whole visit

- `src/lib/repositories/logs.ts`: add
  `deleteLogsByVisitId(visitId, carId): Promise<number>`.
- `src/lib/schemas/visit.ts`: add
  `visitDeleteSchema = z.object({ carId: objectIdSchema, visitId: objectIdSchema })`.
- `src/actions/visits.ts`: add `deleteVisitAction` (`authActionClient`):
  ownership check via `getCar`; `getVisit` (404 `errors.notFound` if missing);
  `deleteLogsByVisitId`; `deleteVisit`. Returns `{ ok: true }`.
- `src/stores/garage.ts`: add `removeVisitAndLogs(visitId)` —
  `{ visits: visits.filter(v=>v.id!==visitId), logs: logs.filter(l=>l.visitId!==visitId) }`.
- View flow (optimistic, per convention): snapshot `{visits, logs}` → apply
  `removeVisitAndLogs` → call action → on `actionErrorKey`, restore snapshot +
  `toast.error`.

### Rule icon persistence

- `src/lib/schemas/rule.ts`: add `icon: z.enum(COMPONENT_ICON_KEYS).optional()`
  to `ruleInputSchema` and `ruleUpdateSchema`.
- `src/lib/repositories/rules.ts`: `RuleDoc` gains `icon?: ComponentIconKey`;
  `toRule`, `createRule`, `createRules`, `updateRule` carry it through using the
  existing conditional-spread pattern (`...(icon !== undefined && { icon })`).
- `src/actions/rules.ts`: pass `icon` through create/update.

### Standard rules

- `src/lib/standard-rules.ts`: each `STANDARD_RULES` entry gets a default
  `icon` (e.g. `engineOil`→`oil`, `airFilter`/`cabinFilter`/`fuelFilter`→`filter`,
  `sparkPlugs`→`spark`, `brake*`→`brake`, `brakeFluid`→`fluid`,
  `timingBelt`→`belt`, `coolant`→`coolant`, `transmissionOil`→`transmission`,
  `battery`→`battery`). `StandardRule` and `StandardRuleResolved` gain
  `icon?`; `resolveStandardRules` includes it. `addStandardRulesAction` passes
  it to `createRules`.

## i18n (both `en.json` and `uk.json`, identical key sets)

- `car.icon` — picker label (e.g. "Icon", "Іконка").
- `car.iconAuto` — the "auto / none" option label.
- `car.deleteVisitConfirm` — "Delete this visit and all its services?"
- `car.visitDeleted` — delete success toast.
- `componentIcons.<key>` — a name per the 12 catalog keys (for option text /
  aria-labels).

## Error handling

- `deleteVisitAction` returns `errors.notFound` for a missing car/visit;
  translated client-side via `actionErrorKey` (existing pattern).
- Optimistic visit delete rolls back the full `{visits, logs}` snapshot on
  failure and shows a toast.
- Unknown icon key from storage cannot occur (enum-validated on write); the
  resolver still defaults to `Wrench` defensively.

## Testing

- `src/lib/component-icons.test.ts` — pure-function unit tests: stored key wins
  over inference; EN and UK keyword inference for each mapped key; `brake fluid`
  resolves to `brake`; unmatched name → `wrench`.
- `src/components/cars/service-history.test.tsx` — component test following the
  `delete-account-dialog.test.tsx` pattern (real `NextIntlClientProvider` + en
  catalog, mocked store/actions): a multi-service visit renders one card with N
  icons; a legacy log renders its own card; delete-visit triggers
  `removeVisitAndLogs` + `deleteVisitAction` and rolls back on error.
- `src/components/cars/car-detail.test.tsx` — extend for the History/Rules
  switcher (default History, switching reveals Rules).
- Rule-form icon picker exercised in the rule-form flow (dropdown selects a key;
  payload carries `icon`).

## Out of scope (considered, rejected)

- Month grouping and per-month totals (kept flat list).
- Visit title/category field and leading category avatar.
- A generic Base UI Tabs component (reused the pill-switcher pattern instead).
- Per-service delete within a multi-service card (removal is via the editor's
  uncheck, or deleting the whole visit).
