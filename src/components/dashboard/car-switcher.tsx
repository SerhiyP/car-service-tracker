"use client";

import { useGarageStore } from "@/stores/garage";
import { cn } from "@/lib/utils";

export function CarSwitcher() {
  const cars = useGarageStore((s) => s.cars);
  const selectedCarId = useGarageStore((s) => s.selectedCarId);
  const selectCar = useGarageStore((s) => s.selectCar);

  if (cars.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto">
      {cars.map((car) => {
        const selected = car.id === selectedCarId;
        return (
          <button
            key={car.id}
            type="button"
            aria-pressed={selected}
            onClick={() => selectCar(car.id)}
            className={cn(
              "h-9 max-w-48 shrink-0 truncate rounded-full border px-4 text-sm font-medium transition-colors",
              selected
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {car.name}
          </button>
        );
      })}
    </div>
  );
}
