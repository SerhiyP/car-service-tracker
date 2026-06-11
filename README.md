# Car Service Tracker

Mobile-first PWA for tracking vehicle consumables and maintenance schedules.
Offline read access, MongoDB Atlas sync, multi-user, multi-vehicle, EN/UK.

## Features

- **Garage** — multiple cars per account, quick mileage updates.
- **Consumables** — custom components with km and/or month intervals
  (whichever comes first); Green / Yellow / Red status on the dashboard.
- **Service log** — per-component history; logging a service can auto-raise
  the car's mileage.
- **Email verification** — registration requires confirming a 6-digit emailed
  code before login works.
- **Account deletion** — danger zone on the Garage page; typed-word
  confirmation, cascades to all user data.
- **Offline** — read-only access to last-synced data (Serwist app shell +
  persisted store); writes need a connection and roll back with a toast.
- **i18n** — English and Ukrainian, cookie-based, with a switcher.

## Tech stack

Next.js 16 (App Router, React 19), TypeScript, MongoDB Atlas (native driver),
Auth.js v5 (Credentials, rolling JWT sessions), Zod v4 + next-safe-action,
Zustand (persist + optimistic updates), Tailwind v4 + shadcn/ui (Base UI),
next-intl, Serwist, Vitest.

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

When deploying (e.g. Vercel), set the same environment variables.

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

Design specs and implementation plans live in `docs/superpowers/`:

- Core app: `specs/2026-06-10-car-maintenance-tracker-design.md`,
  `plans/2026-06-10-car-maintenance-tracker.md`
- Email verification: `specs/2026-06-11-email-verification-design.md`,
  `plans/2026-06-11-email-verification.md`
- Delete account: `specs/2026-06-11-delete-account-design.md`,
  `plans/2026-06-11-delete-account.md`
