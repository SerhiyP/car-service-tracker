# UI Refresh "Warm Minimal" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the app with warm neutral surfaces, a blue accent, softer geometry, and clearer hierarchy — visual-only, no logic changes.

**Architecture:** All color/radius changes flow through CSS custom properties in `globals.css`; component primitives (`src/components/ui/`) carry geometry/sizing changes; feature components get targeted markup updates (status pill, empty states, chrome). Spec: `docs/superpowers/specs/2026-06-11-ui-refresh-warm-minimal-design.md`.

**Tech Stack:** Next.js 16 (Turbopack), Tailwind CSS v4 (tokens via `@theme`/CSS vars, oklch), Base UI primitives, CVA, next-intl, Vitest + Testing Library.

**Important project rules (from AGENTS.md):**
- This is Next.js 16 — read `node_modules/next/dist/docs/` if unsure about an API; do not trust training data.
- `en.json` and `uk.json` must keep identical key sets.
- shadcn/ui here wraps **Base UI, not Radix**.
- Done = `npx vitest run` && `npx tsc --noEmit && npx eslint src` && `npm run build` all pass.
- Never use MongoDB MCP tools.

---

### Task 1: Warm design tokens + blue accent (globals.css)

**Files:**
- Modify: `src/app/globals.css:51-118`

- [ ] **Step 1: Replace the `:root` block**

Replace lines 51–84 with (chart/sidebar vars unchanged — they are currently unused; only listed lines change):

```css
:root {
  --background: oklch(0.98 0.004 85);
  --foreground: oklch(0.16 0.005 85);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.16 0.005 85);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.16 0.005 85);
  --primary: oklch(0.55 0.18 255);
  --primary-foreground: oklch(0.985 0.002 85);
  --secondary: oklch(0.955 0.004 85);
  --secondary-foreground: oklch(0.25 0.006 85);
  --muted: oklch(0.955 0.004 85);
  --muted-foreground: oklch(0.55 0.01 85);
  --accent: oklch(0.955 0.004 85);
  --accent-foreground: oklch(0.25 0.006 85);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.91 0.005 85);
  --input: oklch(0.91 0.005 85);
  --ring: oklch(0.55 0.18 255);
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --radius: 0.75rem;
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}
```

- [ ] **Step 2: Replace the `.dark` block**

Replace lines 86–118 with:

```css
.dark {
  --background: oklch(0.15 0.005 85);
  --foreground: oklch(0.97 0.003 85);
  --card: oklch(0.2 0.005 85);
  --card-foreground: oklch(0.97 0.003 85);
  --popover: oklch(0.2 0.005 85);
  --popover-foreground: oklch(0.97 0.003 85);
  --primary: oklch(0.65 0.16 255);
  --primary-foreground: oklch(0.985 0.002 85);
  --secondary: oklch(0.26 0.006 85);
  --secondary-foreground: oklch(0.97 0.003 85);
  --muted: oklch(0.26 0.006 85);
  --muted-foreground: oklch(0.7 0.01 85);
  --accent: oklch(0.26 0.006 85);
  --accent-foreground: oklch(0.97 0.003 85);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.65 0.16 255);
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.556 0 0);
}
```

- [ ] **Step 3: Verify nothing broke**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: all pass (token-only change).

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "style: warm neutral tokens, blue accent, 0.75rem radius"
```

---

### Task 2: Card primitive — border + shadow, rounded-2xl, more breathing room

**Files:**
- Modify: `src/components/ui/card.tsx:15,28,87`

- [ ] **Step 1: Update `Card` root classes (line 15)**

Replace the long className string in `Card` with:

```
"group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-2xl border bg-card py-(--card-spacing) text-sm text-card-foreground shadow-xs [--card-spacing:--spacing(5)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(4)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-2xl *:[img:last-child]:rounded-b-2xl"
```

(Changes vs current: `rounded-xl`→`rounded-2xl`, `ring-1 ring-foreground/10`→`border` + `shadow-xs`, spacing `--spacing(4)`→`--spacing(5)`, sm `--spacing(3)`→`--spacing(4)`, img corners `xl`→`2xl`.)

- [ ] **Step 2: Update corner radii in `CardHeader` (line 28) and `CardFooter` (line 87)**

In `CardHeader`: `rounded-t-xl` → `rounded-t-2xl`.
In `CardFooter`: `rounded-b-xl` → `rounded-b-2xl`.

- [ ] **Step 3: Verify**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/card.tsx
git commit -m "style: cards use hairline border + shadow, rounded-2xl, larger padding"
```

