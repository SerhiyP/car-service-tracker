import { createHash, randomInt } from "node:crypto";

export const CODE_TTL_MS = 15 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
export const RESEND_COOLDOWN_MS = 60 * 1000;

/** Cryptographically random 6-digit code, zero-padded. */
export function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** sha256 hex. The 5-attempt cap is the real defense for a 10^6 keyspace. */
export function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function isExpired(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() <= now.getTime();
}

/** Whole seconds until a new code may be sent; 0 when the cooldown has passed. */
export function cooldownSecondsLeft(lastSentAt: Date, now: Date): number {
  const ms = lastSentAt.getTime() + RESEND_COOLDOWN_MS - now.getTime();
  return Math.max(0, Math.ceil(ms / 1000));
}
