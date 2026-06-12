"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { createVisitAction } from "@/actions/visits";
import { actionErrorKey } from "@/lib/action-feedback";
import { useGarageStore } from "@/stores/garage";
import { Button } from "@/components/ui/button";
import { VisitForm } from "./visit-form";

export function LogVisitPage({ carId }: { carId: string }) {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const store = useGarageStore();
  const car = useGarageStore((s) => s.cars).find((c) => c.id === carId) ?? null;
  const ruleNames = useGarageStore((s) => s.rules)
    .filter((r) => r.carId === carId)
    .map((r) => r.componentName);

  useEffect(() => {
    if (!car) router.replace("/");
  }, [car, router]);

  function goBack() {
    router.back();
  }

  async function handleSubmit(values: {
    componentNames: string[];
    mileage: number;
    date: string;
    cost: string;
  }) {
    if (!car) return;
    setBusy(true);
    try {
      const result = await createVisitAction({
        carId: car.id,
        componentNames: values.componentNames,
        mileageAtService: values.mileage,
        dateAtService: new Date(values.date),
        ...(values.cost !== "" && { totalCost: Number(values.cost) }),
      });
      const errorKey = actionErrorKey(result);
      if (errorKey) {
        toast.error(t(errorKey));
      } else {
        const { visit, logs, newCarMileage } = result!.data!;
        store.addVisit(visit);
        for (const log of logs) store.addLog(log);
        if (newCarMileage !== null) store.setCarMileage(car.id, newCarMileage);
        toast.success(t("car.visitLogged", { count: logs.length }));
        goBack();
      }
    } finally {
      setBusy(false);
    }
  }

  if (!car) return null;

  const preselectedComponent = searchParams.get("component");
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label={t("common.back")} onClick={goBack}>
          <ArrowLeft className="size-5" />
        </Button>
        <h2 className="text-lg font-semibold">{t("car.logServices")}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{t("car.logVisitDescription")}</p>
      <VisitForm
        listedNames={ruleNames}
        initialChecked={preselectedComponent ? [preselectedComponent] : []}
        initialMileage={car.currentMileage}
        initialDate={today}
        submitLabel={(count) => t("car.logVisitSubmit", { count })}
        busy={busy}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
