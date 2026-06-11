"use server";

import { ActionError, authActionClient } from "@/lib/safe-action";
import {
  carIdSchema,
  carInputSchema,
  carUpdateSchema,
  mileageUpdateSchema,
} from "@/lib/schemas/car";
import {
  createCar,
  deleteCarCascade,
  renameCar,
  setCarMileage,
} from "@/lib/repositories/cars";

export const createCarAction = authActionClient
  .inputSchema(carInputSchema)
  .action(async ({ parsedInput, ctx }) => {
    return await createCar(ctx.userId, parsedInput);
  });

export const renameCarAction = authActionClient
  .inputSchema(carUpdateSchema)
  .action(async ({ parsedInput, ctx }) => {
    const ok = await renameCar(ctx.userId, parsedInput.carId, parsedInput.name);
    if (!ok) throw new ActionError("errors.notFound");
    return { ok: true };
  });

export const updateCarMileageAction = authActionClient
  .inputSchema(mileageUpdateSchema)
  .action(async ({ parsedInput, ctx }) => {
    const ok = await setCarMileage(ctx.userId, parsedInput.carId, parsedInput.mileage);
    if (!ok) throw new ActionError("errors.notFound");
    return { ok: true };
  });

export const deleteCarAction = authActionClient
  .inputSchema(carIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    const ok = await deleteCarCascade(ctx.userId, parsedInput.carId);
    if (!ok) throw new ActionError("errors.notFound");
    return { ok: true };
  });
