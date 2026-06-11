"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ClipboardList, ListChecks, Plus } from "lucide-react";
import { useGarageStore } from "@/stores/garage";
import type { Car } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { LogVisitDialog } from "./log-visit-dialog";
import { RuleFormDialog } from "./rule-form-dialog";
import { StandardRulesDialog } from "./standard-rules-dialog";

export function CarActions({ car }: { car: Car }) {
  const t = useTranslations();
  const [logOpen, setLogOpen] = useState(false);
  const hasRules = useGarageStore((s) => s.rules).some((r) => r.carId === car.id);

  return (
    <div className="space-y-2">
      <Button
        size="lg"
        className="w-full"
        disabled={!hasRules}
        onClick={() => setLogOpen(true)}
      >
        <ClipboardList className="size-4" /> {t("car.logServices")}
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <RuleFormDialog
          carId={car.id}
          trigger={
            <Button variant="outline" size="lg">
              <Plus className="size-4" /> {t("car.addRule")}
            </Button>
          }
        />
        <StandardRulesDialog
          carId={car.id}
          trigger={
            <Button variant="outline" size="lg">
              <ListChecks className="size-4" /> {t("car.addStandardRules")}
            </Button>
          }
        />
      </div>
      <LogVisitDialog car={car} open={logOpen} onOpenChange={setLogOpen} />
    </div>
  );
}
