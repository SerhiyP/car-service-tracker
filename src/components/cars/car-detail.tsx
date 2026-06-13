"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useGarageStore } from "@/stores/garage";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { CarActions } from "./car-actions";
import { RuleList } from "./rule-list";
import { ServiceHistory } from "./service-history";

export function CarDetail({ carId }: { carId: string }) {
  const isServerSyncing = useGarageStore((s) => s.isServerSyncing);
  // isServerSyncing is not persisted, so it is true on the server and during
  // hydration — the selector returns undefined until GarageProvider's first
  // sync, keeping the first client render identical to the server HTML.
  const car = useGarageStore((s) => (s.isServerSyncing ? undefined : s.cars.find((c) => c.id === carId)));
  const selectCar = useGarageStore((s) => s.selectCar);
  const carExists = car !== undefined;
  const t = useTranslations();
  const [tab, setTab] = useState<"history" | "rules">("history");

  // Viewing a car makes it the selected car so the bottom nav's Car/Log
  // items and the dashboard follow it.
  useEffect(() => {
    if (carExists) selectCar(carId);
  }, [carExists, carId, selectCar]);

  if (isServerSyncing) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{car?.name ?? ""}</h2>
        {car && (
          <p className="text-sm text-muted-foreground">
            {car.currentMileage.toLocaleString()} km
          </p>
        )}
      </div>
      {car && <CarActions car={car} />}
      <div className="flex gap-2">
        {(["history", "rules"] as const).map((key) => {
          const selected = tab === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={selected}
              onClick={() => setTab(key)}
              className={cn(
                "h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors",
                selected
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {key === "history" ? t("car.history") : t("car.rules")}
            </button>
          );
        })}
      </div>
      {tab === "history" ? <ServiceHistory carId={carId} /> : <RuleList carId={carId} />}
    </div>
  );
}
