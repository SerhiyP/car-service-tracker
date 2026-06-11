"use client";

import { useEffect } from "react";
import { useGarageStore } from "@/stores/garage";
import { Skeleton } from "@/components/ui/skeleton";
import { CarActions } from "./car-actions";
import { RuleList } from "./rule-list";
import { ServiceHistory } from "./service-history";

export function CarDetail({ carId }: { carId: string }) {
  const car = useGarageStore((s) => s.cars).find((c) => c.id === carId);
  const selectCar = useGarageStore((s) => s.selectCar);
  const isServerSyncing = useGarageStore((s) => s.isServerSyncing);
  const carExists = car !== undefined;

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
      <ServiceHistory carId={carId} />
      <RuleList carId={carId} />
    </div>
  );
}
