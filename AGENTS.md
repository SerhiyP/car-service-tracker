<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Next.js 16 specifics already in use here

- `src/proxy.ts` replaces `middleware.ts` (exports `proxy`, wrapped with Auth.js `auth()` so rolling session cookies re-issue).
- Page `params`/`searchParams` are **Promises** — always `await` them.
- Turbopack is the default for dev **and** build. The service worker is built
  separately: `npm run build` = `next build && serwist build` (config in
  `serwist.config.js`; `src/app/sw.ts` is excluded from tsconfig).

## Commands

- `npx vitest run` — tests (single file: `npx vitest run <path>`)
- `npx tsc --noEmit && npx eslint src` — types + lint
- `npm run build` — production build incl. service worker

Run all four before considering any change done.

## Conventions

- **i18n:** all user-facing strings are next-intl keys in `src/messages/en.json`
  and `uk.json` — the two files MUST keep identical key sets. Server errors are
  thrown as `ActionError("<i18n key>")` and translated client-side
  (`actionErrorKey` in `src/lib/action-feedback.ts`).
- **Server actions** (`src/actions/`): `actionClient` for public,
  `authActionClient` for authenticated (injects `ctx.userId`). Actions with
  structured outcomes return **discriminated status unions** (see
  `verifyEmailAction`) rather than throwing, so data travels with the result.
- **Repositories** (`src/lib/repositories/`): thin, untested wrappers over the
  mongodb driver; ObjectId↔string conversion at the boundary; all queries
  scoped by `userId` (data isolation) — never trust a client-supplied id
  without an ownership check.
- **Auth:** Auth.js v5 split config (`src/auth.config.ts` DB-free +
  `src/auth.ts` with Credentials). Login is blocked for unverified emails.
- **shadcn/ui here is on Base UI, not Radix** — `DialogTrigger render={...}`,
  not `asChild`; Select's `onValueChange` can pass `null`.
- **Optimistic updates:** creates are non-optimistic (need server ids);
  updates/deletes snapshot → apply → rollback + toast on failure.
- **Env:** the Mongo connection string is `MONGODB_URI_CAR` (deliberately not
  `MONGODB_URI` — a global shell export once shadowed it; real env vars beat
  `.env.local`).
- Dates in business logic use **UTC accessors** (see `addMonths` in
  `src/lib/maintenance.ts`) — local-time accessors caused TZ bugs.
- Component tests follow `src/components/auth/verify-form.test.tsx`: real
  `NextIntlClientProvider` + en catalog, `vi.hoisted` for anything captured by
  `vi.mock` factories, mocked `useAction` driving `onSuccess`/`onError`.

## Git

- **Never commit on `main`.** All work — including design specs and plans —
  is committed on the feature branch where it will be implemented, and lands
  on `main` only via PR.

## Working with MongoDB

Never use MongoDB MCP tools in this project. Interact with the database only
through the app code/driver or commands the user runs.
