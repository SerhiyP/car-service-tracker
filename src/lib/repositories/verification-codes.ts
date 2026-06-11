import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";

export interface VerificationCodeDoc {
  _id: ObjectId;
  userId: ObjectId;
  codeHash: string;
  expiresAt: Date; // TTL index — Mongo deletes the doc after this moment
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

/** Replaces any existing code for the user and resets the attempt counter. */
export async function upsertCode(
  userId: ObjectId | string,
  fields: { codeHash: string; expiresAt: Date; lastSentAt: Date },
): Promise<void> {
  await codes().updateOne(
    { userId: toObjectId(userId) },
    { $set: { ...fields, attempts: 0 } },
    { upsert: true },
  );
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
