# Loading Indicators & Garage Page Redesign

**Date:** 2026-06-11  
**Status:** Approved

## Problem

Users see no feedback in three distinct situations:
1. Opening the app cold — blank/partial content appears before data loads
2. Submitting forms — buttons go gray with no spinner; feels like a freeze
3. The Garage page car cards are small and show minimal information

## Scope

- Pre-hydration splash screen (HTML layer, before React mounts)
- Per-page skeleton loading tied to server sync state
- Button loading spinner
- Garage page car card redesign with richer data
- Danger zone moved to bottom as a subtle link

---

## 1. Pre-hydration Splash Screen

**Goal:** Show branded content from the first paint until React is interactive, covering the gap between server HTML render and client hydration.

**Implementation:**

Add a fixed full-screen overlay div directly inside `<body>` in `src/app/layout.tsx`, before `<SerwistProvider>`. It contains the PWA icon (`/public/icons/icon-192.png`) centered on the page background color.

A minimal `SplashRemover` client component (one `useEffect` that calls `document.getElementById('app-splash')?.remove()`) is placed inside `<body>` in the root layout. React renders the page content behind the splash (z-index: 9999); once the first `useEffect` tick fires after hydration, the splash fades out and is removed, revealing the already-rendered page underneath. This avoids the gap that a `DOMContentLoaded` inline script would cause (that event fires before React hydrates).

The splash background uses the same CSS custom property as `--background` (light: `oklch(0.98 0.004 85)`, dark handled via `prefers-color-scheme` media query in the inline style). No Tailwind classes — must be plain CSS since Tailwind is not available at this layer.

```
Splash structure:
  <div id="app-splash">         ← fixed, full-screen, z-index: 9999
    <img src="/icons/icon-192.png" width="96" height="96" />
  </div>
  <script>/* remove on DOMContentLoaded */</script>
```

The splash div is server-rendered HTML — no JavaScript required to show it, only to remove it.

---

## 2. Per-page Skeleton Loading (isServerSyncing)

**Goal:** Show skeletons on all pages during the ~200–500 ms server action round-trip after localStorage hydration.

**Store change (`src/stores/garage.ts`):**

Add `isServerSyncing: boolean` to `GarageState`. Starts `true`. Never persisted. Set to `false` in two places inside `GarageProvider`:
- After `setAll()` resolves (success path)
- In the `catch` block (offline path — fall through to cached data)

This flag is explicitly **not** `hasHydrated` (which fires on localStorage read and is near-instant). It represents "has the server responded at least once."

**GarageProvider (`src/components/garage-provider.tsx`):**

After the action resolves or fails, call `store.setIsServerSyncing(false)`. The `online` re-fetch handler does not reset `isServerSyncing` back to `true` — reconnect refreshes are silent background updates, not full loading states.

**Affected components:**

| Component | Skeleton shape |
|---|---|
| `Dashboard` | Replace `!hasHydrated` check with `isServerSyncing`. Keep existing 3-block skeleton unchanged. |
| `CarList` | When `isServerSyncing`: two `Card`-height skeletons + one button-height skeleton |
| `CarDetail` | When `isServerSyncing`: full-page skeleton (see below). `ServiceHistory` and `RuleList` never render until sync is done — their "no records" empty states will not flash. |

**`CarDetail` skeleton shape when `isServerSyncing`:**
```
h-8 w-48        ← car name placeholder
h-4 w-24        ← mileage placeholder
h-10 w-full     ← "Log services" button
h-10 w-full     ← "Add rule" / "Standard rules" row
h-4 w-32        ← "Service history" heading
h-14 w-full     ← log row
h-14 w-full     ← log row
h-4 w-32        ← "Maintenance rules" heading
h-14 w-full     ← rule row
h-14 w-full     ← rule row
```

`hasHydrated` is removed from all loading checks once `isServerSyncing` covers the same ground more accurately. (`hasHydrated` itself stays in the store as it is still used as a guard in `setAll` to preserve `selectedCarId`.)

---

## 3. Button Loading Spinner

**Goal:** Give users clear feedback that a form submission is in flight.

**`src/components/ui/button.tsx` change:**