---

### Task 3: Button / Input / Select sizing + press motion

**Files:**
- Modify: `src/components/ui/button.tsx:7,22-34`
- Modify: `src/components/ui/input.tsx:12`
- Modify: `src/components/ui/select.tsx:44`
- Modify: `src/components/dashboard/mileage-form.tsx:49`

- [ ] **Step 1: Button — press scale + size bumps**

In `button.tsx` base string (line 7): replace
`active:not-aria-[haspopup]:translate-y-px` with `active:not-aria-[haspopup]:scale-[0.98]`.

In the `size` variants object:
- `default`: `h-8` → `h-9`, `px-2.5` → `px-3`
- `lg`: `h-9 gap-1.5 px-2.5` → `h-10 gap-2 px-4`
- `icon`: `size-8` → `size-9`
- `icon-lg`: `size-9` → `size-10`
- leave `xs`, `sm`, `icon-xs`, `icon-sm` unchanged

Resulting `size` block:

```ts
size: {
  default:
    "h-9 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
  xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
  sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
  lg: "h-10 gap-2 px-4 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
  icon: "size-9",
  "icon-xs":
    "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
  "icon-sm":
    "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
  "icon-lg": "size-10",
},
```

- [ ] **Step 2: Input — h-10**

In `input.tsx` (line 12): `h-8` → `h-10`, `px-2.5` → `px-3`. Everything else unchanged.

- [ ] **Step 3: SelectTrigger — h-10**

In `select.tsx` `SelectTrigger` (line 44): `data-[size=default]:h-8` → `data-[size=default]:h-10`, `pl-2.5` → `pl-3`.

- [ ] **Step 4: MileageForm submit matches input height**

In `mileage-form.tsx` line 49:

```tsx
<Button type="submit" size="lg">{t("updateMileage")}</Button>
```

- [ ] **Step 5: Verify**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: all pass (mileage-form test asserts behavior, not height).

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/button.tsx src/components/ui/input.tsx src/components/ui/select.tsx src/components/dashboard/mileage-form.tsx
git commit -m "style: taller touch targets for buttons/inputs/select, press scale"
```

---

### Task 4: New i18n keys (both catalogs — key sets MUST stay identical)

**Files:**
- Modify: `src/messages/en.json` (sections `dashboard`, `garage`, `car`)
- Modify: `src/messages/uk.json` (same sections)

- [ ] **Step 1: Add to `en.json`**

In `"dashboard"` (after `"logService": "Log service"`):

```json
"statusOk": "OK",
"statusDue": "Due soon",
"statusOverdue": "Overdue"
```

In `"garage"` (after `"details": "Details"`):

```json
"noCars": "No cars in your garage yet",
"noCarsHint": "Add your first car to start tracking maintenance"
```

In `"car"` (after `"noLogs": "No service records yet"`):

```json
"noRules": "No maintenance rules yet",
"noRulesHint": "Add a rule to start tracking this car's consumables"
```

- [ ] **Step 2: Add to `uk.json` in the same sections**

```json
"statusOk": "ОК",
"statusDue": "Скоро заміна",
"statusOverdue": "Прострочено"
```

```json
"noCars": "У гаражі ще немає автомобілів",
"noCarsHint": "Додайте перший автомобіль, щоб відстежувати обслуговування"
```

```json
"noRules": "Ще немає правил обслуговування",
"noRulesHint": "Додайте правило, щоб відстежувати витратні матеріали цього авто"
```

- [ ] **Step 3: Verify key parity**

Run: `node -e "const en=require('./src/messages/en.json'),uk=require('./src/messages/uk.json');const k=o=>Object.entries(o).flatMap(([s,v])=>Object.keys(v).map(x=>s+'.'+x)).sort();const a=k(en),b=k(uk);console.log(JSON.stringify(a)===JSON.stringify(b)?'OK':'MISMATCH: '+a.filter(x=>!b.includes(x)).concat(b.filter(x=>!a.includes(x))).join(', '))"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add src/messages/en.json src/messages/uk.json
git commit -m "feat: i18n keys for status pills and empty states"
```

---

### Task 5: StatusCard — status pill + large figure (TDD)

**Files:**
- Test: `src/components/dashboard/status-card.test.tsx`
- Modify: `src/components/dashboard/status-card.tsx`

- [ ] **Step 1: Extend the test with pill assertions**

Add to the existing `describe` block in `status-card.test.tsx` (keep all current tests):

```tsx
it("shows the OK pill for a green component", () => {
  renderCard({
    componentName: "Engine Oil",
    info: { status: "green", remainingKm: 8000, remainingDays: 120 },
    lastService: null,
    onLogService: () => {},
  });
  expect(screen.getByText("OK")).toBeInTheDocument();
});

