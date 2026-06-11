import { z } from "zod";
import { mileageSchema, objectIdSchema } from "./common";

// +1 day tolerance so "today" in any client timezone is accepted.
const notInFuture = (d: Date) => d.getTime() <= Date.now() + 86_400_000;

export const visitInputSchema = z.object({
  carId: objectIdSchema,
  componentNames: z
    .array(z.string().trim().min(1, "validation.componentRequired").max(100))
    .min(1, "validation.componentsRequired"),
  mileageAtService: mileageSchema,
  dateAtService: z.coerce.date().refine(notInFuture, "validation.dateFuture"),
  totalCost: z
    .number("validation.costInvalid")
    .min(0, "validation.costInvalid")
    .max(99_999_999, "validation.costInvalid")
    .optional(),
});
