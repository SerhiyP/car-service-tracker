"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { MongoServerError, type ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import { getLocale } from "next-intl/server";
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
  incrementAttempts,
  upsertCodeIfCooldownPassed,
} from "@/lib/repositories/verification-codes";
import {
  CODE_TTL_MS,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_MS,
  cooldownSecondsLeft,
  generateCode,
  hashCode,
  isExpired,
} from "@/lib/verification";
import { sendVerificationEmail } from "@/lib/email";

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

/**
 * Atomically claims the send slot (cooldown-gated), then emails a fresh code.
 * Returns false when the cooldown blocked the send.
 */
async function issueCode(userId: ObjectId | string, email: string): Promise<boolean> {
  const code = generateCode();
  const now = new Date();
  const claimed = await upsertCodeIfCooldownPassed(
    userId,
    {
      codeHash: hashCode(code),
      expiresAt: new Date(now.getTime() + CODE_TTL_MS),
      lastSentAt: now,
    },
    RESEND_COOLDOWN_MS,
  );
  if (!claimed) return false;
  await sendVerificationEmail(email, code, await getLocale());
  return true;
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
      await issueCode(userId, email);
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

    const codeDoc = await findCodeByUserId(user._id);
    if (!codeDoc) return { status: "noActiveCode" };

    if (isExpired(codeDoc.expiresAt, new Date())) {
      await deleteCodeForUser(user._id);
      return { status: "codeExpired" };
    }

    if (hashCode(parsedInput.code) !== codeDoc.codeHash) {
      const attempts = await incrementAttempts(user._id);
      if (attempts >= MAX_ATTEMPTS) {
        await deleteCodeForUser(user._id);
        return { status: "tooManyAttempts" };
      }
      return { status: "codeInvalid", attemptsLeft: MAX_ATTEMPTS - attempts };
    }

    // Concurrent correct submissions are idempotent: re-marking verified and
    // re-deleting the code are both no-ops.
    await markEmailVerified(user._id);
    await deleteCodeForUser(user._id);
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
      sent = await issueCode(user._id, user.email);
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
