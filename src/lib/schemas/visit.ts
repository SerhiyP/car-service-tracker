import { z } from "zod";
import { mileageSchema, objectIdSchema } from "./common";

// +1 day tolerance so "today" in any client timezone is accepted.
const notInFuture = (d: Date) => d.getTime() <= Date.now() + 86_400_000;

const visitFields = {
  componentNames: z
    .array(z.string().trim().min(1, "validation.componentRequired").max(100))
    .min(1, "validation.componentsRequired")
    .max(100),
  mileageAtService: mileageSchema,
  dateAtService: z.coerce.date().refine(notInFuture, "validation.dateFuture"),
  totalCost: z
    .number("validation.costInvalid")
    .min(0, "validation.costInvalid")
    .max(99_999_999, "validation.costInvalid")
    .optional(),
};

export const visitInputSchema = z.object({
  carId: objectIdSchema,
  ...visitFields,
});

export const visitUpdateSchema = z.object({
  carId: objectIdSchema,
  // An existing visit, or a legacy (pre-visit) log converted on save.
  target: z.union([
    z.object({ visitId: objectIdSchema }),
    z.object({ logId: objectIdSchema }),
  ]),
  ...visitFields,
});
