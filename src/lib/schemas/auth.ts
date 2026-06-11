import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("validation.emailInvalid"),
  password: z.string().min(1, "validation.passwordMin").max(200, "auth.invalidCredentials"),
});

export const registerSchema = z.object({
  name: z.string().trim().min(1, "validation.nameRequired").max(100),
  email: z.email("validation.emailInvalid"),
  password: z.string().min(8, "validation.passwordMin").max(200, "validation.passwordMax"),
});

export const verifyEmailSchema = z.object({
  email: z.email("validation.emailInvalid"),
  code: z.string().regex(/^\d{6}$/, "validation.codeInvalid"),
});

export const resendCodeSchema = z.object({
  email: z.email("validation.emailInvalid"),
});
