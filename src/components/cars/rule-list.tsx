"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ListChecks, Pencil, Plus, Trash2, Wrench } from "lucide-react";
import { deleteRuleAction } from "@/actions/rules";
import { actionErrorKey } from "@/lib/action-feedback";
import { useGarageStore } from "@/stores/garage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RuleFormDialog } from "./rule-form-dialog";
import { StandardRulesDialog } from "./standard-rules-dialog";

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
      <h3 className="text-sm font-medium text-muted-foreground">{t("car.rules")}</h3>
      {rules.length === 0 && (
        <div className="flex flex-col items-center gap-1 py-8 text-center">
          <Wrench className="mb-2 size-10 text-muted-foreground/40" aria-hidden="true" />
          <p className="font-medium">{t("car.noRules")}</p>
          <p className="text-sm text-muted-foreground">{t("car.noRulesHint")}</p>
        </div>
      )}
      {rules.map((rule) => (
        <Card key={rule.id}>
          <CardContent className="flex items-center justify-between">
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
      <div className="grid grid-cols-2 gap-2">
        <RuleFormDialog
          carId={carId}
          trigger={
            <Button variant="outline" size="lg">
              <Plus className="size-4" /> {t("car.addRule")}
            </Button>
          }
        />
        <StandardRulesDialog
          carId={carId}
          trigger={
            <Button variant="outline" size="lg">
              <ListChecks className="size-4" /> {t("car.addStandardRules")}
            </Button>
          }
        />
      </div>
    </div>
  );
}
