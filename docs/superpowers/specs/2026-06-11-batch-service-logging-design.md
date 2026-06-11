# Batch service logging with visit-level cost — design

Date: 2026-06-11
Branch: `feat/batch-service-logging`

## Problem

Maintenance is usually done in batches (one garage visit covers several
items), but the app only supports logging one component at a time via
`LogServiceDialog`. There is also no way to record what the work cost.

## Decisions (confirmed with user)

- Batch dialog uses **shared date + mileage** for all selected items and
  **one total cost** for the whole visit.
- Cost is a **plain number, ₴ (UAH) implied** — no currency field.
- Total cost is stored on a new **service visit** entity, not split across
  logs.
- Batch trigger lives in the **Service history header** on the car page.
- Service history rendering **stays the flat per-item list it is today** —
  no visit cards, no grouped UI. The visit total appears once, on the first
  row of a visit's group; otherwise rows look as they do now.
- Single-item logging gains its own **optional cost** field.

## Data model

New collection `service_visits` (`VisitDoc`):

| field              | type      | notes                          |
| ------------------ | --------- | ------------------------------ |
| `_id`              | ObjectId  |                                |
| `carId`            | ObjectId  | ownership scoping as elsewhere |
| `dateAtService`    | Date      |                                |
| `mileageAtService` | number    |                                |
| `totalCost`        | number?   | absent if user left it blank   |

`ServiceLog` / `LogDoc` gain two optional fields:

- `visitId?: string` — set when the log was created as part of a batch.
- `cost?: number` — used by the single-item flow only.

No migration needed; both fields are optional and absent on existing docs.

## Repositories

- New `src/lib/repositories/visits.ts`: `createVisit`, `deleteVisit`,
  `listVisitsByCarIds`. Same conventions as `rules.ts`/`logs.ts`: thin
  driver wrappers, ObjectId↔string at the boundary, all queries scoped by
  car ids the caller already verified.
- `src/lib/repositories/logs.ts`: add batch `createLogs(carId, inputs)`
  (mirrors `createRules`), include `visitId`/`cost` in doc mapping, and add
  `countLogsByVisitId` (for orphan-visit cleanup on delete).

## Server actions (`src/actions/`)

- `createVisitAction` (`authActionClient`): input
  `{ carId, componentNames: string[] (min 1), mileageAtService,
  dateAtService, totalCost? }`. Verifies car ownership, validates that each
  componentName matches one of the car's rules, creates the visit, batch-
  creates one log per component with `visitId`, and bumps the car's mileage
  if the logged mileage is higher (same as `createLogAction`). Returns the
  visit and the created logs (creates are non-optimistic — client needs
  server ids).
- `createLogAction`: schema gains optional `cost` (positive, finite,
  reasonable upper bound), stored on the log.
- `deleteLogAction`: after deleting a log that has a `visitId`, if no other
  logs reference that visit, delete the visit too (no orphan visits).
- No whole-visit delete action — history keeps per-row delete only.

Validation lives in `src/lib/schemas/log.ts` (+ a visit schema next to it).
Errors thrown as `ActionError("<i18n key>")`.

## UI

**Batch dialog** — new `src/components/cars/log-visit-dialog.tsx`, modeled
on `standard-rules-dialog.tsx`:

- Trigger: "Log services" button in the Service history section header
  (`service-history.tsx`). Hidden/disabled when the car has no rules.
- Body: checkbox row per maintenance rule (componentName), scrollable list;
  below it three shared fields — date (default today, max today), mileage
  (default car's current mileage), optional total cost (₴).
- Submit label: "Log selected ({count})", disabled at 0 selected.
- On success: add visit + logs to the store from the server response, toast.

**Single-item dialog** — `log-service-dialog.tsx` gains one optional cost
input after mileage/date.

**Service history** — flat list unchanged in structure. Additions only:

- A row with its own `cost` shows it (e.g. "· ₴450") in the muted meta line.
- The first row of each visit group (rows sharing a `visitId`, list already
  date-sorted) shows the visit total once: muted "Visit total ₴1,500".
- Per-row delete behaves as today (optimistic snapshot → rollback + toast).

Cost formatting: `Intl.NumberFormat` with UAH currency, 0–2 fraction
digits, locale-aware (en/uk).

**Store** — client store gains `visits` alongside logs (populated by the
same car-data fetch), `addVisit`, and visit removal as part of log-delete
rollback handling.

## i18n

All new strings in both `src/messages/en.json` and `uk.json` (identical key
sets): batch button + dialog title/description/submit, cost field labels,
visit-total label, success toast, `validation.costInvalid`, and any
`ActionError` keys.

## Testing

- Schema tests for the visit input (component list min 1, cost bounds,
  future-date rejection).
- Component test for `LogVisitDialog` following
  `verify-form.test.tsx` (real `NextIntlClientProvider` + en catalog,
  `vi.hoisted`, mocked `useAction`).
- Existing log-dialog test extended for the cost field.
- Done = `npx vitest run`, `npx tsc --noEmit && npx eslint src`,
  `npm run build` all pass.

## Out of scope (YAGNI)

- Per-item costs in the batch dialog.
- Currency selection or per-car currency.
- Free-text/extra work items in the batch picker (rules only).
- Grouped/card/collapsible visit rendering in history.
- Retroactive grouping of existing logs into visits.
- Cost summaries/reports (future feature; the data supports it).
