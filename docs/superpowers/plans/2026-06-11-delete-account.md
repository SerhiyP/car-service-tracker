# Delete Account Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an authenticated user permanently delete their account (and all data) behind a typed-word confirmation, per `docs/superpowers/specs/2026-06-11-delete-account-design.md`.

**Architecture:** A `deleteUserCascade` repository function removes rules/logs/cars/verification-code/user in bulk; a no-input `deleteAccountAction` on `authActionClient` calls it and signs out; a `DeleteAccountDialog` client component on the Garage page gates the action behind typing the localized confirmation word and clears the persisted Zustand cache first.

**Tech Stack:** Next.js 16, next-safe-action v8 (`authActionClient`), mongodb driver, Base UI dialog (shadcn variant — `DialogTrigger render={...}`, not `asChild`), next-intl, Vitest + Testing Library.

**Conventions:** short relative git commands; en/uk catalogs keep identical key sets; run tests with `npx vitest run <path>`.

---

### Task 1: Repository — deleteUserCascade

**Files:**
- Modify: `src/lib/repositories/users.ts`

No unit test (thin-repo convention).

- [ ] **Step 1: Implement**

In `src/lib/repositories/users.ts`, add the import:

```ts
import { deleteCodeForUser } from "@/lib/repositories/verification-codes";
```

Append:

```ts
/** Permanently removes the user and everything they own. */
export async function deleteUserCascade(userId: ObjectId | string): Promise<void> {
  const _id = typeof userId === "string" ? new ObjectId(userId) : userId;
  const db = getDb();
  const carIds = await db
    .collection("cars")
    .find({ userId: _id }, { projection: { _id: 1 } })
    .map((doc) => doc._id)
    .toArray();
  if (carIds.length > 0) {
    await Promise.all([
      db.collection("maintenance_rules").deleteMany({ carId: { $in: carIds } }),
      db.collection("service_logs").deleteMany({ carId: { $in: carIds } }),
    ]);
  }
  await Promise.all([
    db.collection("cars").deleteMany({ userId: _id }),
    deleteCodeForUser(_id),
    users().deleteOne({ _id }),
  ]);
}
```

- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit && npx eslint src/lib/repositories/users.ts`
Expected: clean.

```bash
git add src/lib/repositories/users.ts
git commit -m "feat: deleteUserCascade repository function"
```

---

### Task 2: Server action — deleteAccountAction

**Files:**
- Modify: `src/actions/auth.ts`

- [ ] **Step 1: Implement**

In `src/actions/auth.ts`:
- Extend the safe-action import: `import { ActionError, actionClient, authActionClient } from "@/lib/safe-action";`
- Extend the users-repo import to include `deleteUserCascade`.
- Append before `logoutAction`:

```ts
export const deleteAccountAction = authActionClient.action(async ({ ctx }) => {
  await deleteUserCascade(ctx.userId);
  // Throws NEXT_REDIRECT — propagates like logoutAction's signOut.
  await signOut({ redirectTo: "/login" });
});
```

- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit && npx vitest run && npx eslint src`
Expected: clean, 72 tests.

```bash
git add src/actions/auth.ts
git commit -m "feat: deleteAccountAction"
```

---

### Task 3: UI — DeleteAccountDialog with typed-word confirmation (TDD)

**Files:**
- Create: `src/components/account/delete-account-dialog.tsx`
- Test: `src/components/account/delete-account-dialog.test.tsx`
- Modify: `src/app/(app)/cars/page.tsx`
- Modify: `src/messages/en.json`, `src/messages/uk.json`

- [ ] **Step 1: Add the message keys**

`src/messages/en.json` — new top-level `"account"` object (place it after `"auth"`):

```json
  "account": {
    "dangerZone": "Danger zone",
    "deleteAccount": "Delete account",
    "deleteWarning": "This permanently deletes your account, cars, rules, and service history. This cannot be undone.",
    "deleteConfirmInstruction": "Type {word} to confirm",
    "deleteConfirmWord": "DELETE"
  },
```

`src/messages/uk.json` — same position:

```json
  "account": {
    "dangerZone": "Небезпечна зона",
    "deleteAccount": "Видалити обліковий запис",
    "deleteWarning": "Це назавжди видалить ваш обліковий запис, автомобілі, правила та історію обслуговування. Цю дію неможливо скасувати.",
    "deleteConfirmInstruction": "Введіть {word} для підтвердження",
    "deleteConfirmWord": "ВИДАЛИТИ"
  },
```

- [ ] **Step 2: Write the failing test**

