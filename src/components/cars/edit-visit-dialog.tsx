"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { updateVisitAction } from "@/actions/visits";
import { actionErrorKey } from "@/lib/action-feedback";
import { useGarageStore } from "@/stores/garage";
import type { Car, ServiceLog } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Mounted fresh per edit (parent renders it conditionally), so all prefill
// can use defaultValue and the checked map needs no reset logic.
export function EditVisitDialog({
  car,
  editedLog,
  onOpenChange,
}: {
  car: Car;
  editedLog: ServiceLog;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations();
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const store = useGarageStore();
  const visit = useGarageStore((s) => s.visits).find((v) => v.id === editedLog.visitId);
  const currentComponents = useGarageStore((s) => s.logs)
    .filter((l) => editedLog.visitId && l.visitId === editedLog.visitId)
    .map((l) => l.componentName);
  if (currentComponents.length === 0) currentComponents.push(editedLog.componentName);

  const ruleNames = useGarageStore((s) => s.rules)
    .filter((r) => r.carId === car.id)
    .map((r) => r.componentName);
  // A component whose rule was deleted can still be kept or removed.
  const listedNames = [
    ...ruleNames,
    ...currentComponents.filter((name) => !ruleNames.includes(name)),
  ];

  const isChecked = (name: string) => checked[name] ?? currentComponents.includes(name);
  const selected = listedNames.filter(isChecked);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const mileage = Number(data.get("mileage"));
    const date = String(data.get("date"));
    const cost = String(data.get("cost") ?? "").trim();

    setBusy(true);
    try {
      const result = await updateVisitAction({
        carId: car.id,
        target: editedLog.visitId
          ? { visitId: editedLog.visitId }
          : { logId: editedLog.id },
        componentNames: selected,
        mileageAtService: mileage,
        dateAtService: new Date(date),
        ...(cost !== "" && { totalCost: Number(cost) }),
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
        onOpenChange(false);
      }
    } finally {
      setBusy(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const initialDate = (visit?.dateAtService ?? editedLog.dateAtService).slice(0, 10);
  const initialMileage = visit?.mileageAtService ?? editedLog.mileageAtService;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("car.editVisit")}</DialogTitle>
          <DialogDescription>{t("car.logVisitDescription")}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="max-h-[40vh] space-y-1 overflow-y-auto">
            {listedNames.map((name) => (
              <label
                key={name}
                className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-accent"
              >
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  aria-label={name}
                  checked={isChecked(name)}
                  disabled={busy}
                  onChange={(e) =>
                    setChecked((c) => ({ ...c, [name]: e.target.checked }))
                  }
                />
                <span className="flex-1 font-medium">{name}</span>
              </label>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-visit-mileage">{t("car.serviceMileage")}</Label>
            <Input
              id="edit-visit-mileage"
              name="mileage"
              type="number"
              inputMode="numeric"
              min={0}
              defaultValue={initialMileage}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-visit-date">{t("car.serviceDate")}</Label>
            <Input
              id="edit-visit-date"
              name="date"
              type="date"
              max={today}
              defaultValue={initialDate}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-visit-cost">{t("car.totalCost")}</Label>
            <Input
              id="edit-visit-cost"
              name="cost"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              defaultValue={visit?.totalCost ?? ""}
            />
          </div>
          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={busy}
            disabled={selected.length === 0}
          >
            {t("car.saveVisit", { count: selected.length })}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
