import { z } from "zod";
import { mileageSchema, objectIdSchema } from "./common";

export const carInputSchema = z.object({
  name: z.string().trim().min(1, "validation.nameRequired").max(100),
  currentMileage: mileageSchema,
});

export const carUpdateSchema = z.object({
  carId: objectIdSchema,
  name: z.string().trim().min(1, "validation.nameRequired").max(100),
});

export const mileageUpdateSchema = z.object({
  carId: objectIdSchema,
  mileage: mileageSchema,
});

export const carIdSchema = z.object({ carId: objectIdSchema });
