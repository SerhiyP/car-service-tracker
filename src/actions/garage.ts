"use server";

import { authActionClient } from "@/lib/safe-action";
import { listCars } from "@/lib/repositories/cars";
import { listRulesByCarIds } from "@/lib/repositories/rules";
import { listLogsByCarIds } from "@/lib/repositories/logs";
import type { GarageData } from "@/lib/types";

export const getGarageDataAction = authActionClient.action(
  async ({ ctx }): Promise<GarageData> => {
    const cars = await listCars(ctx.userId);
    const carIds = cars.map((c) => c.id);
    const [rules, logs] = await Promise.all([
      listRulesByCarIds(carIds),
      listLogsByCarIds(carIds),
    ]);
    return { cars, rules, logs, syncedAt: new Date().toISOString() };
  },
);
