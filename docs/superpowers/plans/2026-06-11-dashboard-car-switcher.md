# Dashboard Car Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dashboard's car dropdown (which renders the raw car id) with an always-visible chip row showing car names.

**Architecture:** New presentational client component `CarSwitcher` reads `cars`/`selectedCarId`/`selectCar` from the existing zustand garage store via individual selectors; `dashboard.tsx` swaps one element; the buggy `car-select.tsx` is deleted. No store, server, or i18n changes. Spec: `docs/superpowers/specs/2026-06-11-dashboard-car-switcher-design.md`. Work on the existing `feature/ui-refresh-warm-minimal` branch.

**Tech Stack:** Next.js 16, React 19, zustand, Tailwind v4 tokens (warm/blue from this branch), Vitest + Testing Library (pattern: real store reset via `getInitialState()`, `afterEach(cleanup)`).

---

### Task 1: CarSwitcher component (TDD) + dashboard integration

**Files:**
- Test: `src/components/dashboard/car-switcher.test.tsx` (create)
- Create: `src/components/dashboard/car-switcher.tsx`
- Modify: `src/components/dashboard/dashboard.tsx:12,64`
- Delete: `src/components/dashboard/car-select.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/dashboard/car-switcher.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useGarageStore } from "@/stores/garage";
import { CarSwitcher } from "./car-switcher";

const car = (id: string, name: string) => ({
  id,
  name,
  currentMileage: 10000,
  updatedAt: new Date().toISOString(),
});

afterEach(cleanup);

beforeEach(() => {
  useGarageStore.setState(useGarageStore.getInitialState());
});

describe("CarSwitcher", () => {
  it("renders a chip per car with aria-pressed on the selected one", () => {
    useGarageStore.setState({
      cars: [car("c1", "Honda Civic"), car("c2", "BMW E46")],
      selectedCarId: "c1",
    });
    render(<CarSwitcher />);
    expect(screen.getByRole("button", { name: "Honda Civic" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "BMW E46" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("selects a car on click", () => {
    useGarageStore.setState({
      cars: [car("c1", "Honda Civic"), car("c2", "BMW E46")],
      selectedCarId: "c1",
    });
    render(<CarSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "BMW E46" }));
    expect(useGarageStore.getState().selectedCarId).toBe("c2");
  });

  it("renders nothing with zero cars and a single chip with one car", () => {
    const { container } = render(<CarSwitcher />);
    expect(container).toBeEmptyDOMElement();
    cleanup();
    useGarageStore.setState({
      cars: [car("c1", "Honda Civic")],
      selectedCarId: "c1",
    });
    render(<CarSwitcher />);
    expect(
      screen.getByRole("button", { name: "Honda Civic" }),
    ).toBeInTheDocument();
  });
});
```

Adapt the `car()` factory only if `Car` in `src/lib/types.ts` differs (check it; `updatedAt` ISO string was required by `car-list.test.tsx`). If the store's select action isn't named `selectCar`, check `src/stores/garage.ts` — `car-select.tsx` currently calls `s.selectCar`, so it should be.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/dashboard/car-switcher.test.tsx`
Expected: FAIL — cannot resolve `./car-switcher`.

- [ ] **Step 3: Implement the component**

Create `src/components/dashboard/car-switcher.tsx`:

```tsx
"use client";

import { useGarageStore } from "@/stores/garage";
import { cn } from "@/lib/utils";

export function CarSwitcher() {
  const cars = useGarageStore((s) => s.cars);
  const selectedCarId = useGarageStore((s) => s.selectedCarId);
  const selectCar = useGarageStore((s) => s.selectCar);

  if (cars.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto">
      {cars.map((car) => {
        const selected = car.id === selectedCarId;
        return (
          <button
            key={car.id}
            type="button"
            aria-pressed={selected}
            onClick={() => selectCar(car.id)}
            className={cn(
              "h-9 max-w-48 shrink-0 truncate rounded-full border px-4 text-sm font-medium transition-colors",
              selected
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {car.name}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/dashboard/car-switcher.test.tsx`
Expected: 3 PASS.

- [ ] **Step 5: Swap into the dashboard and delete the old select**

In `src/components/dashboard/dashboard.tsx`:
- Line 12: `import { CarSelect } from "./car-select";` → `import { CarSwitcher } from "./car-switcher";`
- Line 64: `<CarSelect />` → `<CarSwitcher />`

Then: `git rm src/components/dashboard/car-select.tsx`

- [ ] **Step 6: Full gate**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: 84 tests pass (81 + 3 new), tsc and eslint clean. A leftover `car-select` import anywhere would fail tsc — fix by removing it.

- [ ] **Step 7: Commit**

```bash
git add -A src
git commit -m "feat: replace dashboard car dropdown with named chip switcher

The Base UI SelectValue rendered the raw car id; the chip row shows
names, stays visible with one car, and scrolls with many.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Final verification (gate + visual)

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: succeeds incl. serwist service worker.

- [ ] **Step 2: Visual check with the ephemeral harness**

Reuse the harness from the UI-refresh verification (see memory note
`visual-verification-recipe`): `/tmp/ui-check/memdb.mjs` (in-memory Mongo on
:27517 with seeded `ui-check@claude.local` / `UiCheck123!`) — **add a second
car** for that user (e.g. `{ userId, name: "BMW 320d", currentMileage: 142000,
updatedAt: new Date() }`) so the switcher shows two chips. Then:

```bash
cd /tmp/ui-check && node memdb.mjs &   # wait for MEMDB_READY
MONGODB_URI_CAR="mongodb://127.0.0.1:27517/" MONGODB_DB="uicheck" npx next start -p 3100 &
```

Playwright (channel `chrome`, viewport 390×844): log in, screenshot the
dashboard (two chips, names visible, selected chip tinted blue), click the
second chip, screenshot again (selection moved, status cards switched to the
other car — second car has no rules, so the "no rules" state appearing is
correct evidence of the switch). Do NOT touch the real DB or the user's dev
server on :3000; kill both background processes afterwards.

- [ ] **Step 3: Fix anything found, re-run gate, commit**

```bash
git add -A
git commit -m "style: car switcher follow-ups from visual check"
```

(Skip if nothing changed.)
