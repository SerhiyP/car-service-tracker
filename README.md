# Car Service Tracker

Mobile-first PWA for tracking vehicle consumables and maintenance schedules.
Offline read access, MongoDB Atlas sync, multi-user, multi-vehicle, EN/UK.

## Setup

1. Copy `.env.local.example` to `.env.local` and fill in:
   - `MONGODB_URI_CAR` — MongoDB Atlas connection string
   - `MONGODB_DB` — database name (default `car_service_tracker`)
   - `AUTH_SECRET` — `openssl rand -base64 32`
   - `BREVO_API_KEY` — Brevo API key (app.brevo.com → SMTP & API → API Keys)
   - `EMAIL_FROM` — sender address verified in Brevo
   - `EMAIL_FROM_NAME` — display name for the sender (e.g. `Car Service Tracker`)
2. `npm install`
3. `npm run dev`

## Email verification

Registration emails a 6-digit code (15-minute expiry, 5 attempts, 60s resend
cooldown) via [Brevo](https://www.brevo.com). Login is blocked until the email
is verified. Accounts created before this feature verify through the same flow:
log in → "Verify now" → resend code.

## Scripts

- `npm run dev` — dev server (service worker disabled in dev)
- `npm run build && npm start` — production build (required to test PWA/offline)
- `npm test` — unit & component tests (Vitest)

## Docs

- Spec: `docs/superpowers/specs/2026-06-10-car-maintenance-tracker-design.md`
- Plan: `docs/superpowers/plans/2026-06-10-car-maintenance-tracker.md`
- Spec: `docs/superpowers/specs/2026-06-11-email-verification-design.md`
- Plan: `docs/superpowers/plans/2026-06-11-email-verification.md`
