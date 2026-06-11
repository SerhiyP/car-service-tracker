# Car Maintenance Tracker — Design

**Date:** 2026-06-10
**Status:** Approved

## 1. Overview

A mobile-first PWA for tracking vehicle consumables and maintenance schedules. Offline read access, cloud sync via MongoDB Atlas, multi-user with per-user data isolation, multiple vehicles per user.

Decisions made during brainstorming:

- **Auth:** Email/Password only (Auth.js v5 Credentials provider, bcrypt, JWT sessions).
- **Database:** MongoDB Atlas; connection string supplied by the user in `.env.local` as `MONGODB_URI`. Native `mongodb` driver (no Mongoose) — Zod is the single validation layer.
- **i18n:** English + Ukrainian via `next-intl` in cookie-based mode (no URL locale prefixes), with a language switcher.
- **Offline:** Read-only offline (Approach A). App shell cached by Serwist; last-fetched data persisted by Zustand. Writes require a connection and roll back with a toast when it is absent.

## 2. Tech Stack

Next.js 16.2.9 (App Router, React 19), TypeScript, MongoDB Atlas, Zod + next-safe-action, Auth.js (NextAuth v5), Zustand (persist + optimistic updates), Tailwind CSS v4 + shadcn/ui, Serwist, next-intl, sonner (toasts), Vercel.

**Next.js 16 notes (differs from older training data):** `middleware.ts` is renamed to `proxy.ts` (same functionality, `proxy` export). Caching uses the opt-in Cache Components model (`use cache`); this app's data is per-user and dynamic, so we do not rely on it. Always consult `node_modules/next/dist/docs/` before coding against an unfamiliar API.

## 3. Project Structure

```
src/
  app/
    (auth)/login/page.tsx
    (auth)/register/page.tsx
    (app)/layout.tsx                  # authenticated shell, bottom nav, providers
    (app)/page.tsx                    # Dashboard
    (app)/cars/page.tsx               # Garage: list/add/edit cars
    (app)/cars/[carId]/page.tsx       # Car detail: rules CRUD + service history
    api/auth/[...nextauth]/route.ts
    manifest.ts                       # PWA manifest
    sw.ts                             # Serwist service worker
    error.tsx, not-found.tsx
  proxy.ts                            # optimistic auth redirects
  auth.ts                             # Auth.js config
  lib/
    db.ts                             # MongoDB client singleton
    schemas/                          # Zod schemas shared client/server
    repositories/                     # data access per collection
    maintenance.ts                    # pure status-calculation functions
    safe-action.ts                    # next-safe-action clients (base + authed)
  actions/                            # server actions: auth, cars, rules, logs
  stores/garage.ts                    # Zustand store with persist middleware
  components/                         # shadcn/ui primitives + app components
  i18n/                               # next-intl config
  messages/en.json, uk.json
```

## 4. Data Model (MongoDB)

Four collections, per the original spec, with one addition (`passwordHash`) required by the Email/Password decision:

```jsonc
// users
{ "_id": "ObjectId", "email": "string", "name": "string", "passwordHash": "string" }

// cars
{ "_id": "ObjectId", "userId": "ObjectId", "name": "string",
  "currentMileage": "number", "updatedAt": "date" }

// maintenance_rules
{ "_id": "ObjectId", "carId": "ObjectId", "componentName": "string",
  "intervalKm": "number", "intervalMonths": "number" }

// service_logs
{ "_id": "ObjectId", "carId": "ObjectId", "componentName": "string",
  "mileageAtService": "number", "dateAtService": "date" }
```

`intervalKm` and `intervalMonths` are each optional, but a rule must define at least one (Zod refinement).

**Indexes:** `users.email` (unique), `cars.userId`, `maintenance_rules.carId`, `service_logs.{carId, componentName, dateAtService: -1}`. Created idempotently at startup via the db module.

## 5. Authentication & Authorization

