"use client";

import { useGarageStore } from "@/stores/garage";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CarSelect() {
  const cars = useGarageStore((s) => s.cars);
  const selectedCarId = useGarageStore((s) => s.selectedCarId);
  const selectCar = useGarageStore((s) => s.selectCar);

  if (cars.length <= 1) return null;

  return (
    <Select value={selectedCarId ?? undefined} onValueChange={(v) => { if (v) selectCar(v); }}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {cars.map((car) => (
          <SelectItem key={car.id} value={car.id}>
            {car.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
