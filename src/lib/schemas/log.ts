import { z } from "zod";
import { mileageSchema, objectIdSchema } from "./common";

// +1 day tolerance so "today" in any client timezone is accepted.
const notInFuture = (d: Date) => d.getTime() <= Date.now() + 86_400_000;

export const logInputSchema = z.object({
  carId: objectIdSchema,
  componentName: z.string().trim().min(1, "validation.componentRequired").max(100),
  mileageAtService: mileageSchema,
  dateAtService: z.coerce.date().refine(notInFuture, "validation.dateFuture"),
});

export const logDeleteSchema = z.object({
  logId: objectIdSchema,
  carId: objectIdSchema,
});
