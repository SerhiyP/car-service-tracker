"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Car, GarageData, MaintenanceRule, ServiceLog } from "@/lib/types";

interface GarageState {
  cars: Car[];
  rules: MaintenanceRule[];
  logs: ServiceLog[];
  selectedCarId: string | null;
  syncedAt: string | null;
  hasHydrated: boolean;

  setAll: (data: GarageData) => void;
  selectCar: (carId: string) => void;
  upsertCar: (car: Car) => void;
  removeCar: (carId: string) => void;
  setCarMileage: (carId: string, mileage: number) => void;
  upsertRule: (rule: MaintenanceRule) => void;
  removeRule: (ruleId: string) => void;
  addLog: (log: ServiceLog) => void;
  replaceLog: (oldId: string, log: ServiceLog) => void;
  removeLog: (logId: string) => void;
  setHasHydrated: (v: boolean) => void;
}

export const useGarageStore = create<GarageState>()(
  persist(
    (set) => ({
      cars: [],
      rules: [],
      logs: [],
      selectedCarId: null,
      syncedAt: null,
      hasHydrated: false,

      setAll: (data) =>
        set((s) => ({
          cars: data.cars,
          rules: data.rules,
          logs: data.logs,
          syncedAt: data.syncedAt,
          selectedCarId: data.cars.some((c) => c.id === s.selectedCarId)
            ? s.selectedCarId
            : (data.cars[0]?.id ?? null),
        })),

      selectCar: (carId) => set({ selectedCarId: carId }),

      upsertCar: (car) =>
        set((s) => ({
          cars: s.cars.some((c) => c.id === car.id)
            ? s.cars.map((c) => (c.id === car.id ? car : c))
            : [...s.cars, car],
          selectedCarId: s.selectedCarId ?? car.id,
        })),

      removeCar: (carId) =>
        set((s) => {
          const cars = s.cars.filter((c) => c.id !== carId);
          return {
            cars,
            rules: s.rules.filter((r) => r.carId !== carId),
            logs: s.logs.filter((l) => l.carId !== carId),
            selectedCarId:
              s.selectedCarId === carId ? (cars[0]?.id ?? null) : s.selectedCarId,
          };
        }),

      setCarMileage: (carId, mileage) =>
        set((s) => ({
          cars: s.cars.map((c) =>
            c.id === carId ? { ...c, currentMileage: mileage } : c,
          ),
        })),

      upsertRule: (rule) =>
        set((s) => ({
          rules: s.rules.some((r) => r.id === rule.id)
            ? s.rules.map((r) => (r.id === rule.id ? rule : r))
            : [...s.rules, rule],
        })),

      removeRule: (ruleId) =>
        set((s) => ({ rules: s.rules.filter((r) => r.id !== ruleId) })),

      addLog: (log) => set((s) => ({ logs: [log, ...s.logs] })),

      replaceLog: (oldId, log) =>
        set((s) => ({ logs: s.logs.map((l) => (l.id === oldId ? log : l)) })),

      removeLog: (logId) =>
        set((s) => ({ logs: s.logs.filter((l) => l.id !== logId) })),

      setHasHydrated: (v) => set({ hasHydrated: v }),
    }),
    {
      name: "garage-store",
      version: 0,
      partialize: (s) => ({
        cars: s.cars,
        rules: s.rules,
        logs: s.logs,
        selectedCarId: s.selectedCarId,
        syncedAt: s.syncedAt,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
