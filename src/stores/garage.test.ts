import { beforeEach, describe, expect, it } from "vitest";
import { useGarageStore } from "./garage";
import type { Car, GarageData } from "@/lib/types";

const car = (id: string, mileage = 1000): Car => ({
  id,
  name: `Car ${id}`,
  currentMileage: mileage,
  updatedAt: "2026-06-01T00:00:00.000Z",
});

const data: GarageData = {
  cars: [car("a"), car("b")],
  rules: [],
  logs: [],
  visits: [],
  syncedAt: "2026-06-10T00:00:00.000Z",
};

beforeEach(() => {
  useGarageStore.setState(useGarageStore.getInitialState());
});

describe("garage store", () => {
  it("setAll replaces data and keeps a valid selection", () => {
    useGarageStore.getState().setAll(data);
    const s = useGarageStore.getState();
    expect(s.cars).toHaveLength(2);
    expect(s.selectedCarId).toBe("a");
  });

  it("setAll preserves an existing valid selection", () => {
    useGarageStore.getState().setAll(data);
    useGarageStore.getState().selectCar("b");
    useGarageStore.getState().setAll(data);
    expect(useGarageStore.getState().selectedCarId).toBe("b");
  });

  it("setCarMileage updates the car", () => {
    useGarageStore.getState().setAll(data);
    useGarageStore.getState().setCarMileage("a", 2222);
    expect(useGarageStore.getState().cars.find((c) => c.id === "a")?.currentMileage).toBe(2222);
  });

  it("removeCar drops its rules/logs and fixes selection", () => {
    useGarageStore.getState().setAll({
      ...data,
      rules: [{ id: "r1", carId: "a", componentName: "Oil", intervalKm: 1 }],
      logs: [
        {
          id: "l1",
          carId: "a",
          componentName: "Oil",
          mileageAtService: 1,
          dateAtService: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    useGarageStore.getState().removeCar("a");
    const s = useGarageStore.getState();
    expect(s.cars.map((c) => c.id)).toEqual(["b"]);
    expect(s.rules).toHaveLength(0);
    expect(s.logs).toHaveLength(0);
    expect(s.selectedCarId).toBe("b");
  });

});
