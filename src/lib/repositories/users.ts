import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";

export interface UserDoc {
  _id: ObjectId;
  email: string;
  name: string;
  passwordHash: string;
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
  });
  return result.insertedId.toHexString();
}
