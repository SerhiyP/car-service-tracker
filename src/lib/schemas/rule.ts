import { z } from "zod";
import { objectIdSchema } from "./common";

const intervalKm = z.number("validation.intervalInvalid").int("validation.intervalInvalid").min(1, "validation.intervalInvalid").max(1_000_000, "validation.intervalInvalid");
const intervalMonths = z.number("validation.intervalInvalid").int("validation.intervalInvalid").min(1, "validation.intervalInvalid").max(600, "validation.intervalInvalid");

export const ruleInputSchema = z
  .object({
    carId: objectIdSchema,
    componentName: z.string().trim().min(1, "validation.componentRequired").max(100),
    intervalKm: intervalKm.optional(),
    intervalMonths: intervalMonths.optional(),
  })
  .refine((r) => r.intervalKm !== undefined || r.intervalMonths !== undefined, {
    message: "validation.intervalRequired",
    path: ["intervalKm"],
  });

export const ruleUpdateSchema = z
  .object({
    ruleId: objectIdSchema,
    carId: objectIdSchema,
    componentName: z.string().trim().min(1, "validation.componentRequired").max(100),
    intervalKm: intervalKm.optional(),
    intervalMonths: intervalMonths.optional(),
  })
  .refine((r) => r.intervalKm !== undefined || r.intervalMonths !== undefined, {
    message: "validation.intervalRequired",
    path: ["intervalKm"],
  });

export const ruleDeleteSchema = z.object({
  ruleId: objectIdSchema,
  carId: objectIdSchema,
});
