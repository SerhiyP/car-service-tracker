import { z } from "zod";
import { objectIdSchema } from "./common";

export const logDeleteSchema = z.object({
  logId: objectIdSchema,
  carId: objectIdSchema,
});
