import { createSafeActionClient } from "next-safe-action";
import { auth } from "@/auth";

/** Thrown with an i18n key; the client translates it. */
export class ActionError extends Error {}

export const actionClient = createSafeActionClient({
  handleServerError(e) {
    if (e instanceof ActionError) return e.message;
    console.error("Action error:", e);
    return "errors.server";
  },
});

export const authActionClient = actionClient.use(async ({ next }) => {
  const session = await auth();
  if (!session?.user?.id) throw new ActionError("errors.unauthorized");
  return next({ ctx: { userId: session.user.id } });
});
