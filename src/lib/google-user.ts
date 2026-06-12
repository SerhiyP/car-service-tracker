import { MongoServerError } from "mongodb";
import { createGoogleUser, findUserByEmail } from "@/lib/repositories/users";

/**
 * Maps a Google sign-in to a users document, creating one on first sign-in.
 * Returns the Mongo id as a hex string for the JWT (`token.id`).
 */
export async function resolveGoogleUserId(email: string, name: string): Promise<string> {
  const existing = await findUserByEmail(email);
  if (existing) return existing._id.toHexString();
  try {
    return await createGoogleUser({ email, name });
  } catch (e) {
    // Concurrent first sign-ins: the unique email index makes the loser re-read.
    if (e instanceof MongoServerError && e.code === 11000) {
      const winner = await findUserByEmail(email);
      if (winner) return winner._id.toHexString();
      throw new Error(`duplicate-key insert but re-read found no user for ${email}`);
    }
    throw e;
  }
}
