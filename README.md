# Car Service Tracker

Mobile-first PWA for tracking vehicle consumables and maintenance schedules.
Offline read access, MongoDB Atlas sync, multi-user, multi-vehicle, EN/UK.

**Demo:** <https://car-service-tracker-flame.vercel.app/>

## Features

- **Garage** — multiple cars per account, quick mileage updates.
- **Consumables** — custom components with km and/or month intervals
  (whichever comes first), or one-tap presets from a standard-rules picker;
  Green / Yellow / Red status on the dashboard. Never-serviced components
  stay off the dashboard behind an "n items not serviced yet" link until
  their first log.
- **Service visits** — services are logged per garage visit: pick everything
  done at once, with a shared date/mileage and an optional total cost (₴).
  Visits are editable afterwards (services, date, mileage, cost); logging or
  editing at a higher mileage auto-raises the car's mileage.
- **Google sign-in** — authentication is Google-only; an account is created
  on first sign-in and matched by email afterwards.
- **Account deletion** — danger zone on the Garage page; typed-word
  confirmation, cascades to all user data.
- **Offline** — read-only access to last-synced data (Serwist app shell +
  persisted store); writes need a connection and roll back with a toast.
- **i18n** — English and Ukrainian, cookie-based, with a switcher.

## Tech stack

Next.js 16 (App Router, React 19), TypeScript, MongoDB Atlas (native driver),
Auth.js v5 (Google, rolling JWT sessions), Zod v4 + next-safe-action,
Zustand (persist + optimistic updates), Tailwind v4 + shadcn/ui (Base UI),
next-intl, Serwist, Vitest.

## Setup

1. Copy `.env.local.example` to `.env.local` and fill in:
   - `MONGODB_URI_CAR` — MongoDB Atlas connection string
   - `MONGODB_DB` — database name (default `car_service_tracker`)
   - `AUTH_SECRET` — `openssl rand -base64 32`
   - `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — Google OAuth client
     (console.cloud.google.com → APIs & Services → Credentials; add
     `http://localhost:3000/api/auth/callback/google` and your production
     `https://<domain>/api/auth/callback/google` as authorized redirect URIs)
2. `npm install`
3. `npm run dev`

When deploying (e.g. Vercel), set the same environment variables.

## Authentication

Sign-in is Google-only (Auth.js v5, JWT sessions). On first sign-in a user
record is created; subsequent sign-ins match it by email, so accounts that
existed before the switch keep their data.

## Scripts

- `npm run dev` — dev server (service worker disabled in dev)
- `npm run build && npm start` — production build (required to test PWA/offline)
- `npm test` — unit & component tests (Vitest)

## Docs

Every feature ships with a design spec in `docs/superpowers/specs/` and a
matching implementation plan in `docs/superpowers/plans/`, named
`YYYY-MM-DD-<topic>`. Start with
`specs/2026-06-10-car-maintenance-tracker-design.md` for the core app.
