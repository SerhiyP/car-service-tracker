"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { addStandardRulesAction } from "@/actions/rules";
import { actionErrorKey } from "@/lib/action-feedback";
import { STANDARD_RULES, type StandardRuleKey } from "@/lib/standard-rules";
import { useGarageStore } from "@/stores/garage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function intervalSummary(rule: { intervalKm?: number; intervalMonths?: number }) {
  return [
    rule.intervalKm !== undefined && `${rule.intervalKm.toLocaleString()} km`,
    rule.intervalMonths !== undefined && `${rule.intervalMonths} mo`,
  ]
    .filter(Boolean)
    .join(" / ");
}

export function StandardRulesDialog({
  carId,
  trigger,
}: {
  carId: string;
  trigger: React.ReactElement;
}) {
  const t = useTranslations();
  const tNames = useTranslations("standardRules");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<Partial<Record<StandardRuleKey, boolean>>>({});
  const { upsertRule } = useGarageStore();
  const existingNames = new Set(
    useGarageStore((s) => s.rules)
      .filter((r) => r.carId === carId)
      .map((r) => r.componentName.toLowerCase()),
  );

  const alreadyAdded = (key: StandardRuleKey) =>
    existingNames.has(tNames(key).toLowerCase());
  const selectedKeys = STANDARD_RULES.filter(
    (r) => !alreadyAdded(r.key) && (checked[r.key] ?? true),
  ).map((r) => r.key);

  function handleOpenChange(next: boolean) {
    if (next) setChecked({});
    setOpen(next);
  }

  async function handleSubmit() {
    setBusy(true);
    try {
      const result = await addStandardRulesAction({ carId, keys: selectedKeys });
      const errorKey = actionErrorKey(result);
      if (errorKey) {
        toast.error(t(errorKey));
      } else {
        for (const rule of result!.data!) upsertRule(rule);
        toast.success(t("car.standardRulesAdded", { count: result!.data!.length }));
        setOpen(false);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("car.addStandardRules")}</DialogTitle>
          <DialogDescription>{t("car.standardRulesDescription")}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] space-y-1 overflow-y-auto">
          {STANDARD_RULES.map((rule) => {
            const disabled = alreadyAdded(rule.key);
            return (
              <label
                key={rule.key}
                className={`flex items-center gap-3 rounded-md p-2 ${
                  disabled ? "opacity-50" : "cursor-pointer hover:bg-accent"
                }`}
              >
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  aria-label={tNames(rule.key)}
                  checked={disabled ? false : (checked[rule.key] ?? true)}
                  disabled={disabled || busy}
                  onChange={(e) =>
                    setChecked((c) => ({ ...c, [rule.key]: e.target.checked }))
                  }
                />
                <span className="flex-1">
                  <span className="block font-medium">{tNames(rule.key)}</span>
                  <span className="block text-sm text-muted-foreground">
                    {disabled
                      ? t("car.standardRulesAlreadyAdded")
                      : intervalSummary(rule)}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        <Button
          size="lg"
          className="w-full"
          disabled={busy || selectedKeys.length === 0}
          onClick={handleSubmit}
        >
          {t("car.standardRulesSubmit", { count: selectedKeys.length })}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
