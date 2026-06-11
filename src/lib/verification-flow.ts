import type { ObjectId } from "mongodb";
import { getLocale } from "next-intl/server";
import {
  CODE_TTL_MS,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_MS,
  generateCode,
  hashCode,
  isExpired,
} from "@/lib/verification";
import {
  type CodePurpose,
  deleteCodeForUser,
  findCodeByUserId,
  incrementAttempts,
  upsertCodeIfCooldownPassed,
} from "@/lib/repositories/verification-codes";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";

export type ConsumeCodeResult =
  | { status: "ok" }
  | { status: "codeInvalid"; attemptsLeft: number }
  | { status: "tooManyAttempts" }
  | { status: "codeExpired" }
  | { status: "noActiveCode" };

/**
 * Atomically claims the send slot (cooldown-gated), then emails a fresh code
 * for the given purpose. Returns false when the cooldown blocked the send.
 */
export async function issueCode(
  userId: ObjectId | string,
  email: string,
  purpose: CodePurpose,
): Promise<boolean> {
  const code = generateCode();
  const now = new Date();
  const claimed = await upsertCodeIfCooldownPassed(
    userId,
    {
      codeHash: hashCode(code),
      expiresAt: new Date(now.getTime() + CODE_TTL_MS),
      lastSentAt: now,
      purpose,
    },
    RESEND_COOLDOWN_MS,
  );
  if (!claimed) return false;
  const send = purpose === "reset" ? sendPasswordResetEmail : sendVerificationEmail;
  await send(email, code, await getLocale());
  return true;
}

/**
 * Checks a submitted code against the user's active one and deletes it on
 * success. A code issued for a different purpose counts as no active code
 * (legacy docs without `purpose` are verify codes).
 */
export async function consumeCode(
  userId: ObjectId | string,
  code: string,
  purpose: CodePurpose,
): Promise<ConsumeCodeResult> {
  const codeDoc = await findCodeByUserId(userId);
  if (!codeDoc || (codeDoc.purpose ?? "verify") !== purpose) {
    return { status: "noActiveCode" };
  }

  if (isExpired(codeDoc.expiresAt, new Date())) {
    await deleteCodeForUser(userId);
    return { status: "codeExpired" };
  }

  if (hashCode(code) !== codeDoc.codeHash) {
    const attempts = await incrementAttempts(userId);
    if (attempts >= MAX_ATTEMPTS) {
      await deleteCodeForUser(userId);
      return { status: "tooManyAttempts" };
    }
    return { status: "codeInvalid", attemptsLeft: MAX_ATTEMPTS - attempts };
  }

  await deleteCodeForUser(userId);
  return { status: "ok" };
}
