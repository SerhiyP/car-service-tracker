# Visit Pages Design

**Date:** 2026-06-12  
**Branch:** feat/loading-indicators-garage-redesign  
**Problem:** The log-visit and edit-visit dialogs overflow on mobile — the component checklist plus form fields don't fit in a modal on small screens.  
**Solution:** Replace both dialogs with dedicated full-page routes.

---

## Routes & Files

Two new pages inside the `(app)` route group:

```
src/app/(app)/cars/[carId]/log-visit/page.tsx          — create visit
src/app/(app)/cars/[carId]/edit-visit/[logId]/page.tsx — edit visit
```

One new shared component:

```
src/components/cars/visit-form.tsx
```

Delete once pages are live:

```
src/components/cars/log-visit-dialog.tsx
src/components/cars/log-visit-dialog.test.tsx
src/components/cars/edit-visit-dialog.tsx
src/components/cars/edit-visit-dialog.test.tsx
```

---

## Page Layout

Both pages inherit the existing app layout (sticky `AppHeader` + `BottomNav`).

Page content, top to bottom:

1. **Back button row** — arrow-left icon button, left-aligned. Calls `router.back()` if `window.history.length > 1`, otherwise `router.push('/')`.
2. **Title (`h2`)** — "Log services" (create) or "Edit visit" (edit), using existing i18n keys `car.logServices` / `car.editVisit`.
3. **`VisitForm`** — scrolls naturally with the page. The `max-h-[40vh]` constraint on the checkbox list is removed entirely.

---

## Shared `VisitForm` Component

Client component. Props:

```ts
{
  listedNames: string[]        // checkbox items
  initialChecked: string[]     // pre-checked names
  initialMileage: number
  initialDate: string          // 'YYYY-MM-DD'
  initialCost?: number
  submitLabel: string          // rendered button text
  busy: boolean
  onSubmit: (values: {
    componentNames: string[]
    mileage: number
    date: string
    cost: string
  }) => void
}
```

Manages `checked` state internally. Submit button disabled when no components selected. Loading spinner via `loading={busy}` prop (matches existing `Button` API).

---

## Callsite Changes

| File | Change |
|---|---|
| `bottom-nav.tsx` | Button → `router.push('/cars/${car.id}/log-visit')`. Remove `logOpen`/`setLogOpen`, `prevCarId`/`setPrevCarId` state, `LogVisitDialog` import and render. |
| `car-actions.tsx` | Button → `router.push('/cars/${car.id}/log-visit')`. Remove `logOpen`/`setLogOpen` state, `LogVisitDialog` import and render. |
| `dashboard.tsx` | `onLogService` → `router.push('/cars/${car.id}/log-visit?component=${name}')`. Remove `logComponent` state, `LogVisitDialog` import and render. |
| `service-history.tsx` | Edit pencil → `router.push('/cars/${car.id}/edit-visit/${log.id}')`. Remove `editing` state, `EditVisitDialog` import and render. |

---

## Data Flow

### Log-visit page

- `carId` from `params` (awaited)
- `useSearchParams()` hook for the `component` query param (pre-selection; client component, not server)
- `car` and `rules` from garage store
- If `car` not found → redirect to `/`
- Manages `busy: boolean` state; passes it to `VisitForm`
- On submit: `createVisitAction` → `store.addVisit` / `store.addLog` / `store.setCarMileage` → toast success → `goBack()`
- On error: toast error, stay on page

### Edit-visit page

- `carId` and `logId` from `params` (awaited)
- Target `log`, sibling logs (same `visitId`), `car`, `rules` from garage store
- Legacy logs (no `visitId`): only the single log is pre-checked
- If `car` or `log` not found → redirect to `/`
- Pre-fills mileage/date/cost from visit (or log for legacy)
- Manages `busy: boolean` state; passes it to `VisitForm`
- On submit: `updateVisitAction` → `store.applyVisitUpdate` / `store.setCarMileage` → toast success → `goBack()`
- On error: toast error, stay on page

### Back navigation helper

```ts
function goBack(router: AppRouterInstance) {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    router.back();
  } else {
    router.push('/');
  }
}
```

Both pages use this for cancel (back button) and post-submit navigation.

---

## i18n

One new key needed (`common.back`), plus reuses existing keys:
- `car.logServices`, `car.editVisit` — page titles
- `car.logVisitDescription` — subtitle/description
- `car.serviceMileage`, `car.serviceDate`, `car.totalCost` — field labels
- `car.logVisitSubmit`, `car.saveVisit` — submit button labels
- `car.visitLogged`, `car.visitUpdated` — success toasts

Add `common.back` to both `en.json` and `uk.json`.

---

## Out of Scope

- No new tests for the page components in this change (the dialog tests are deleted; page-level tests can follow separately).
- No desktop-vs-mobile divergence — full page everywhere.
- No URL sharing / bookmarking use case to support (auth-gated app, always navigated to in-context).
