import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("validation.emailInvalid"),
  password: z.string().min(1, "validation.passwordMin"),
});

export const registerSchema = z.object({
  name: z.string().trim().min(1, "validation.nameRequired").max(100),
  email: z.email("validation.emailInvalid"),
  password: z.string().min(8, "validation.passwordMin").max(200),
});
