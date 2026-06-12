import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { deleteCodeForUser } from "@/lib/repositories/verification-codes";

export interface UserDoc {
  _id: ObjectId;
  email: string;
  name: string;
  passwordHash?: string; // legacy credentials accounts; removed in cleanup task
  emailVerified?: Date | null; // absent on legacy accounts = unverified
}

const users = () => getDb().collection<Omit<UserDoc, "_id">>("users");

export async function findUserByEmail(email: string): Promise<UserDoc | null> {
  return (await users().findOne({ email: email.toLowerCase() })) as UserDoc | null;
}

export async function createUser(input: {
  name: string;
  email: string;
  passwordHash: string;
}): Promise<string> {
  const result = await users().insertOne({
    name: input.name,
    email: input.email.toLowerCase(),
    passwordHash: input.passwordHash,
    emailVerified: null,
  });
  return result.insertedId.toHexString();
}

export async function createGoogleUser(input: {
  email: string;
  name: string;
}): Promise<string> {
  const result = await users().insertOne({
    name: input.name,
    email: input.email.toLowerCase(),
  });
  return result.insertedId.toHexString();
}

export async function markEmailVerified(userId: ObjectId | string): Promise<boolean> {
  const _id = typeof userId === "string" ? new ObjectId(userId) : userId;
  const result = await users().updateOne({ _id }, { $set: { emailVerified: new Date() } });
  return result.matchedCount === 1;
}

export async function updateUserPassword(
  userId: ObjectId | string,
  passwordHash: string,
): Promise<boolean> {
  const _id = typeof userId === "string" ? new ObjectId(userId) : userId;
  const result = await users().updateOne({ _id }, { $set: { passwordHash } });
  return result.matchedCount === 1;
}

/** Permanently removes the user and everything they own. */
export async function deleteUserCascade(userId: ObjectId | string): Promise<void> {
  const _id = typeof userId === "string" ? new ObjectId(userId) : userId;
  const db = getDb();
  const carIds = await db
    .collection("cars")
    .find({ userId: _id }, { projection: { _id: 1 } })
    .map((doc) => doc._id)
    .toArray();
  if (carIds.length > 0) {
    await Promise.all([
      db.collection("maintenance_rules").deleteMany({ carId: { $in: carIds } }),
      db.collection("service_logs").deleteMany({ carId: { $in: carIds } }),
      db.collection("service_visits").deleteMany({ carId: { $in: carIds } }),
    ]);
  }
  await Promise.all([
    db.collection("cars").deleteMany({ userId: _id }),
    deleteCodeForUser(_id),
    users().deleteOne({ _id }),
  ]);
}
