"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { MongoServerError } from "mongodb";
import bcrypt from "bcryptjs";
import { signIn, signOut } from "@/auth";
import { ActionError, actionClient, authActionClient } from "@/lib/safe-action";
import {
  loginSchema,
  registerSchema,
  resendCodeSchema,
  verifyEmailSchema,
} from "@/lib/schemas/auth";
import {
  createUser,
  deleteUserCascade,
  findUserByEmail,
  markEmailVerified,
} from "@/lib/repositories/users";
import {
  deleteCodeForUser,
  findCodeByUserId,
} from "@/lib/repositories/verification-codes";
import {
  RESEND_COOLDOWN_MS,
  cooldownSecondsLeft,
} from "@/lib/verification";
import { consumeCode, issueCode } from "@/lib/verification-flow";

export type VerifyEmailResult =
  | { status: "verified" }
  | { status: "codeInvalid"; attemptsLeft: number }
  | { status: "tooManyAttempts" }
  | { status: "codeExpired" }
  | { status: "noActiveCode" };

export type ResendCodeResult =
  | { status: "sent"; retryAfterSec: number }
  | { status: "alreadyVerified" }
  | { status: "cooldown"; retryAfterSec: number };

export const registerAction = actionClient
  .inputSchema(registerSchema)
  .action(async ({ parsedInput }) => {
    const email = parsedInput.email.toLowerCase();
    const existing = await findUserByEmail(email);
    if (existing) throw new ActionError("auth.emailTaken");

    const passwordHash = await bcrypt.hash(parsedInput.password, 10);
    let userId: string;
    try {
      userId = await createUser({ name: parsedInput.name, email, passwordHash });
    } catch (e) {
      if (e instanceof MongoServerError && e.code === 11000) {
        throw new ActionError("auth.emailTaken");
      }
      throw e;
    }

    try {
      await issueCode(userId, email, "verify");
    } catch (e) {
      // The account exists either way; the user can resend from /verify.
      console.error("sending verification code failed:", e);
      // Drop the undelivered code so the cooldown doesn't delay that resend.
      await deleteCodeForUser(userId).catch(() => {});
    }

    redirect(`/verify?email=${encodeURIComponent(email)}`);
  });

export const loginAction = actionClient
  .inputSchema(loginSchema)
  .action(async ({ parsedInput }) => {
    try {
      await signIn("credentials", { ...parsedInput, redirectTo: "/" });
    } catch (e) {
      if (e instanceof AuthError) {
        // authorize() failed — classify so the form can offer verification.
        const user = await findUserByEmail(parsedInput.email);
        if (
          user &&
          !user.emailVerified &&
          (await bcrypt.compare(parsedInput.password, user.passwordHash))
        ) {
          throw new ActionError("auth.emailNotVerified");
        }
        throw new ActionError("auth.invalidCredentials");
      }
      throw e; // NEXT_REDIRECT and unknown errors propagate
    }
  });

export const verifyEmailAction = actionClient
  .inputSchema(verifyEmailSchema)
  .action(async ({ parsedInput }): Promise<VerifyEmailResult> => {
    const user = await findUserByEmail(parsedInput.email);
    if (!user) return { status: "noActiveCode" };
    if (user.emailVerified) return { status: "verified" };

    const consumed = await consumeCode(user._id, parsedInput.code, "verify");
    if (consumed.status !== "ok") return consumed;

    // Concurrent correct submissions are idempotent: re-marking verified is a no-op.
    await markEmailVerified(user._id);
    return { status: "verified" };
  });

export const resendVerificationCodeAction = actionClient
  .inputSchema(resendCodeSchema)
  .action(async ({ parsedInput }): Promise<ResendCodeResult> => {
    const user = await findUserByEmail(parsedInput.email);
    if (!user) throw new ActionError("auth.emailNotFound");
    if (user.emailVerified) return { status: "alreadyVerified" };

    let sent: boolean;
    try {
      sent = await issueCode(user._id, user.email, "verify");
    } catch (e) {
      console.error("sending verification code failed:", e);
      // Drop the undelivered code so the cooldown doesn't block an immediate retry.
      await deleteCodeForUser(user._id);
      throw new ActionError("auth.sendFailed");
    }
    if (!sent) {
      const existing = await findCodeByUserId(user._id);
      const retryAfterSec = existing
        ? cooldownSecondsLeft(existing.lastSentAt, new Date())
        : 1;
      return { status: "cooldown", retryAfterSec: Math.max(1, retryAfterSec) };
    }
    return { status: "sent", retryAfterSec: RESEND_COOLDOWN_MS / 1000 };
  });

export const deleteAccountAction = authActionClient.action(async ({ ctx }) => {
  await deleteUserCascade(ctx.userId);
  // Throws NEXT_REDIRECT — propagates like logoutAction's signOut.
  await signOut({ redirectTo: "/login" });
});

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
