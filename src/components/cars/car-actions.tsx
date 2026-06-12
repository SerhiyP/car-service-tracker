"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ClipboardList, ListChecks, Plus } from "lucide-react";
import { useGarageStore } from "@/stores/garage";
import { cn } from "@/lib/utils";
import type { Car } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { RuleFormDialog } from "./rule-form-dialog";
import { StandardRulesDialog } from "./standard-rules-dialog";

export function CarActions({ car }: { car: Car }) {
  const t = useTranslations();
  const router = useRouter();
  const ruleCount = useGarageStore((s) => s.rules).filter(
    (r) => r.carId === car.id,
  ).length;
  const hasRules = ruleCount > 0;
  // The standard-rules picker is an onboarding shortcut; once the car has a
  // real rule set, hide it so a bulk add can't trample tuned intervals.
  const showStandardRules = ruleCount <= 3;

  return (
    <div className="space-y-2">
      <Button
        size="lg"
        className="w-full"
        disabled={!hasRules}
        title={!hasRules ? t("car.noRulesHint") : undefined}
        onClick={() => router.push(`/cars/${car.id}/log-visit`)}
      >
        <ClipboardList className="size-4" /> {t("car.logServices")}
      </Button>
      <div className={cn("grid gap-2", showStandardRules ? "grid-cols-2" : "grid-cols-1")}>
        <RuleFormDialog
          carId={car.id}
          trigger={
            <Button variant="outline" size="lg">
              <Plus className="size-4" /> {t("car.addRule")}
            </Button>
          }
        />
        {showStandardRules && (
          <StandardRulesDialog
            carId={car.id}
            trigger={
              <Button variant="outline" size="lg">
                <ListChecks className="size-4" /> {t("car.addStandardRules")}
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}
