"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { actionErrorKey } from "@/lib/action-feedback";
import { createLogAction } from "@/actions/logs";
import { useGarageStore } from "@/stores/garage";
import type { Car } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LogServiceDialog({
  car,
  componentName,
  open,
  onOpenChange,
}: {
  car: Car;
  componentName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("car");
  const tRoot = useTranslations();
  const store = useGarageStore();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!componentName) return;
    const data = new FormData(e.currentTarget);
    const mileage = Number(data.get("mileage"));
    const date = String(data.get("date"));

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const previousMileage = car.currentMileage;
    const didRaiseMileage = mileage > previousMileage;

    // Optimistic: add log; raise car mileage if needed
    store.addLog({
      id: tempId,
      carId: car.id,
      componentName,
      mileageAtService: mileage,
      dateAtService: new Date(date).toISOString(),
    });
    if (didRaiseMileage) store.setCarMileage(car.id, mileage);
    onOpenChange(false);

    const result = await createLogAction({
      carId: car.id,
      componentName,
      mileageAtService: mileage,
      dateAtService: new Date(date),
    });

    if (result?.data) {
      store.replaceLog(tempId, result.data.log);
      if (result.data.newCarMileage !== null)
        store.setCarMileage(car.id, result.data.newCarMileage);
    } else {
      store.removeLog(tempId);
      if (didRaiseMileage) store.setCarMileage(car.id, previousMileage);
      const errorKey = actionErrorKey(result);
      if (errorKey) toast.error(tRoot(errorKey));
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("logService")}
            {componentName ? ` — ${componentName}` : ""}
          </DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="log-mileage">{t("serviceMileage")}</Label>
            <Input
              id="log-mileage"
              name="mileage"
              type="number"
              inputMode="numeric"
              min={0}
              defaultValue={car.currentMileage}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="log-date">{t("serviceDate")}</Label>
            <Input id="log-date" name="date" type="date" max={today} defaultValue={today} required />
          </div>
          <Button type="submit" size="lg" className="w-full">
            {t("logService")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
