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

  const confirmed =
    confirmText.trim().toLocaleLowerCase() === confirmWord.toLocaleLowerCase();

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
            loading={isExecuting}
            disabled={!confirmed}
            onClick={() => {
              // Purge the offline cache before the account disappears.
              useGarageStore.persist.clearStorage();
              execute();
            }}
          >
            {t("account.deleteAccount")}
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