it("shows the Overdue pill for a red component", () => {
  renderCard({
    componentName: "Brakes",
    info: { status: "red", remainingKm: -500, remainingDays: null },
    lastService: null,
    onLogService: () => {},
  });
  expect(screen.getByText("Overdue")).toBeInTheDocument();
});

it("shows the Due soon pill for a yellow component", () => {
  renderCard({
    componentName: "Air Filter",
    info: { status: "yellow", remainingKm: 500, remainingDays: 10 },
    lastService: null,
    onLogService: () => {},
  });
  expect(screen.getByText("Due soon")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run src/components/dashboard/status-card.test.tsx`
Expected: 3 new tests FAIL (`Unable to find an element with the text: OK` etc.), 3 old PASS.

- [ ] **Step 3: Rewrite the StatusCard markup**

Replace the `STATUS_STYLES` const and the returned JSX in `status-card.tsx` (imports, props, and the `kmText`/`daysText` derivation stay as they are):

```tsx
const STATUS_STYLES = {
  green: "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  yellow: "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  red: "bg-red-500/10 text-red-700 dark:bg-red-500/15 dark:text-red-400",
} as const;

const STATUS_LABEL_KEYS = {
  green: "statusOk",
  yellow: "statusDue",
  red: "statusOverdue",
} as const;
```

```tsx
return (
  <Card>
    <CardContent className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate font-medium">{componentName}</p>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
            STATUS_STYLES[info.status],
          )}
        >
          {t(STATUS_LABEL_KEYS[info.status])}
        </span>
      </div>
      <p className="text-lg font-semibold tracking-tight tabular-nums">
        {kmText && daysText ? `${kmText} · ${daysText}` : (kmText ?? daysText ?? t("neverServiced"))}
      </p>
      <div className="flex items-end justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {lastService
            ? t("lastService", {
                date: format.dateTime(new Date(lastService.dateAtService), {
                  dateStyle: "medium",
                }),
                km: format.number(lastService.mileageAtService),
              })
            : " "}
        </p>
        <Button variant="outline" size="sm" onClick={onLogService}>
          {t("logService")}
        </Button>
      </div>
    </CardContent>
  </Card>
);
```

Notes: the colored dot `<span aria-label={info.status}>` is gone; the `p-4` override on `CardContent` is gone (card spacing now comes from `--card-spacing`); the `" "` space placeholder keeps the button right-aligned when there is no last-service line.

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx vitest run src/components/dashboard/status-card.test.tsx`
Expected: 6 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/status-card.tsx src/components/dashboard/status-card.test.tsx
git commit -m "feat: status cards with tinted status pills and stronger hierarchy"
```

---

### Task 6: Empty states for CarList and RuleList (TDD)

**Files:**
- Create: `src/components/cars/car-list.test.tsx`
- Modify: `src/components/cars/car-list.tsx`
- Modify: `src/components/cars/rule-list.tsx`

- [ ] **Step 1: Write the failing CarList empty-state test**

Create `src/components/cars/car-list.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import { useGarageStore } from "@/stores/garage";
import { CarList } from "./car-list";

