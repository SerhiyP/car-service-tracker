# Dashboard Car Switcher — Design

**Date:** 2026-06-11
**Status:** Approved (continue on `feature/ui-refresh-warm-minimal`)

## Problem

The dashboard's car dropdown (`src/components/dashboard/car-select.tsx`) has two
defects:

1. **Shows the car id, not the name.** Base UI's `SelectValue` renders the raw
   select value (the Mongo id) unless given a value→label mapping.
2. **Hides with ≤1 car**, so the dashboard never says which car you're viewing.

The user wants a visible list of cars (by name) instead of a dropdown.

## Design

Replace the dropdown with a **chip row switcher**.

### New component: `src/components/dashboard/car-switcher.tsx`

- Renders one pill button per car in a horizontal row:
  `flex gap-2 overflow-x-auto` (scrolls when many cars; no wrapping).
- Each chip: `<button type="button">` showing `car.name`, truncated
  (`max-w-48 truncate`), pill geometry (`h-9 shrink-0 rounded-full border
  px-4 text-sm font-medium transition-colors`).
  - Selected: `border-primary/30 bg-primary/10 text-primary`
  - Unselected: `border-border bg-card text-muted-foreground
    hover:text-foreground`
  - `aria-pressed={selected}` on every chip.
- Click → `selectCar(car.id)` from `useGarageStore` (existing action; the
  store already persists `selectedCarId`).
- **Always rendered, even with a single car** — the selected chip doubles as
  the "current car" label. Renders nothing only when there are no cars
  (dashboard already shows its own no-car state).
- Reads `cars`, `selectedCarId`, `selectCar` via individual selectors
  (matches current `car-select.tsx`; avoids full-store subscription).

### Integration

- `src/components/dashboard/dashboard.tsx`: replace the `<CarSelect />`
  element and import with `<CarSwitcher />`.
- Delete `src/components/dashboard/car-select.tsx`.

### Out of scope

- No store/server/i18n changes (car names are user data, no new strings).
- No drag-to-reorder, no car avatars/icons.

## Testing

`src/components/dashboard/car-switcher.test.tsx`, following the established
pattern (real `NextIntlClientProvider` not needed — component has no i18n;
real zustand store reset via `getInitialState()`, `afterEach(cleanup)`):

1. Renders a chip per car, by name, with `aria-pressed` reflecting selection.
2. Clicking a chip updates `useGarageStore.getState().selectedCarId`.
3. Renders nothing with zero cars; renders the single chip with one car.

## Verification

`npx vitest run`, `npx tsc --noEmit && npx eslint src`, `npm run build`,
plus a screenshot pass with the existing ephemeral-DB harness (multi-car
seed) to confirm names render and switching works.
