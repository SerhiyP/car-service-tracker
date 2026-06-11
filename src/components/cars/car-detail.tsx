"use client";

import { useGarageStore } from "@/stores/garage";
import { RuleList } from "./rule-list";
import { ServiceHistory } from "./service-history";

export function CarDetail({ carId }: { carId: string }) {
  const car = useGarageStore((s) => s.cars).find((c) => c.id === carId);

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