- Auth.js v5 Credentials provider; passwords hashed with bcrypt; JWT session strategy (required for Credentials; also plays well with cached pages).
- **Session longevity:** rolling JWT sessions with `session.maxAge: 30 days` and `session.updateAge: 1 day` — the token is re-issued at most once a day on activity, so active users never re-login; only 30 days of inactivity expires the session. A custom access/refresh token pair was considered and rejected: Auth.js's refresh-token rotation applies to OAuth provider tokens, and a hand-rolled scheme would only add server-side revocation at significant complexity cost.
- Registration via a server action: Zod-validated, unique-email check, hash, insert, then sign-in.
- `proxy.ts` performs optimistic redirects only (no session → `/login`; logged in visiting auth pages → `/`).
- **Real authorization lives in server actions:** `lib/safe-action.ts` exports an `authActionClient` whose middleware loads the session and rejects unauthenticated calls. Every data action uses it.
- **Data isolation:** cars are queried/written with `userId` from the session; rules and logs verify the parent car's ownership before any read or write.

## 6. State Management & Data Flow

**Store (`stores/garage.ts`):** Zustand with `persist` (localStorage). Holds `cars`, `rulesByCarId`, `logsByCarId`, `selectedCarId`, plus hydration/sync metadata (`lastSyncedAt`).

**Online flow:**
1. On app load (authenticated), the client calls a `getGarageData` server action and replaces store contents.
2. Mutations apply optimistically: snapshot relevant state → apply local change → call the server action → on success, merge server result (real `_id`s); on failure, restore the snapshot and show a sonner toast with a translated error.
3. Status calculation is purely client-side from store data (`lib/maintenance.ts`).

**Status logic (per spec §4):**
- `remainingKm = (lastLog.mileageAtService + intervalKm) - car.currentMileage`
- `remainingMonths = (lastLog.dateAtService + intervalMonths) - now`
- Each dimension is computed only if the rule defines that interval; the critical metric is the minimum of the available dimensions.
- **Red:** no service history for the component, or remaining ≤ 0.
- **Yellow:** remaining < 15% of the interval, or < 1,000 km, or < 1 month.
- **Green:** otherwise.

## 7. Offline & PWA

- **Serwist:** `app/sw.ts` precaches build assets; NetworkFirst for documents with an offline fallback so the shell loads with no network. Registered in the root layout.
- **Manifest & iOS:** `app/manifest.ts` plus `apple-touch-icon` and iOS meta tags for Add to Home Screen; standalone display, theme color, full icon set.
- **Offline reads:** the dashboard and car pages are client components rendering from the persisted store — last-known data, with statuses still accurate (computed from the current date on device).
- **Offline writes:** fail fast → rollback + "you're offline" toast. A small online/offline indicator is shown in the header.
- No mutation queue / background sync (explicitly out of scope — Approach A).

## 8. UI

- Mobile-first, single-handed use: bottom navigation (Dashboard / Garage), large touch targets, quick-access mileage update on the dashboard.
- shadcn/ui components on Tailwind v4; sonner for toasts.
- Dashboard: car selector, current mileage + quick update form, list of consumable cards each showing remaining km and remaining time with a Green/Yellow/Red badge, "log service" shortcut per card.
- Car detail: rules CRUD (component name, interval km and/or months) and service history (add/delete log entries).
- All strings via next-intl (`en`, `uk`); switcher sets a locale cookie.

## 9. Error Handling

- Zod validates all action inputs; field-level errors render inline (negative mileage and future dates rejected).
- If a service log's `mileageAtService` exceeds the car's `currentMileage`, the car's `currentMileage` is automatically raised to match (you cannot have serviced at a mileage you haven't reached).
- next-safe-action surfaces typed server errors; client maps them to translated toast messages. No silent failures.
- Root `error.tsx` and `not-found.tsx` for rendering failures.

## 10. Testing

- **Vitest** unit tests for `lib/maintenance.ts` — all threshold and edge cases: empty history, overdue, km-vs-time minimum selection, exact boundary values (0 remaining, 15%, 1,000 km, 1 month), rules with only one dimension.
- Unit tests for Zod schemas (the at-least-one-interval refinement, mileage/date validation).
- React Testing Library tests for the status card and mileage form.
- No E2E suite initially (YAGNI).

## 11. Build Order (implementation phases)

1. Scaffolding: dependencies, shadcn/ui init, env handling, db client.
2. Auth: Auth.js setup, register/login pages, proxy redirects.
3. Data layer: Zod schemas, repositories, safe-action clients, server actions.
4. Garage & rules UI.
5. Dashboard: status logic (TDD) + consumable cards + quick mileage update.
6. Service logging: forms + history.
7. i18n: next-intl wiring, en/uk messages, switcher.
8. PWA: Serwist, manifest, icons, offline fallback, online indicator.
9. Polish: error pages, toasts audit, mobile ergonomics pass.