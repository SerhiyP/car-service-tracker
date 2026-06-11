# Batch service logging with visit-level cost — design

Date: 2026-06-11
Branch: `feat/batch-service-logging`

## Problem

Maintenance is usually done in batches (one garage visit covers several
items), but the app only supports logging one component at a time via
`LogServiceDialog`. There is also no way to record what the work cost.

## Decisions (confirmed with user)

- **Visits are the only way to log services.** The standalone single-log
  flow is removed; logging one item is just a visit with one component
  selected. One dialog, one action, one code path.
- Visit dialog uses **shared date + mileage** for all selected items and
  **one total cost** for the whole visit.
- Cost is a **plain number, ₴ (UAH) implied** — no currency field, and no
  per-log cost: the visit's `totalCost` is the only cost field.
- The visit dialog is triggered from the **Service history header** on the
  car page, and from the dashboard's per-component "Log service" buttons
  (which open it with that component preselected).
- Service history rendering **stays the flat per-item list it is today** —
  no visit cards, no grouped UI. The visit total appears once, on the first
  row of a visit's group; otherwise rows look as they do now.

## Data model

New collection `service_visits` (`VisitDoc`):

| field              | type      | notes                          |
| ------------------ | --------- | ------------------------------ |
| `_id`              | ObjectId  |                                |
| `carId`            | ObjectId  | ownership scoping as elsewhere |
| `dateAtService`    | Date      |                                |
| `mileageAtService` | number    |                                |
| `totalCost`        | number?   | absent if user left it blank   |

`ServiceLog` / `LogDoc` gain `visitId?: string` — set on every new log,
optional in the type only because pre-existing docs lack it. Legacy logs
without a `visitId` keep rendering in history as plain rows.

No migration needed.

## Repositories

- New `src/lib/repositories/visits.ts`: `createVisit`, `deleteVisit`,
  `listVisitsByCarIds`. Same conventions as `rules.ts`/`logs.ts`: thin
  driver wrappers, ObjectId↔string at the boundary, all queries scoped by
  car ids the caller already verified.
- `src/lib/repositories/logs.ts`: add batch `createLogs(carId, inputs)`
  (mirrors `createRules`), include `visitId` in doc mapping, and add
  `countLogsByVisitId` (for orphan-visit cleanup on delete). `createLog`
  (single) is removed with the old flow.

## Server actions (`src/actions/`)

- `createVisitAction` (`authActionClient`): input
  `{ carId, componentNames: string[] (min 1), mileageAtService,
  dateAtService, totalCost? }`. Verifies car ownership, validates that each
  componentName matches one of the car's rules, creates the visit, batch-
  creates one log per component with `visitId`, and bumps the car's mileage
  if the logged mileage is higher (as the old `createLogAction` did).
  Returns the visit and the created logs (creates are non-optimistic —
  client needs server ids).
- `createLogAction` is **removed**, along with its schema and tests; the
  visit action replaces it.
- `deleteLogAction` stays: after deleting a log that has a `visitId`, if no
  other logs reference that visit, delete the visit too (no orphan visits).
- No whole-visit delete action — history keeps per-row delete only.

Validation lives in `src/lib/schemas/visit.ts` (replacing the log input
schema). Errors thrown as `ActionError("<i18n key>")`.

## UI

**Visit dialog** — new `src/components/cars/log-visit-dialog.tsx`, modeled
on `standard-rules-dialog.tsx`, replacing `log-service-dialog.tsx`:

- Triggers:
  - "Log services" button in the Service history section header
    (`service-history.tsx`). Hidden/disabled when the car has no rules.
  - Dashboard per-component "Log service" buttons open the same dialog with
    that component's checkbox preselected (others unchecked).
- Body: checkbox row per maintenance rule (componentName), scrollable list;
  below it three shared fields — date (default today, max today), mileage
  (default car's current mileage), optional total cost (₴).
- Submit label: "Log selected ({count})", disabled at 0 selected.
- On success: add visit + logs to the store from the server response, toast.

**Service history** — flat list unchanged in structure. Addition: the first
row of each visit group (rows sharing a `visitId`, list already date-sorted)
shows the visit total once, muted, e.g. "Visit total ₴1,500" — only when the
visit has a cost. Per-row delete behaves as today (optimistic snapshot →
rollback + toast).

Cost formatting: `Intl.NumberFormat` with UAH currency, 0–2 fraction
digits, locale-aware (en/uk).

**Store** — client store gains `visits` alongside logs (populated by the
same car-data fetch), `addVisit`, and visit removal mirroring the server's
orphan cleanup when the last log of a visit is deleted (with rollback).

## i18n

All new strings in both `src/messages/en.json` and `uk.json` (identical key
sets): batch button + dialog title/description/submit, cost field label,
visit-total label, success toast, `validation.costInvalid`, and any
`ActionError` keys. Keys for the removed single-log dialog are deleted from
both files.

## Testing

- Schema tests for the visit input (component list min 1, cost bounds,
  future-date rejection).
- Component test for `LogVisitDialog` following
  `verify-form.test.tsx` (real `NextIntlClientProvider` + en catalog,
  `vi.hoisted`, mocked `useAction`), covering both the multi-select flow
  and the preselected-component (dashboard) flow.
- Tests for the removed single-log dialog/action are deleted.
- Done = `npx vitest run`, `npx tsc --noEmit && npx eslint src`,
  `npm run build` all pass.

## Out of scope (YAGNI)

- Per-item costs in the visit dialog.
- Currency selection or per-car currency.
- Free-text/extra work items in the picker (rules only).
- Grouped/card/collapsible visit rendering in history.
- Retroactive grouping of existing logs into visits.
- Editing an existing visit (delete + re-log covers it for now).
- Cost summaries/reports (future feature; the data supports it).
