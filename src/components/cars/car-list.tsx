"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { CarFront, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteCarAction } from "@/actions/cars";
import { actionErrorKey } from "@/lib/action-feedback";
import { computeMaintenance, latestLogFor } from "@/lib/maintenance";
import { useGarageStore } from "@/stores/garage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CarFormDialog } from "./car-form-dialog";

export function CarList() {
  const t = useTranslations();
  const format = useFormatter();
  const cars = useGarageStore((s) => s.cars);
  const rules = useGarageStore((s) => s.rules);
  const logs = useGarageStore((s) => s.logs);
  const isServerSyncing = useGarageStore((s) => s.isServerSyncing);
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

  if (isServerSyncing) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const now = new Date();

  return (
    <div className="space-y-3">
      {cars.length === 0 && (
        <div className="flex flex-col items-center gap-1 py-10 text-center">
          <CarFront className="mb-2 size-10 text-muted-foreground/40" aria-hidden="true" />
          <p className="font-medium">{t("garage.noCars")}</p>
          <p className="text-sm text-muted-foreground">{t("garage.noCarsHint")}</p>
        </div>
      )}
      {cars.map((car) => {
        const carRules = rules.filter((r) => r.carId === car.id);
        const ruleCount = carRules.length;
        const carLogs = logs.filter((l) => l.carId === car.id);
        const lastServiceDate =
          carLogs.length > 0
            ? carLogs.reduce(
                (max, l) => (l.dateAtService > max ? l.dateAtService : max),
                carLogs[0].dateAtService,
              )
            : null;

        let redCount = 0;
        let yellowCount = 0;
        for (const rule of carRules) {
          const last = latestLogFor(logs, car.id, rule.componentName);
          if (!last) continue;
          const info = computeMaintenance(
            rule,
            {
              mileageAtService: last.mileageAtService,
              dateAtService: new Date(last.dateAtService),
            },
            car.currentMileage,
            now,
          );
          if (info.status === "red") redCount++;
          else if (info.status === "yellow") yellowCount++;
        }

        const badge =
          redCount > 0 ? (
            <Badge variant="destructive" className="text-xs font-normal">
              {t("garage.overdueCount", { count: redCount })}
            </Badge>
          ) : yellowCount > 0 ? (
            <Badge className="bg-amber-100 text-xs font-normal text-amber-800 dark:bg-amber-900 dark:text-amber-200">
              {t("garage.dueCount", { count: yellowCount })}
            </Badge>
          ) : null;

        return (
          <Card key={car.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/cars/${car.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-lg font-semibold">{car.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {car.currentMileage.toLocaleString()} km
                  </p>
                </Link>
                <div className="flex shrink-0 gap-1">
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
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span>{t("garage.rulesCount", { count: ruleCount })}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {lastServiceDate
                    ? t("garage.lastService", {
                        date: format.dateTime(new Date(lastServiceDate), {
                          dateStyle: "medium",
                        }),
                      })
                    : t("garage.neverServiced")}
                </span>
                {badge}
              </div>
            </CardContent>
          </Card>
        );
      })}
      <CarFormDialog
        trigger={
          <Button size="lg" className="w-full">
            <Plus className="size-4" /> {t("garage.addCar")}
          </Button>
        }
      />
    </div>
  );
}
