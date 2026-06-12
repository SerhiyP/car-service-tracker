"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import type { ObjectId } from "mongodb";
import { MongoServerError } from "mongodb";
import bcrypt from "bcryptjs";
import { signIn, signOut } from "@/auth";
import { ActionError, actionClient, authActionClient } from "@/lib/safe-action";
import {
  loginSchema,
  registerSchema,
  resendCodeSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "@/lib/schemas/auth";
import {
  createUser,
  deleteUserCascade,
  findUserByEmail,
  markEmailVerified,
  updateUserPassword,
} from "@/lib/repositories/users";
import {
  type CodePurpose,
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

type SendCodeOutcome =
  | { status: "sent"; retryAfterSec: number }
  | { status: "cooldown"; retryAfterSec: number };

/** Issues a code with send-failure cleanup and cooldown feedback. */
async function sendCodeWithFeedback(
  userId: ObjectId,
  email: string,
  purpose: CodePurpose,
): Promise<SendCodeOutcome> {
  let sent: boolean;
  try {
    sent = await issueCode(userId, email, purpose);
  } catch (e) {
    console.error(`sending ${purpose} code failed:`, e);
    // Drop the undelivered code so the cooldown doesn't block an immediate retry.
    await deleteCodeForUser(userId);
    throw new ActionError("auth.sendFailed");
  }
  if (!sent) {
    const existing = await findCodeByUserId(userId);
    const retryAfterSec = existing
      ? cooldownSecondsLeft(existing.lastSentAt, new Date())
      : 1;
    return { status: "cooldown", retryAfterSec: Math.max(1, retryAfterSec) };
  }
  return { status: "sent", retryAfterSec: RESEND_COOLDOWN_MS / 1000 };
}

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
          user?.passwordHash &&
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

    return sendCodeWithFeedback(user._id, user.email, "verify");
  });

export type RequestPasswordResetResult = SendCodeOutcome;

export const requestPasswordResetAction = actionClient
  .inputSchema(resendCodeSchema)
  .action(async ({ parsedInput }): Promise<RequestPasswordResetResult> => {
    const user = await findUserByEmail(parsedInput.email);
    if (!user) throw new ActionError("auth.emailNotFound");
    return sendCodeWithFeedback(user._id, user.email, "reset");
  });

export type ResetPasswordResult =
  | { status: "reset" }
  | { status: "codeInvalid"; attemptsLeft: number }
  | { status: "tooManyAttempts" }
  | { status: "codeExpired" }
  | { status: "noActiveCode" };

export const resetPasswordAction = actionClient
  .inputSchema(resetPasswordSchema)
  .action(async ({ parsedInput }): Promise<ResetPasswordResult> => {
    const user = await findUserByEmail(parsedInput.email);
    if (!user) throw new ActionError("auth.emailNotFound");

    const consumed = await consumeCode(user._id, parsedInput.code, "reset");
    if (consumed.status !== "ok") return consumed;

    const passwordHash = await bcrypt.hash(parsedInput.newPassword, 10);
    await updateUserPassword(user._id, passwordHash);
    // Receiving the code proves mailbox ownership — unblock unverified accounts.
    if (!user.emailVerified) await markEmailVerified(user._id);
    return { status: "reset" };
  });

export const deleteAccountAction = authActionClient.action(async ({ ctx }) => {
  await deleteUserCascade(ctx.userId);
  // Throws NEXT_REDIRECT — propagates like logoutAction's signOut.
  await signOut({ redirectTo: "/login" });
});

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
