"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { updateVisitAction } from "@/actions/visits";
import { actionErrorKey } from "@/lib/action-feedback";
import { useGarageStore } from "@/stores/garage";
import { Button } from "@/components/ui/button";
import { VisitForm } from "./visit-form";

export function EditVisitPage({ carId, logId }: { carId: string; logId: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const store = useGarageStore();
  const car = useGarageStore((s) => s.cars).find((c) => c.id === carId) ?? null;
  const editedLog = useGarageStore((s) => s.logs).find((l) => l.id === logId) ?? null;
  const visit = useGarageStore((s) => s.visits).find((v) => v.id === editedLog?.visitId) ?? null;
  const currentComponents = useGarageStore((s) => s.logs)
    .filter((l) => editedLog?.visitId != null && l.visitId === editedLog.visitId)
    .map((l) => l.componentName);
  if (currentComponents.length === 0 && editedLog) {
    currentComponents.push(editedLog.componentName);
  }
  const ruleNames = useGarageStore((s) => s.rules)
    .filter((r) => r.carId === carId)
    .map((r) => r.componentName);
  const listedNames = [
    ...ruleNames,
    ...currentComponents.filter((name) => !ruleNames.includes(name)),
  ];

  useEffect(() => {
    if (!car || !editedLog || editedLog.carId !== carId) router.replace("/");
  }, [car, editedLog, carId, router]);

  function goBack() {
    router.back();
  }

  async function handleSubmit(values: {
    componentNames: string[];
    mileage: number;
    date: string;
    cost: string;
  }) {
    if (!car || !editedLog) return;
    setBusy(true);
    try {
      const result = await updateVisitAction({
        carId: car.id,
        target: editedLog.visitId
          ? { visitId: editedLog.visitId }
          : { logId: editedLog.id },
        componentNames: values.componentNames,
        mileageAtService: values.mileage,
        dateAtService: new Date(values.date),
        ...(values.cost !== "" && { totalCost: Number(values.cost) }),
      });
      const errorKey = actionErrorKey(result);
      if (errorKey) {
        toast.error(t(errorKey));
      } else {
        const { visit: updatedVisit, logs, newCarMileage } = result!.data!;
        store.applyVisitUpdate(
          updatedVisit,
          logs,
          editedLog.visitId ? undefined : editedLog.id,
        );
        if (newCarMileage !== null) store.setCarMileage(car.id, newCarMileage);
        toast.success(t("car.visitUpdated"));
        goBack();
      }
    } finally {
      setBusy(false);
    }
  }

  if (!car || !editedLog || editedLog.carId !== carId) return null;

  const initialDate = (visit?.dateAtService ?? editedLog.dateAtService).slice(0, 10);
  const initialMileage = visit?.mileageAtService ?? editedLog.mileageAtService;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label={t("common.back")} onClick={goBack}>
          <ArrowLeft className="size-5" />
        </Button>
        <h2 className="text-lg font-semibold">{t("car.editVisit")}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{t("car.logVisitDescription")}</p>
      <VisitForm
        listedNames={listedNames}
        initialChecked={currentComponents}
        initialMileage={initialMileage}
        initialDate={initialDate}
        initialCost={visit?.totalCost ?? undefined}
        submitLabel={(count) => t("car.saveVisit", { count })}
        busy={busy}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
