"use client";

import { useEffect } from "react";
import { useGarageStore } from "@/stores/garage";
import { RuleList } from "./rule-list";
import { ServiceHistory } from "./service-history";

export function CarDetail({ carId }: { carId: string }) {
  const car = useGarageStore((s) => s.cars).find((c) => c.id === carId);
  const selectCar = useGarageStore((s) => s.selectCar);
  const carExists = car !== undefined;

  // Viewing a car makes it the selected car so the bottom nav's Car/Log
  // items and the dashboard follow it.
  useEffect(() => {
    if (carExists) selectCar(carId);
  }, [carExists, carId, selectCar]);

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
      <RuleList carId={carId} />
      <ServiceHistory carId={carId} />
    </div>
  );
}
