# UI Refresh — "Warm Minimal" Design

**Date:** 2026-06-11
**Status:** Approved (direction: warm neutral + blue accent)

## Goal

Modernize the app's look with a minimalist approach: warm neutral surfaces, one
confident blue accent, softer geometry, clearer hierarchy. Visual-only refresh —
no logic, route, or data changes.

## 1. Design tokens (`src/app/globals.css`)

All changes flow through CSS custom properties so components inherit them.

- **Warm neutrals (light mode):**
  - `--background`: off-white, ~`oklch(0.98 0.004 85)`
  - `--foreground`: warm near-black, ~`oklch(0.16 0.005 85)`
  - `--card`: white `oklch(1 0 0)` (cards sit slightly above background)
  - `--muted` / `--secondary` / `--accent`: warm light grays (~`oklch(0.955 0.004 85)`)
  - `--muted-foreground`: warm mid-gray (~`oklch(0.55 0.01 85)`)
  - `--border` / `--input`: warm hairline (~`oklch(0.91 0.005 85)`)
- **Warm neutrals (dark mode):**
  - `--background`: warm near-black (~`oklch(0.15 0.005 85)`)
  - `--card`: slightly lighter (~`oklch(0.20 0.005 85)`)
  - borders/inputs keep alpha-transparency approach, warm-tinted
- **Accent primary (both modes):**
  - `--primary`: confident blue, ~`oklch(0.55 0.18 255)` light /
    ~`oklch(0.65 0.16 255)` dark; `--primary-foreground` near-white
  - `--ring`: same blue family
  - Blue deliberately avoids collision with status semantics
    (emerald = ok, amber = due soon, red = overdue)
- **Radius:** `--radius: 0.625rem` → `0.75rem` (existing scale multipliers stay)

## 2. Cards & hierarchy

- `ui/card.tsx`: replace `ring-1 ring-foreground/10` with `border` +
  `shadow-xs`; `rounded-xl` → `rounded-2xl`; bump `--card-spacing` slightly
  (1.25rem default / 1rem sm).
- **StatusCard** (`dashboard/status-card.tsx`):
  - Lead line: rule name (medium weight)
  - Large remaining figure: `text-xl font-semibold tabular-nums`
    (km or days remaining)
  - Status pill instead of bare dot: small rounded badge with 10%-tinted
    background (`bg-emerald-500/10 text-emerald-700` pattern, dark variants)
  - Existing i18n strings reused; any new strings added to **both**
    `en.json` and `uk.json`
- **Page titles:** `text-2xl font-semibold tracking-tight`; section labels
  small + muted.

## 3. Chrome

- **AppHeader:** `bg-background/80 backdrop-blur` sticky, hairline bottom
  border, tightened typography for the title.
- **BottomNav:** same frosted treatment; larger touch targets (min ~h-14
  hit area), active tab in accent blue with a small indicator pill;
  inactive stays `text-muted-foreground`. Safe-area padding kept.

## 4. Primitives & details

- **Button (`ui/button.tsx`):** default size `h-8` → `h-9`; add an `lg`
  (`h-10`) size used by full-width CTAs (Add Car, dialog/auth form submits);
  add `active:scale-[0.98]` and `transition-colors`; variants otherwise
  unchanged (CVA structure stays).
- **Input / Select triggers:** `h-8` → `h-10`, matching radius; warm border.
- **Badge:** unchanged structurally; inherits warm tokens.
- **Motion:** `transition-colors` on interactive elements; existing
  tw-animate dialog/toast animations stay. No new animation library.
- **Empty states:** "no cars" (CarList) and "no rules" (RuleList) get a
  centered lucide icon + muted explanatory line + CTA button instead of
  bare text. New strings go into both message catalogs.
- **Dark mode:** warm dark tokens; continues to follow the existing
  class/system mechanism — no new toggle UI.

## 5. Out of scope

- No logic, server action, repository, or route changes
- No new dependencies
- No theme-toggle feature
- Auth forms, dialogs, skeletons restyle purely via inherited tokens/primitives

## 6. Verification

- `npx vitest run` (component tests must still pass — markup changes may
  require test updates if they assert on removed elements like the status dot)
- `npx tsc --noEmit && npx eslint src`
- `npm run build`
- Visual spot-check: dashboard, garage, car detail, login — light & dark
