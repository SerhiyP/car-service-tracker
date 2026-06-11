import { MongoServerError, ObjectId } from "mongodb";
import { getDb } from "@/lib/db";

export interface VerificationCodeDoc {
  _id: ObjectId;
  userId: ObjectId;
  codeHash: string;
  expiresAt: Date; // TTL index — Mongo deletes the doc shortly after this moment
  attempts: number;
  lastSentAt: Date;
}

const codes = () =>
  getDb().collection<Omit<VerificationCodeDoc, "_id">>("verification_codes");

const toObjectId = (id: ObjectId | string) =>
  typeof id === "string" ? new ObjectId(id) : id;

export async function findCodeByUserId(
  userId: ObjectId | string,
): Promise<VerificationCodeDoc | null> {
  return (await codes().findOne({ userId: toObjectId(userId) })) as VerificationCodeDoc | null;
}

/**
 * Atomically stores a fresh code (resetting attempts) — but only when no code
 * exists or the previous send is older than `cooldownMs`. Concurrency-safe:
 * when the filter misses because a recent doc exists, the upsert attempts an
 * insert and trips the unique userId index instead of double-sending.
 */
export async function upsertCodeIfCooldownPassed(
  userId: ObjectId | string,
  fields: { codeHash: string; expiresAt: Date; lastSentAt: Date },
  cooldownMs: number,
): Promise<boolean> {
  const cutoff = new Date(fields.lastSentAt.getTime() - cooldownMs);
  try {
    await codes().updateOne(
      { userId: toObjectId(userId), lastSentAt: { $lte: cutoff } },
      { $set: { ...fields, attempts: 0 } },
      { upsert: true },
    );
    return true;
  } catch (e) {
    if (e instanceof MongoServerError && e.code === 11000) return false; // cooldown active
    throw e;
  }
}

/** Atomically increments and returns the new attempt count. */
export async function incrementAttempts(userId: ObjectId | string): Promise<number> {
  const updated = await codes().findOneAndUpdate(
    { userId: toObjectId(userId) },
    { $inc: { attempts: 1 } },
    { returnDocument: "after" },
  );
  // Doc vanished mid-flight (TTL cleanup) — treat as exhausted.
  return updated?.attempts ?? Number.MAX_SAFE_INTEGER;
}

export async function deleteCodeForUser(userId: ObjectId | string): Promise<void> {
  await codes().deleteOne({ userId: toObjectId(userId) });
}
