"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { actionErrorKey } from "@/lib/action-feedback";
import { updateCarMileageAction } from "@/actions/cars";
import { computeMaintenance, latestLogFor } from "@/lib/maintenance";
import { useGarageStore } from "@/stores/garage";
import { Skeleton } from "@/components/ui/skeleton";
import { CarSwitcher } from "./car-switcher";
import { LogServiceDialog } from "./log-service-dialog";
import { MileageForm } from "./mileage-form";
import { StatusCard } from "./status-card";

export function Dashboard() {
  const t = useTranslations("dashboard");
  const tRoot = useTranslations();
  const store = useGarageStore();
  const { cars, rules, logs, selectedCarId, hasHydrated } = store;
  const [logComponent, setLogComponent] = useState<string | null>(null);

  if (!hasHydrated) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const car = cars.find((c) => c.id === selectedCarId) ?? null;

  if (!car) {
    return (
      <div className="space-y-2 py-12 text-center text-muted-foreground">
        <p className="font-medium">{t("noCar")}</p>
        <Link href="/cars" className="underline">
          {t("addFirstCar")}
        </Link>
      </div>
    );
  }

  const carRules = rules.filter((r) => r.carId === car.id);
  const now = new Date();

  async function handleMileage(mileage: number) {
    if (!car) return;
    const previous = car.currentMileage;
    store.setCarMileage(car.id, mileage);
    const result = await updateCarMileageAction({ carId: car.id, mileage });
    if (!result?.data) {
      store.setCarMileage(car.id, previous);
      const errorKey = actionErrorKey(result);
      if (errorKey) toast.error(tRoot(errorKey));
    }
  }

  return (
    <div className="space-y-4">
      <CarSwitcher />
      <MileageForm currentMileage={car.currentMileage} onSubmit={handleMileage} />

      {carRules.length === 0 ? (
        <div className="space-y-2 py-8 text-center text-muted-foreground">
          <p>{t("noRules")}</p>
          <Link href={`/cars/${car.id}`} className="underline">
            {t("addRulesHint")}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {carRules.map((rule) => {
            const last = latestLogFor(logs, car.id, rule.componentName);
            const info = computeMaintenance(
              rule,
              last
                ? {
                    mileageAtService: last.mileageAtService,
                    dateAtService: new Date(last.dateAtService),
                  }
                : null,
              car.currentMileage,
              now,
            );
            return (
              <StatusCard
                key={rule.id}
                componentName={rule.componentName}
                info={info}
                lastService={last}
                onLogService={() => setLogComponent(rule.componentName)}
              />
            );
          })}
        </div>
      )}

      <LogServiceDialog
        car={car}
        componentName={logComponent}
        open={logComponent !== null}
        onOpenChange={(open) => !open && setLogComponent(null)}
      />
    </div>
  );
}