vi.mock("@/actions/cars", () => ({
  createCarAction: vi.fn(),
  renameCarAction: vi.fn(),
  deleteCarAction: vi.fn(),
}));

function renderList() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <CarList />
    </NextIntlClientProvider>,
  );
}

describe("CarList", () => {
  beforeEach(() => {
    useGarageStore.setState({ cars: [] });
  });

  it("shows the empty state when there are no cars", () => {
    renderList();
    expect(screen.getByText(en.garage.noCars)).toBeInTheDocument();
    expect(screen.getByText(en.garage.noCarsHint)).toBeInTheDocument();
  });
});
```

(Pattern follows `src/components/auth/verify-form.test.tsx`: real `NextIntlClientProvider` + en catalog; server actions mocked. If the store setup needs more fields, mirror what `src/stores/garage.test.ts` does to seed state.)

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/cars/car-list.test.tsx`
Expected: FAIL — `Unable to find an element with the text: No cars in your garage yet`.

- [ ] **Step 3: Add the empty state to CarList**

In `car-list.tsx`:
- Add `CarFront` to the lucide import: `import { CarFront, Pencil, Plus, Trash2 } from "lucide-react";`
- Inside the returned `<div className="space-y-3">`, before `{cars.map(...)}`, add:

```tsx
{cars.length === 0 && (
  <div className="flex flex-col items-center gap-1 py-10 text-center">
    <CarFront className="mb-2 size-10 text-muted-foreground/40" aria-hidden="true" />
    <p className="font-medium">{t("garage.noCars")}</p>
    <p className="text-sm text-muted-foreground">{t("garage.noCarsHint")}</p>
  </div>
)}
```

- Change the card row content (line 40) from `className="flex items-center justify-between p-4"` to `className="flex items-center justify-between"` (padding now comes from the card itself).
- Make the Add Car trigger a large CTA (line 70): `<Button size="lg" className="w-full">`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/cars/car-list.test.tsx`
Expected: PASS.

- [ ] **Step 5: Same treatment for RuleList (no test — same pattern, store-filtered)**

In `rule-list.tsx`:
- Change the lucide import to `import { Pencil, Plus, Trash2, Wrench } from "lucide-react";`
- After the `<h3>` and before `{rules.map(...)}`, add:

```tsx
{rules.length === 0 && (
  <div className="flex flex-col items-center gap-1 py-8 text-center">
    <Wrench className="mb-2 size-10 text-muted-foreground/40" aria-hidden="true" />
    <p className="font-medium">{t("car.noRules")}</p>
    <p className="text-sm text-muted-foreground">{t("car.noRulesHint")}</p>
  </div>
)}
```

- Change line 35 `className="flex items-center justify-between p-4"` to `className="flex items-center justify-between"`.
- Make Add Rule large (line 73): `<Button variant="outline" size="lg" className="w-full">`.

- [ ] **Step 6: Verify full suite**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/cars/car-list.tsx src/components/cars/car-list.test.tsx src/components/cars/rule-list.tsx
git commit -m "feat: friendly empty states for garage and rules"
```

---

### Task 7: Frosted chrome — AppHeader + BottomNav

**Files:**
- Modify: `src/components/app-header.tsx:15-17`
- Modify: `src/components/bottom-nav.tsx:19-34`

- [ ] **Step 1: AppHeader frosted glass**

Line 15: `className="sticky top-0 z-10 border-b bg-background"` →
`className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur"`.
Line 17: `className="text-lg font-semibold"` → `className="text-base font-semibold tracking-tight"`.

- [ ] **Step 2: BottomNav frosted glass + active pill**

