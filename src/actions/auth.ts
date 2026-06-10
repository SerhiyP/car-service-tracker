"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { signIn, signOut } from "@/auth";
import { ActionError, actionClient } from "@/lib/safe-action";
import { loginSchema, registerSchema } from "@/lib/schemas/auth";
import { createUser, findUserByEmail } from "@/lib/repositories/users";

export const registerAction = actionClient
  .inputSchema(registerSchema)
  .action(async ({ parsedInput }) => {
    const existing = await findUserByEmail(parsedInput.email);
    if (existing) throw new ActionError("auth.emailTaken");

    const passwordHash = await bcrypt.hash(parsedInput.password, 10);
    await createUser({
      name: parsedInput.name,
      email: parsedInput.email,
      passwordHash,
    });

    // Throws NEXT_REDIRECT on success — must propagate.
    await signIn("credentials", {
      email: parsedInput.email,
      password: parsedInput.password,
      redirectTo: "/",
    });
  });

export const loginAction = actionClient
  .inputSchema(loginSchema)
  .action(async ({ parsedInput }) => {
    try {
      await signIn("credentials", { ...parsedInput, redirectTo: "/" });
    } catch (e) {
      if (e instanceof AuthError) throw new ActionError("auth.invalidCredentials");
      throw e; // NEXT_REDIRECT and unknown errors propagate
    }
  });

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
