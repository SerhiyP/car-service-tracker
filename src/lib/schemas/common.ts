import { z } from "zod";

export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-f]{24}$/i, "errors.notFound");

export const mileageSchema = z
  .number("validation.mileageInvalid")
  .int("validation.mileageInvalid")
  .min(0, "validation.mileageInvalid")
  .max(9_999_999, "validation.mileageInvalid");
