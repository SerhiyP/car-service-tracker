"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { MongoServerError } from "mongodb";
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
    try {
      await createUser({
        name: parsedInput.name,
        email: parsedInput.email,
        passwordHash,
      });
    } catch (e) {
      if (e instanceof MongoServerError && e.code === 11000) {
        throw new ActionError("auth.emailTaken");
      }
      throw e;
    }

    // Throws NEXT_REDIRECT on success — must propagate.
    try {
      await signIn("credentials", {
        email: parsedInput.email,
        password: parsedInput.password,
        redirectTo: "/",
      });
    } catch (e) {
      if (e instanceof AuthError) {
        // User exists but auto-login failed — let them log in manually.
        redirect("/login");
      }
      throw e; // NEXT_REDIRECT propagates
    }
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
