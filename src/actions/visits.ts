"use server";

import { ActionError, authActionClient } from "@/lib/safe-action";
import { visitDeleteSchema, visitInputSchema, visitUpdateSchema } from "@/lib/schemas/visit";
import { getCar, setCarMileage } from "@/lib/repositories/cars";
import { listRulesByCarIds } from "@/lib/repositories/rules";
import {
  createLogs,
  deleteLog,
  deleteLogsByVisitId,
  deleteLogsByVisitIdAndComponents,
  getLog,
  listLogsByVisitId,
  updateLogsByVisitId,
} from "@/lib/repositories/logs";
import {
  createVisit,
  deleteVisit,
  getVisit,
  updateVisit,
} from "@/lib/repositories/visits";
import type { ServiceLog, ServiceVisit } from "@/lib/types";

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

export const updateVisitAction = authActionClient
  .inputSchema(visitUpdateSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { carId, target } = parsedInput;
    const car = await getCar(ctx.userId, carId);
    if (!car) throw new ActionError("errors.notFound");

    // Resolve the target: an existing visit, or a legacy log converted on save.
    let existingLogs: ServiceLog[];
    let convertedLog: ServiceLog | null = null;
    if ("visitId" in target) {
      if (!(await getVisit(target.visitId, carId)))
        throw new ActionError("errors.notFound");
      existingLogs = await listLogsByVisitId(target.visitId, carId);
    } else {
      const log = await getLog(target.logId, carId);
      // Visit-backed rows must be edited through their visit.
      if (!log || log.visitId) throw new ActionError("errors.notFound");
      convertedLog = log;
      existingLogs = [];
    }

    // Selected components must come from the car's rules or the entry being edited.
    const rules = await listRulesByCarIds([carId]);
    const allowed = new Set([
      ...rules.map((r) => r.componentName),
      ...existingLogs.map((l) => l.componentName),
      ...(convertedLog ? [convertedLog.componentName] : []),
    ]);
    if (!parsedInput.componentNames.every((name) => allowed.has(name)))
      throw new ActionError("errors.notFound");
    const componentNames = [...new Set(parsedInput.componentNames)];

    // Apply to the visit doc (create it when converting a legacy log).
    let visit: ServiceVisit;
    if (convertedLog) {
      visit = await createVisit({
        carId,
        mileageAtService: parsedInput.mileageAtService,
        dateAtService: parsedInput.dateAtService,
        ...(parsedInput.totalCost !== undefined && { totalCost: parsedInput.totalCost }),
      });
    } else {
      const updated = await updateVisit({
        visitId: (target as { visitId: string }).visitId,
        carId,
        mileageAtService: parsedInput.mileageAtService,
        dateAtService: parsedInput.dateAtService,
        ...(parsedInput.totalCost !== undefined && { totalCost: parsedInput.totalCost }),
      });
      if (!updated) throw new ActionError("errors.notFound");
      visit = updated;
    }

    // Diff-sync the visit's logs against the selection.
    const existingNames = new Set(existingLogs.map((l) => l.componentName));
    const toDelete = existingLogs
      .filter((l) => !componentNames.includes(l.componentName))
      .map((l) => l.componentName);
    const toInsert = componentNames.filter((name) => !existingNames.has(name));

    await deleteLogsByVisitIdAndComponents(visit.id, carId, toDelete);
    await updateLogsByVisitId(visit.id, carId, {
      mileageAtService: parsedInput.mileageAtService,
      dateAtService: parsedInput.dateAtService,
    });
    await createLogs({
      carId,
      visitId: visit.id,
      componentNames: toInsert,
      mileageAtService: parsedInput.mileageAtService,
      dateAtService: parsedInput.dateAtService,
    });
    // Converting a legacy log: remove the original last, so a mid-flight
    // failure leaves the source row intact (accepted non-transactional stance).
    if (convertedLog) await deleteLog(convertedLog.id, carId);

    const logs = await listLogsByVisitId(visit.id, carId);

    // Spec: a service at a higher mileage raises the car's current mileage.
    let newCarMileage: number | null = null;
    if (parsedInput.mileageAtService > car.currentMileage) {
      await setCarMileage(ctx.userId, carId, parsedInput.mileageAtService);
      newCarMileage = parsedInput.mileageAtService;
    }

    return { visit, logs, newCarMileage };
  });

export const deleteVisitAction = authActionClient
  .inputSchema(visitDeleteSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { carId, visitId } = parsedInput;
    if (!(await getCar(ctx.userId, carId))) throw new ActionError("errors.notFound");
    if (!(await getVisit(visitId, carId))) throw new ActionError("errors.notFound");
    await deleteLogsByVisitId(visitId, carId);
    await deleteVisit(visitId, carId);
    return { ok: true };
  });
