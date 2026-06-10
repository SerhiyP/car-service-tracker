import { z } from "zod";
import { objectIdSchema } from "./common";

const intervalKm = z.number().int().min(1).max(1_000_000);
const intervalMonths = z.number().int().min(1).max(600);

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