Create `src/components/account/delete-account-dialog.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";

const { execute, clearStorage } = vi.hoisted(() => ({
  execute: vi.fn(),
  clearStorage: vi.fn(),
}));

vi.mock("@/actions/auth", () => ({ deleteAccountAction: "deleteAccountAction" }));

vi.mock("next-safe-action/hooks", () => ({
  useAction: () => ({ execute, result: {}, isExecuting: false }),
}));

vi.mock("@/stores/garage", () => ({
  useGarageStore: { persist: { clearStorage } },
}));

import { DeleteAccountDialog } from "./delete-account-dialog";

afterEach(cleanup);
beforeEach(() => {
  execute.mockClear();
  clearStorage.mockClear();
});

function openDialog() {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <DeleteAccountDialog />
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
}

function confirmButton() {
  // The dialog's destructive confirm button (the trigger has the same name).
  const buttons = screen.getAllByRole("button", { name: "Delete account" });
  return buttons[buttons.length - 1];
}

describe("DeleteAccountDialog", () => {
  it("keeps the confirm button disabled until the exact word is typed", () => {
    openDialog();
    expect(confirmButton()).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), {
      target: { value: "DELET" },
    });
    expect(confirmButton()).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), {
      target: { value: "delete" },
    });
    expect(confirmButton()).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), {
      target: { value: "DELETE" },
    });
    expect(confirmButton()).not.toBeDisabled();
  });

  it("clears the persisted store and executes the action on confirm", () => {
    openDialog();
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), {
      target: { value: "DELETE" },
    });
    fireEvent.click(confirmButton());
    expect(clearStorage).toHaveBeenCalled();
    expect(execute).toHaveBeenCalled();
  });

  it("does not execute when the word does not match", () => {
    openDialog();
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), {
      target: { value: "nope" },
    });
    fireEvent.click(confirmButton());
    expect(execute).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/components/account/delete-account-dialog.test.tsx`
Expected: FAIL — cannot resolve `./delete-account-dialog`.

- [ ] **Step 4: Implement the component**

Create `src/components/account/delete-account-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { deleteAccountAction } from "@/actions/auth";
import { actionErrorKey } from "@/lib/action-feedback";
import { useGarageStore } from "@/stores/garage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DeleteAccountDialog() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const confirmWord = t("account.deleteConfirmWord");

  const { execute, isExecuting } = useAction(deleteAccountAction, {
    onError({ error }) {
      toast.error(t(actionErrorKey(error) ?? "errors.server"));
    },
  });

  return (
    <section className="space-y-2 rounded-xl border border-destructive/40 p-4">
      <h3 className="text-sm font-semibold text-destructive">
        {t("account.dangerZone")}
      </h3>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setConfirmText("");
        }}
      >
        <DialogTrigger
          render={
            <Button
              variant="outline"
              className="w-full border-destructive/40 text-destructive"
            >
              {t("account.deleteAccount")}
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("account.deleteAccount")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("account.deleteWarning")}</p>
          <div className="space-y-2">
            <Label htmlFor="confirm-delete">
              {t("account.deleteConfirmInstruction", { word: confirmWord })}
            </Label>
            <Input
              id="confirm-delete"
              autoComplete="off"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />
          </div>
          <Button
            variant="destructive"
            className="w-full"
            disabled={confirmText !== confirmWord || isExecuting}
            onClick={() => {
              // Purge the offline cache before the account disappears.
              useGarageStore.persist.clearStorage();
              execute();
            }}
          >
            {isExecuting ? t("common.loading") : t("account.deleteAccount")}
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
```

Note: check `src/components/ui/button.tsx` for the exact variant names (`destructive`, `outline`) before relying on them; adjust classes if the project's variants differ.

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/components/account/delete-account-dialog.test.tsx`
Expected: PASS (3 tests). If Base UI's dialog doesn't mount its popup in jsdom on trigger click, render the Dialog with `open` controlled and simulate via state — but try the click path first; Base UI supports jsdom.

- [ ] **Step 6: Mount on the Garage page**

Replace `src/app/(app)/cars/page.tsx` with:

```tsx
import { getTranslations } from "next-intl/server";
import { CarList } from "@/components/cars/car-list";
import { DeleteAccountDialog } from "@/components/account/delete-account-dialog";

export default async function GaragePage() {
  const t = await getTranslations("garage");
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">{t("title")}</h2>
      <CarList />
      <DeleteAccountDialog />
    </div>
  );
}
```

- [ ] **Step 7: Full verify + commit**

Run: `npx tsc --noEmit && npx vitest run && npx eslint src && npm run build`
Expected: all green (75 tests).

```bash
git add src/components/account src/app/\(app\)/cars/page.tsx src/messages
git commit -m "feat: delete account with typed-word confirmation on garage page"
```
