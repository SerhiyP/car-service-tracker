"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { actionErrorKey } from "@/lib/action-feedback";
import { updateCarMileageAction } from "@/actions/cars";
import {
  compareMaintenanceUrgency,
  computeMaintenance,
  latestLogFor,
} from "@/lib/maintenance";
import { useGarageStore } from "@/stores/garage";
import { Skeleton } from "@/components/ui/skeleton";
import { CarSwitcher } from "./car-switcher";
import { MileageForm } from "./mileage-form";
import { StatusCard } from "./status-card";

export function Dashboard() {
  const t = useTranslations("dashboard");
  const tRoot = useTranslations();
  const router = useRouter();
  const store = useGarageStore();
  const { cars, rules, logs, selectedCarId, isServerSyncing } = store;

  if (isServerSyncing) {
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
  // Never-serviced rules are hidden from the dashboard to keep it focused;
  // the hint below links to the car page where first services get logged.
  const servicedRules = carRules.filter(
    (rule) => latestLogFor(logs, car.id, rule.componentName) !== null,
  );
  const hiddenCount = carRules.length - servicedRules.length;
  const now = new Date();

  async function handleMileage(mileage: number) {
    if (!car) return false;
    const previous = car.currentMileage;
    store.setCarMileage(car.id, mileage);
    const result = await updateCarMileageAction({ carId: car.id, mileage });
    if (!result?.data) {
      store.setCarMileage(car.id, previous);
      const errorKey = actionErrorKey(result);
      if (errorKey) toast.error(tRoot(errorKey));
      return false;
    }
    return true;
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
          {servicedRules
            .map((rule) => {
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
              return { rule, last, info };
            })
            .sort((a, b) => compareMaintenanceUrgency(a.info, b.info))
            .map(({ rule, last, info }) => (
              <StatusCard
                key={rule.id}
                componentName={rule.componentName}
                info={info}
                lastService={last}
                onLogService={() =>
                  router.push(
                    `/cars/${car.id}/log-visit?component=${encodeURIComponent(rule.componentName)}`,
                  )
                }
              />
            ))}
          {hiddenCount > 0 && (
            <p className="text-center text-sm text-muted-foreground">
              <Link href={`/cars/${car.id}`} className="underline">
                {t("hiddenRules", { count: hiddenCount })}
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
