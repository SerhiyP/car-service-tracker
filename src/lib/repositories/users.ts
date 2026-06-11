import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";

export interface UserDoc {
  _id: ObjectId;
  email: string;
  name: string;
  passwordHash: string;
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

export async function markEmailVerified(userId: ObjectId | string): Promise<boolean> {
  const _id = typeof userId === "string" ? new ObjectId(userId) : userId;
  const result = await users().updateOne({ _id }, { $set: { emailVerified: new Date() } });
  return result.matchedCount === 1;
}
