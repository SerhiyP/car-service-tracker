"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { deleteCarAction } from "@/actions/cars";
import { actionErrorKey } from "@/lib/action-feedback";
import { useGarageStore } from "@/stores/garage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CarFormDialog } from "./car-form-dialog";

export function CarList() {
  const t = useTranslations();
  const cars = useGarageStore((s) => s.cars);
  const store = useGarageStore();

  async function handleDelete(carId: string) {
    if (!window.confirm(t("garage.deleteCarConfirm"))) return;
    const snapshot = {
      cars: store.cars,
      rules: store.rules,
      logs: store.logs,
      selectedCarId: store.selectedCarId,
    };
    store.removeCar(carId);
    const result = await deleteCarAction({ carId });
    const errorKey = actionErrorKey(result);
    if (errorKey) {
      useGarageStore.setState(snapshot);
      toast.error(t(errorKey));
    }
  }

  return (
    <div className="space-y-3">
      {cars.map((car) => (
        <Card key={car.id}>
          <CardContent className="flex items-center justify-between p-4">
            <Link href={`/cars/${car.id}`} className="min-w-0 flex-1">
              <p className="truncate font-medium">{car.name}</p>
              <p className="text-sm text-muted-foreground">
                {car.currentMileage.toLocaleString()} km
              </p>
            </Link>
            <div className="flex gap-1">
              <CarFormDialog
                car={car}
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
                onClick={() => handleDelete(car.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      <CarFormDialog
        trigger={
          <Button className="w-full">
            <Plus className="size-4" /> {t("garage.addCar")}
          </Button>
        }
      />
    </div>
  );
}
