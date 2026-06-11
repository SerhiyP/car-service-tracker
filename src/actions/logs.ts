"use server";

import { ActionError, authActionClient } from "@/lib/safe-action";
import { logDeleteSchema, logInputSchema } from "@/lib/schemas/log";
import { getCar, setCarMileage } from "@/lib/repositories/cars";
import { createLog, countLogsByVisitId, deleteLog } from "@/lib/repositories/logs";
import { deleteVisit } from "@/lib/repositories/visits";

export const createLogAction = authActionClient
  .inputSchema(logInputSchema)
  .action(async ({ parsedInput, ctx }) => {
    const car = await getCar(ctx.userId, parsedInput.carId);
    if (!car) throw new ActionError("errors.notFound");

    const log = await createLog(parsedInput);

    // Spec: a service at a higher mileage raises the car's current mileage.
    let newCarMileage: number | null = null;
    if (parsedInput.mileageAtService > car.currentMileage) {
      await setCarMileage(ctx.userId, parsedInput.carId, parsedInput.mileageAtService);
      newCarMileage = parsedInput.mileageAtService;
    }

    return { log, newCarMileage };
  });

export const deleteLogAction = authActionClient
  .inputSchema(logDeleteSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!(await getCar(ctx.userId, parsedInput.carId)))
      throw new ActionError("errors.notFound");
    const deleted = await deleteLog(parsedInput.logId, parsedInput.carId);
    if (!deleted) throw new ActionError("errors.notFound");

    // Last log of a visit gone → remove the now-orphaned visit.
    let removedVisitId: string | null = null;
    if (deleted.visitId) {
      const remaining = await countLogsByVisitId(deleted.visitId, parsedInput.carId);
      if (remaining === 0) {
        await deleteVisit(deleted.visitId, parsedInput.carId);
        removedVisitId = deleted.visitId;
      }
    }
    return { ok: true, removedVisitId };
  });
