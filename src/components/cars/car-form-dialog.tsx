"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createCarAction, renameCarAction } from "@/actions/cars";
import { actionErrorKey } from "@/lib/action-feedback";
import { useGarageStore } from "@/stores/garage";
import type { Car } from "@/lib/types";
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

export function CarFormDialog({
  car,
  trigger,
}: {
  car?: Car;
  trigger: React.ReactElement;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { upsertCar } = useGarageStore();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name")).trim();
    setBusy(true);

    try {
      if (car) {
        // Optimistic rename with rollback
        const previous = car;
        upsertCar({ ...car, name });
        setOpen(false);
        const result = await renameCarAction({ carId: car.id, name });
        const errorKey = actionErrorKey(result);
        if (errorKey) {
          upsertCar(previous);
          toast.error(t(errorKey));
        }
      } else {
        const mileage = Number(data.get("mileage"));
        const result = await createCarAction({ name, currentMileage: mileage });
        const errorKey = actionErrorKey(result);
        if (errorKey) {
          toast.error(t(errorKey));
        } else {
          upsertCar(result!.data!);
          setOpen(false);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Base UI uses render prop instead of asChild */}
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{car ? t("garage.editCar") : t("garage.addCar")}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="name">{t("garage.carName")}</Label>
            <Input id="name" name="name" defaultValue={car?.name} required maxLength={100} />
          </div>
          {!car && (
            <div className="space-y-2">
              <Label htmlFor="mileage">{t("garage.mileage")}</Label>
              <Input
                id="mileage"
                name="mileage"
                type="number"
                inputMode="numeric"
                min={0}
                max={9999999}
                required
              />
            </div>
          )}
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            {t("common.save")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
