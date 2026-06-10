# Car Service Tracker

Mobile-first PWA for tracking vehicle consumables and maintenance schedules.
Offline read access, MongoDB Atlas sync, multi-user, multi-vehicle, EN/UK.

## Setup

1. Copy `.env.local.example` to `.env.local` and fill in:
   - `MONGODB_URI` — MongoDB Atlas connection string
   - `MONGODB_DB` — database name (default `car_service_tracker`)
   - `AUTH_SECRET` — `openssl rand -base64 32`
2. `npm install`
3. `npm run dev`

## Scripts

- `npm run dev` — dev server (service worker disabled in dev)
- `npm run build && npm start` — production build (required to test PWA/offline)
- `npm test` — unit & component tests (Vitest)

## Docs

- Spec: `docs/superpowers/specs/2026-06-10-car-maintenance-tracker-design.md`
- Plan: `docs/superpowers/plans/2026-06-10-car-maintenance-tracker.md`
