import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { loginSchema } from "@/lib/schemas/auth";
import { findUserByEmail } from "@/lib/repositories/users";
import { authConfig } from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const user = await findUserByEmail(parsed.data.email);
        if (!user?.passwordHash) return null;
        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;
        // Unverified (and legacy pre-verification) accounts cannot sign in.
        if (!user.emailVerified) return null;
        return { id: user._id.toHexString(), email: user.email, name: user.name };
      },
    }),
  ],
});