Replace the returned JSX in `bottom-nav.tsx`:

```tsx
return (
  <nav className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/80 pb-[env(safe-area-inset-bottom)] backdrop-blur">
    <div className="mx-auto flex max-w-md">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "flex h-6 w-12 items-center justify-center rounded-full transition-colors",
                active && "bg-primary/10",
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
            </span>
            {label}
          </Link>
        );
      })}
    </div>
  </nav>
);
```

- [ ] **Step 3: Verify**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/app-header.tsx src/components/bottom-nav.tsx
git commit -m "style: frosted-glass header and bottom nav with active pill"
```

---

### Task 8: Typography pass + large CTAs sweep

**Files:**
- Modify: `src/app/(app)/cars/page.tsx:9`
- Modify: `src/components/cars/car-detail.tsx:13`
- Modify: `src/components/cars/rule-list.tsx:32`
- Modify: `src/components/cars/service-history.tsx:34` (also remove `p-4` on its `CardContent`, line 40)
- Modify: `src/components/cars/car-form-dialog.tsx:94`
- Modify: `src/components/cars/rule-form-dialog.tsx:152`
- Modify: `src/components/dashboard/log-service-dialog.tsx:103`
- Modify: `src/components/auth/login-form.tsx:64`
- Modify: `src/components/auth/register-form.tsx:64`
- Modify: `src/components/auth/verify-form.tsx:151,158`

- [ ] **Step 1: Page titles**

`cars/page.tsx:9`: `className="text-xl font-semibold"` → `className="text-2xl font-semibold tracking-tight"`.
`car-detail.tsx:13`: same change.

- [ ] **Step 2: Section labels small + muted**

`rule-list.tsx:32` and `service-history.tsx:34`:
`<h3 className="font-semibold">` → `<h3 className="text-sm font-medium text-muted-foreground">`.
In `service-history.tsx:40`, change `className="flex items-center justify-between p-4"` to `className="flex items-center justify-between"`.

- [ ] **Step 3: Full-width submit/CTA buttons get `size="lg"`**

Add `size="lg"` to each of these `<Button ... className="w-full">` elements:
- `car-form-dialog.tsx:94`
- `rule-form-dialog.tsx:152`
- `log-service-dialog.tsx:103`
- `login-form.tsx:64`
- `register-form.tsx:64`
- `verify-form.tsx:151` and `:158`

Example (`car-form-dialog.tsx`):

```tsx
<Button type="submit" size="lg" className="w-full" disabled={busy}>
  {t("common.save")}
</Button>
```

- [ ] **Step 4: Verify**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: all pass (verify-form tests interact by role/text, not size).

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/cars/page.tsx src/components/cars/car-detail.tsx src/components/cars/rule-list.tsx src/components/cars/service-history.tsx src/components/cars/car-form-dialog.tsx src/components/cars/rule-form-dialog.tsx src/components/dashboard/log-service-dialog.tsx src/components/auth/login-form.tsx src/components/auth/register-form.tsx src/components/auth/verify-form.tsx
git commit -m "style: title hierarchy, muted section labels, large CTAs"
```

---

### Task 9: Final verification

- [ ] **Step 1: Full gate (required by AGENTS.md)**

Run, in order:

```bash
npx vitest run
npx tsc --noEmit
npx eslint src
npm run build
```

Expected: all four succeed (build includes `serwist build`).

- [ ] **Step 2: Visual spot-check**

Run `npm run dev`, open the app, and check light + dark (toggle `.dark` on `<html>` via devtools or OS preference): dashboard (status pills, mileage form alignment), garage (cards, empty state after filtering, Add Car CTA), car detail (section labels, rules, history), login. Confirm: warm off-white background, blue primary buttons/active tab, frosted header/nav, no clipped text in either locale (switch to Українська).

- [ ] **Step 3: Fix anything found, re-run the gate, commit**

```bash
git add -A
git commit -m "style: ui refresh follow-ups from visual check"
```

(Skip the commit if nothing changed.)
