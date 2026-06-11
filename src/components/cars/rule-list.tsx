"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { deleteRuleAction } from "@/actions/rules";
import { actionErrorKey } from "@/lib/action-feedback";
import { useGarageStore } from "@/stores/garage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RuleFormDialog } from "./rule-form-dialog";

export function RuleList({ carId }: { carId: string }) {
  const t = useTranslations();
  const rules = useGarageStore((s) => s.rules).filter((r) => r.carId === carId);
  const store = useGarageStore();

  async function handleDelete(ruleId: string) {
    if (!window.confirm(t("car.deleteRuleConfirm"))) return;
    const previous = store.rules;
    store.removeRule(ruleId);
    const result = await deleteRuleAction({ ruleId, carId });
    const errorKey = actionErrorKey(result);
    if (errorKey) {
      useGarageStore.setState({ rules: previous });
      toast.error(t(errorKey));
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold">{t("car.rules")}</h3>
      {rules.map((rule) => (
        <Card key={rule.id}>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{rule.componentName}</p>
              <p className="text-sm text-muted-foreground">
                {[
                  rule.intervalKm !== undefined &&
                    `${rule.intervalKm.toLocaleString()} km`,
                  rule.intervalMonths !== undefined && `${rule.intervalMonths} mo`,
                ]
                  .filter(Boolean)
                  .join(" / ")}
              </p>
            </div>
            <div className="flex gap-1">
              <RuleFormDialog
                carId={carId}
                rule={rule}
                trigger={
                  <Button variant="ghost" size="icon" aria-label={t("common.edit")}>
                    <Pencil className="size-4" />
                  </Button>
                }
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("common.delete")}
                onClick={() => handleDelete(rule.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      <RuleFormDialog
        carId={carId}
        trigger={
          <Button variant="outline" className="w-full">
            <Plus className="size-4" /> {t("car.addRule")}
          </Button>
        }
      />
    </div>
  );
}
