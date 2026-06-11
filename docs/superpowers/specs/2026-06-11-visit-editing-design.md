# Visit editing, dashboard noise reduction, README demo link — design

Date: 2026-06-11
Branch: `feat/visit-editing`
Builds on: batch service logging (#4) — visits are the only logging path.

## Problems

1. A saved visit cannot be corrected — wrong date, missed item, typo'd cost
   or mileage means delete-and-relog every entry.
2. The dashboard shows a status card for every rule, including ones never
   serviced — noise when many standard rules were added but only a few are
   actively tracked.
3. The README doesn't link to the live demo.

## Decisions (confirmed with user)

- Visit editing covers **date, mileage, total cost, and the set of
  services** in one editor.
- **Legacy logs (no `visitId`) convert on edit**: saving an edited legacy
  row creates a visit, attaches the entry, deletes the legacy log.
- Dashboard **auto-hides never-serviced rules** (no manual toggles); a
  muted hint shows how many are hidden.
- README gains a **Demo** link: `https://car-service-tracker-flame.vercel.app/`.

## 1. Visit editing

### UI

- `src/components/cars/service-history.tsx`: each row gains a pencil
  button (ghost icon, before the existing delete) opening the editor.
- New `src/components/cars/edit-visit-dialog.tsx`, layout identical to
  `LogVisitDialog` (checkbox list + date + mileage + cost), prefilled:
  - **Visit-backed row**: checkboxes pre-check the visit's current
    components; date/mileage/cost from the visit.
  - **Legacy row**: that one component checked; date/mileage from the log;
    cost empty.
- The checkbox list shows the union of the car's rules and the edited
  visit's current components — a component whose rule was deleted can
  still be kept or unchecked, it just can't be re-added once removed.
- Submit label: existing `car.logVisitSubmit` ("Log selected ({count})") is
  wrong here; new key `car.saveVisit` ("Save changes ({count})"), disabled
  at 0 selected or while busy.
- Saving is **non-optimistic** (added logs need server ids): busy state,
  apply server result, success toast, close. Errors toast via
  `actionErrorKey`, dialog stays open.

### Server

New `updateVisitAction` in `src/actions/visits.ts`, input
(`src/lib/schemas/visit.ts`):

```
visitUpdateSchema = {
  carId: objectId,
  target: { visitId: objectId } | { logId: objectId },  // discriminated
  componentNames: string[] (1..100, trimmed, each 1..100 chars),
  mileageAtService: mileage,
  dateAtService: coerced date, not in future (+1d tolerance),
  totalCost?: number 0..99,999,999   // absent = visit has no cost
}
```

Flow (all ownership-checked via `getCar`):

- Resolve the target:
  - `visitId`: load the visit (404 if not found for this car) and its logs.
  - `logId`: load the legacy log (404 if missing or it has a `visitId` —
    visit-backed rows must be edited via their visit). Create a visit from
    the input, delete the legacy log. Its component participates in the
    diff below like any other.
- Validate `componentNames` ⊆ (car's rule names ∪ the target's current
  component names); else `ActionError("errors.notFound")`.
- Diff-sync logs (dedupe input first):
  - delete logs whose component is no longer selected,
  - insert logs for newly selected components,
  - update remaining logs' `mileageAtService`/`dateAtService`.
- Update the visit doc: date, mileage, `totalCost` set or **unset** ($unset
  when absent — clearing the field in the form clears the stored cost).
- Mileage rule unchanged from creation: raise the car's mileage if the
  edited visit mileage exceeds it; never lower it.
- Return `{ visit, logs, newCarMileage }` — `logs` is the visit's complete
  post-edit log set.

No compensating-delete subtleties on the legacy path: create the visit
first, then delete the legacy log last, so a mid-flight failure leaves the
original log intact at worst alongside an orphan visit (same accepted
non-transactional stance as creation, which compensates only the common
case).

Repository additions:

- `src/lib/repositories/visits.ts`: `getVisit(visitId, carId)`,
  `updateVisit({visitId, carId, dateAtService, mileageAtService,
  totalCost?})` (unsets `totalCost` when undefined).
- `src/lib/repositories/logs.ts`: `getLog(logId, carId)`,
  `listLogsByVisitId(visitId, carId)`, `deleteLogsByVisitIdAndComponents`,
  `updateLogsByVisitId(visitId, carId, {mileageAtService, dateAtService})`.

### Store

`src/stores/garage.ts`: `applyVisitUpdate(visit, logs)` — upserts the
visit and replaces all logs carrying that `visitId` (and, for a converted
legacy log, removes it by id: the action's returned log set is
authoritative, so the implementation replaces by `visitId` and removes the
edited legacy log id passed by the dialog). Rollback is not needed —
the save is non-optimistic.

## 2. Dashboard auto-hide

`src/components/dashboard/dashboard.tsx`:

- Split `carRules` into serviced (has a log for that component via
  `latestLogFor`) and unserviced.
- Status cards render only for serviced rules.
- When `unserviced.length > 0`, render one muted line under the cards:
  `dashboard.hiddenRules` — "{count, plural, one {# item} other {# items}}
  not serviced yet" — as a `Link` to `/cars/{carId}`.
- All rules unserviced → no cards, just the hint (replaces today's case
  where every rule shows "Never serviced").
- The existing `noRules` empty state (zero rules at all) is unchanged.

`computeMaintenance` and `StatusCard` are untouched — "Never serviced"
remains in the code path but is no longer reachable from the dashboard;
it stays because `computeMaintenance` is shared and the status still
renders inside future surfaces if needed. (If the i18n key
`dashboard.neverServiced` becomes unreferenced, it is removed with both
locales kept in sync.)

## 3. README

Add under the intro paragraph:

```md
**Demo:** <https://car-service-tracker-flame.vercel.app/>
```

## i18n

New keys in both `en.json` and `uk.json` (identical key sets):
`car.editVisit` (dialog title, "Edit service entry"), `car.saveVisit`
("Save changes ({count})"), `car.visitUpdated` ("Entry updated"),
`dashboard.hiddenRules` (plural, see above), plus `common.edit` already
exists for the pencil aria-label. Remove `dashboard.neverServiced` only if
it ends up unreferenced.

## Testing

- Schema tests: `visitUpdateSchema` — both target variants, bad ids,
  empty components, cost bounds.
- `EditVisitDialog` component tests (pattern: `log-visit-dialog.test.tsx`):
  prefill from visit; prefill from legacy log; diff submit payload
  (target + components + fields); cost cleared → no `totalCost` in payload;
  store updated from result (visit replaced, logs replaced, legacy log
  removed); failure keeps store and stays open.
- Dashboard test: serviced rules render cards, unserviced are hidden,
  hint shows correct count and link, all-unserviced shows hint only.
- Done = `npx vitest run`, `npx tsc --noEmit && npx eslint src`,
  `npm run build` all pass.

## Out of scope (YAGNI)

- Moving a visit to another car; merging or splitting visits.
- Manual per-rule hide toggles or a "show hidden" dashboard expander.
- Editing a single log's component name in place (handled by uncheck+check
  of a different component).
- History pagination/grouping changes.
