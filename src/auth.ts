import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { authConfig } from "@/auth.config";
import { resolveGoogleUserId } from "@/lib/google-user";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [Google],
  callbacks: {
    ...authConfig.callbacks,
    signIn({ account, profile }) {
      // Email match grants access to the existing account — require a
      // Google-verified address so an unverified mailbox can't claim it.
      return account?.provider === "google" && profile?.email_verified === true;
    },
    async jwt({ token, account, profile }) {
      if (account?.provider === "google" && profile?.email) {
        token.id = await resolveGoogleUserId(profile.email, profile.name ?? profile.email);
      }
      return token;
    },
  },
});