Add `loading?: boolean` prop to the `Button` wrapper. When `loading` is true:
- Render `<Loader2 className="animate-spin" />` as the first child (before the button's label text)
- Force `disabled={true}` (so it stacks with any existing `disabled` prop)
- The existing `disabled:opacity-50` style already handles the visual dim — no additional CSS needed

The `loading` prop is passed through only if truthy; when `false`/`undefined` the button is identical to today.

**Forms updated (pass `loading={busy}`):**

- `LogVisitDialog` — submit button
- `EditVisitDialog` — submit button
- `CarFormDialog` — submit button
- `RuleFormDialog` — submit button
- `StandardRulesDialog` — submit button
- `MileageForm` — submit button
- `DeleteAccountDialog` — already uses `isExecuting`; pass as `loading={isExecuting}`

---

## 4. Garage Page — Car Card Redesign

**Goal:** Make each car card feel more informative at a glance.

**Card layout (replaces current `car-list.tsx` card body):**

```
┌───────────────────────────────────┐
│  Car Name                  ✏️  🗑️ │  ← name bold, actions top-right
│  288,025 km                        │  ← mileage, slightly muted
│  ─────────────────────────────── │
│  5 rules  ·  Last: 12 Jan 2025  ·  2 due  │  ← stats row
└───────────────────────────────────┘
```

**Stats row data (computed inline in `CarList` from store):**

- **Rules count**: `rules.filter(r => r.carId === car.id).length` — show "N rules" or "no rules"
- **Last service date**: most recent `log.dateAtService` across all logs for this car — formatted as short locale date; "Never" if no logs
- **Due/overdue count**: count of rules where `computeMaintenance(...).status` is `"red"` or `"yellow"`, using current logs and mileage. Display logic: if any rule is `"red"`, show a single red badge with the red count ("N overdue"); else if any rule is `"yellow"`, show a single amber badge with the yellow count ("N due"); nothing if all green. Only one badge shown at a time — the most severe wins.

The entire card content area (minus the icon buttons) remains a `<Link href={/cars/${car.id}}>` for navigation.

Card padding increases from current compact size to `p-4` with `gap-3` between rows to make it more tappable on mobile.

**i18n keys needed** (add to both `en.json` and `uk.json`):
- `garage.lastService` — "Last: {date}"
- `garage.neverServiced` — "Never serviced"
- `garage.dueCount` — "{count} due"
- `garage.overdueCount` — "{count} overdue"

---

## 5. Danger Zone Redesign

**Goal:** Remove the prominent red-bordered section; keep the action accessible but unobtrusive.

**Current:** `DeleteAccountDialog` renders itself as a `<section>` with a red border and "Danger zone" heading, placed inline in the Garage page content flow.

**New:** Remove the self-contained section wrapper from `DeleteAccountDialog`. The component renders only the Dialog + DialogTrigger. In `GaragePage` (`src/app/(app)/cars/page.tsx`), render `<DeleteAccountDialog />` at the bottom of the page, wrapped in a `<div className="pt-8 text-center">`. The trigger button becomes `variant="ghost"` with `size="sm"` and `className="text-muted-foreground text-xs"` — a small, low-contrast text link. No heading, no border, no red color.

---

## Architecture Notes

- No new files needed for loading state — the flag lives in the existing store
- `GarageProvider` remains the single place that triggers data fetch; no other component calls `getGarageDataAction`
- Skeleton components use the existing `<Skeleton>` primitive from `src/components/ui/skeleton.tsx`
- The splash screen is the only place raw CSS is written outside Tailwind; keep it minimal (3–4 rules)
- `computeMaintenance` is already used in the Dashboard — import it in `CarList` too; no duplication

## Testing

- Existing component tests for `Dashboard`, `CarList`, `CarDetail` will need to set `isServerSyncing: false` in their store setup (they currently set `hasHydrated: true` — same pattern)
- `Button` loading prop: tested via the existing form component tests (pass `loading={true}` and assert spinner is present, submit is disabled)
- Splash screen: not unit-tested (it's an inline HTML/CSS fragment with no logic)
- Garage card stats: pure derived data from the store, covered by integration tests on `CarList`
