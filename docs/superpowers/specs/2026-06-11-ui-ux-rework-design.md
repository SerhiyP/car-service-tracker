# UI/UX Rework: Bottom Nav Actions, Car-Details Reorder, Dashboard Polish

**Date:** 2026-06-11
**Status:** Approved

## Goal

Make the two most common actions — logging a service visit and reaching the
selected car's details — available from anywhere via the bottom nav, reorder
the car-details page so actions and history lead, and polish the dashboard
(urgency-sorted cards, compact mileage form).

## Decisions made during brainstorming

- **Service-name language stays as-is.** Standard-rule names are baked into
  `componentName` at pick time in the locale active at that moment; no live
  translation, no migration, no rename.
- Visit entry point and car-details shortcut both live in the **bottom nav**
  (user preference over in-page buttons).
- Out of scope: grouping service history by visit, dashboard summary strip,
  header cleanup.

## 1. Bottom nav — 4 items

File: `src/components/bottom-nav.tsx` (already a client component).

Items, left to right:

| Item | Kind | Icon (lucide) | Target / action |
|---|---|---|---|
| Dashboard | link | `LayoutDashboard` | `/` |
| Log | **button** | `Wrench` | opens `LogVisitDialog` for the selected car, no preselection |
| Car | link | `CarFront` | `/cars/<selectedCarId>` |
| Garage | link | `Warehouse` | `/cars` |

Behavior:

- Nav reads `cars` and `selectedCarId` from `useGarageStore`.
- **Log** is disabled (muted, non-interactive) when there is no car or the
  selected car has no maintenance rules. The dialog is rendered by the nav
  itself with local `open` state, `car` = selected car,
  `preselectedComponent` omitted.
- **Car** is disabled when no car exists. Active when `pathname` equals
  `/cars/<selectedCarId>`.
- **Garage** active check changes from `startsWith("/cars")` to exact
  `pathname === "/cars"` so Car and Garage never both highlight.
- **Selection sync:** the car-details page (`car-detail.tsx`) sets
  `selectedCarId` to the viewed car on mount (and when the id changes), so
  the Car tab, dashboard, and Log dialog always follow the car being viewed.
- New i18n keys `nav.log`, `nav.car` added to **both** `src/messages/en.json`
  and `src/messages/uk.json` (identical key sets, per convention).

## 2. Car details — section reorder

File: `src/components/cars/car-detail.tsx`.

New order:

```
Car name — current mileage
[ Log services ]                 ← primary (default variant), full width
[ Add rule ] [ Add standard ]    ← outline, two-column grid
Service history (list)
Maintenance rules (list)
```

- The three action buttons and their dialog open-state
  (`LogVisitDialog`, `RuleFormDialog` in create mode, `StandardRulesDialog`)
  are lifted into `car-detail.tsx` (or a small `CarActions` child component).
- `ServiceHistory` loses its header "Log services" button; `RuleList` loses
  its bottom button grid. Both become pure lists. Per-item edit/delete (and
  the edit-mode `RuleFormDialog` / `EditVisitDialog`) stay inside them.

## 3. Dashboard — urgency-sorted status cards

- Cards ordered: overdue → due soon → OK; ties broken by least remaining
  (minimum of km-fraction/days-fraction remaining, "never serviced" treated
  per current status logic).
- Sorting/severity-rank helper lives in `src/lib/maintenance.ts` alongside
  the existing status computation, with unit tests.
- `dashboard.tsx` applies the helper before rendering `StatusCard`s.

## 4. Dashboard — compact mileage form

File: `src/components/dashboard/mileage-form.tsx`.

- Default (collapsed) state: one line — label, formatted current mileage
  ("287,000 km"), pencil icon button.
- Tapping the pencil expands to the existing number input + Update button,
  input autofocused.
- Collapses back on successful update or on Escape/cancel; stays expanded on
  failed update so the value can be corrected.
- Reuses existing update action/optimistic behavior unchanged; any new
  user-facing strings get keys in both message catalogs.

## Error handling

No new server actions or error paths. The Log dialog reuses
`createVisitAction` and its existing `actionErrorKey` toast handling.
Disabled nav states prevent opening the dialog with no car/rules.

## Testing

Component tests follow the `src/components/auth/verify-form.test.tsx`
pattern (real `NextIntlClientProvider` + en catalog, `vi.hoisted` mocks):

- **bottom-nav**: renders 4 items; Log disabled with no car; Log opens the
  dialog when a car with rules is selected; Garage not active on
  `/cars/<id>`.
- **mileage-form**: collapsed by default; expands on pencil tap; collapses
  after successful update.
- **maintenance sort helper**: unit tests for ordering across overdue /
  due-soon / OK and tie-breaking.

Done gate: `npx vitest run`, `npx tsc --noEmit`, `npx eslint src`,
`npm run build`.
