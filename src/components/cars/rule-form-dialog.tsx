"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createRuleAction, updateRuleAction } from "@/actions/rules";
import { actionErrorKey } from "@/lib/action-feedback";
import { useGarageStore } from "@/stores/garage";
import type { MaintenanceRule } from "@/lib/types";
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

export function RuleFormDialog({
  carId,
  rule,
  trigger,
}: {
  carId: string;
  rule?: MaintenanceRule;
  trigger: React.ReactElement;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [intervalErrorKey, setIntervalErrorKey] = useState<string | null>(null);
  const { upsertRule } = useGarageStore();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const componentName = String(data.get("componentName")).trim();
    const kmRaw = String(data.get("intervalKm"));
    const monthsRaw = String(data.get("intervalMonths"));
    const intervalKm = kmRaw === "" ? undefined : Number(kmRaw);
    const intervalMonths = monthsRaw === "" ? undefined : Number(monthsRaw);

    if (intervalKm === undefined && intervalMonths === undefined) {
      setIntervalErrorKey("validation.intervalRequired");
      return;
    }
    if (
      (intervalKm !== undefined && intervalKm < 1) ||
      (intervalMonths !== undefined && intervalMonths < 1)
    ) {
      setIntervalErrorKey("validation.intervalInvalid");
      return;
    }
    setIntervalErrorKey(null);
    setBusy(true);

    try {
      if (rule) {
        // Optimistic update with rollback
        const previous = rule;
        const updated: MaintenanceRule = { ...rule, componentName, intervalKm, intervalMonths };
        upsertRule(updated);
        setOpen(false);
        const result = await updateRuleAction({
          ruleId: rule.id,
          carId,
          componentName,
          intervalKm,
          intervalMonths,
        });
        const errorKey = actionErrorKey(result);
        if (errorKey) {
          upsertRule(previous);
          toast.error(t(errorKey));
        }
      } else {
        // Non-optimistic create (need server id)
        const result = await createRuleAction({
          carId,
          componentName,
          intervalKm,
          intervalMonths,
        });
        const errorKey = actionErrorKey(result);
        if (errorKey) {
          toast.error(t(errorKey));
        } else {
          upsertRule(result!.data!);
          setOpen(false);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{rule ? t("car.editRule") : t("car.addRule")}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="componentName">{t("car.componentName")}</Label>
            <Input
              id="componentName"
              name="componentName"
              defaultValue={rule?.componentName}
              required
              maxLength={100}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="intervalKm">{t("car.intervalKm")}</Label>
              <Input
                id="intervalKm"
                name="intervalKm"
                type="number"
                inputMode="numeric"
                min={1}
                max={1000000}
                defaultValue={rule?.intervalKm}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="intervalMonths">{t("car.intervalMonths")}</Label>
              <Input
                id="intervalMonths"
                name="intervalMonths"
                type="number"
                inputMode="numeric"
                min={1}
                max={600}
                defaultValue={rule?.intervalMonths}
              />
            </div>
          </div>
          <p
            className={
              intervalErrorKey
                ? "text-sm text-destructive"
                : "text-sm text-muted-foreground"
            }
          >
            {intervalErrorKey ? t(intervalErrorKey) : t("car.intervalHint")}
          </p>
          <Button type="submit" className="w-full" disabled={busy}>
            {t("common.save")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
