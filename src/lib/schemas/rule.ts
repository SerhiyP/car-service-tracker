import { z } from "zod";
import { STANDARD_RULE_KEYS } from "@/lib/standard-rules";
import { COMPONENT_ICON_KEYS } from "@/lib/types";
import { objectIdSchema } from "./common";

const intervalKm = z.number("validation.intervalInvalid").int("validation.intervalInvalid").min(1, "validation.intervalInvalid").max(1_000_000, "validation.intervalInvalid");
const intervalMonths = z.number("validation.intervalInvalid").int("validation.intervalInvalid").min(1, "validation.intervalInvalid").max(600, "validation.intervalInvalid");
const iconSchema = z.enum(COMPONENT_ICON_KEYS);

export const ruleInputSchema = z
  .object({
    carId: objectIdSchema,
    componentName: z.string().trim().min(1, "validation.componentRequired").max(100),
    intervalKm: intervalKm.optional(),
    intervalMonths: intervalMonths.optional(),
    icon: iconSchema.optional(),
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
    icon: iconSchema.optional(),
  })
  .refine((r) => r.intervalKm !== undefined || r.intervalMonths !== undefined, {
    message: "validation.intervalRequired",
    path: ["intervalKm"],
  });

export const ruleDeleteSchema = z.object({
  ruleId: objectIdSchema,
  carId: objectIdSchema,
});

export const standardRulesInputSchema = z.object({
  carId: objectIdSchema,
  keys: z
    .array(z.enum(STANDARD_RULE_KEYS))
    .min(1, "validation.componentRequired")
    .max(STANDARD_RULE_KEYS.length),
});
