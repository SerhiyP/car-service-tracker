# Delete Account — Design

**Date:** 2026-06-11
**Status:** Approved

## 1. Overview

Authenticated users can permanently delete their account and all data. Immediate motivation: re-testing registration with the same email. Confirmation: typing a localized confirmation word (`DELETE` / `ВИДАЛИТИ`) — chosen over password re-entry (user decision).

## 2. Server

- `deleteUserCascade(userId: string): Promise<void>` in `src/lib/repositories/users.ts`:
  collect the user's car `_id`s → `deleteMany` `maintenance_rules` and `service_logs` with `carId $in` → `deleteMany` `cars` by `userId` → `deleteCodeForUser(userId)` → `deleteOne` the user.
  (Looping the existing per-car `deleteCarCascade` was rejected: N+1 round-trips, awkward mid-loop failure.)
- `deleteAccountAction` in `src/actions/auth.ts` on `authActionClient`, **no input** — the typed word is purely a client-side guard; the session is the authorization. Calls `deleteUserCascade(ctx.userId)`, then `signOut({ redirectTo: "/login" })` (NEXT_REDIRECT propagates, same as `logoutAction`).

## 3. UI

- `DeleteAccountDialog` (`src/components/account/delete-account-dialog.tsx`): a "Danger zone" block rendered at the bottom of the Garage page (`/cars`) — destructive-styled "Delete account" button → Dialog (existing Base UI dialog primitives, `DialogTrigger render={...}` pattern) with warning text, a text input, and a destructive confirm button disabled until the input matches the localized confirmation word (case-insensitive, surrounding whitespace ignored).
- On confirm: `useGarageStore.persist.clearStorage()` (purges the offline localStorage cache), then execute the action. Buttons disabled while executing. Failure → translated toast via `actionErrorKey` (sonner, same as other mutations).
- The signOut redirect is a full navigation, so in-memory store state is discarded; only the persisted cache needs explicit clearing.

## 4. i18n

New `account` namespace in `en.json`/`uk.json` (identical key sets):
`dangerZone`, `deleteAccount`, `deleteWarning`, `deleteConfirmInstruction` ("Type {word} to confirm"), `deleteConfirmWord` ("DELETE" / "ВИДАЛИТИ"). Cancel reuses existing `common.cancel` if present, else add it.

## 5. Testing

Component test `delete-account-dialog.test.tsx` using the mocked-`useAction` pattern from `verify-form.test.tsx`: confirm button disabled until the word matches (and matching is exact), action executed on confirm, persisted store cleared. Repo function untested per thin-repo convention.
