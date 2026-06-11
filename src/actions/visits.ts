"use server";

import { ActionError, authActionClient } from "@/lib/safe-action";
import { visitInputSchema } from "@/lib/schemas/visit";
import { getCar, setCarMileage } from "@/lib/repositories/cars";
import { listRulesByCarIds } from "@/lib/repositories/rules";
import { createLogs } from "@/lib/repositories/logs";
import { createVisit, deleteVisit } from "@/lib/repositories/visits";

export const createVisitAction = authActionClient
  .inputSchema(visitInputSchema)
  .action(async ({ parsedInput, ctx }) => {
    const car = await getCar(ctx.userId, parsedInput.carId);
    if (!car) throw new ActionError("errors.notFound");

    // Only the car's own rules may be logged — never trust client-supplied names.
    const rules = await listRulesByCarIds([parsedInput.carId]);
    const ruleNames = new Set(rules.map((r) => r.componentName));
    if (!parsedInput.componentNames.every((name) => ruleNames.has(name)))
      throw new ActionError("errors.notFound");

    const componentNames = [...new Set(parsedInput.componentNames)];

    const visit = await createVisit({
      carId: parsedInput.carId,
      mileageAtService: parsedInput.mileageAtService,
      dateAtService: parsedInput.dateAtService,
      ...(parsedInput.totalCost !== undefined && { totalCost: parsedInput.totalCost }),
    });
    let logs;
    try {
      logs = await createLogs({
        carId: parsedInput.carId,
        visitId: visit.id,
        componentNames,
        mileageAtService: parsedInput.mileageAtService,
        dateAtService: parsedInput.dateAtService,
      });
    } catch (error) {
      // No transactions here — compensate so no orphan visit survives a failed log insert.
      await deleteVisit(visit.id, parsedInput.carId);
      throw error;
    }

    // Spec: a service at a higher mileage raises the car's current mileage.
    let newCarMileage: number | null = null;
    if (parsedInput.mileageAtService > car.currentMileage) {
      await setCarMileage(ctx.userId, parsedInput.carId, parsedInput.mileageAtService);
      newCarMileage = parsedInput.mileageAtService;
    }

    return { visit, logs, newCarMileage };
  });
