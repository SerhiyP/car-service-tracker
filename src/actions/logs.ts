"use server";

import { ActionError, authActionClient } from "@/lib/safe-action";
import { logDeleteSchema } from "@/lib/schemas/log";
import { getCar } from "@/lib/repositories/cars";
import { countLogsByVisitId, deleteLog } from "@/lib/repositories/logs";
import { deleteVisit } from "@/lib/repositories/visits";

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
