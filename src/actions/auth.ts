"use server";

import { signIn, signOut } from "@/auth";
import { authActionClient } from "@/lib/safe-action";
import { deleteUserCascade } from "@/lib/repositories/users";

export async function loginWithGoogleAction() {
  // Throws NEXT_REDIRECT into the Google consent flow.
  await signIn("google", { redirectTo: "/" });
}

export const deleteAccountAction = authActionClient.action(async ({ ctx }) => {
  await deleteUserCascade(ctx.userId);
  // Throws NEXT_REDIRECT — propagates like logoutAction's signOut.
  await signOut({ redirectTo: "/login" });
});

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
