"use server";

import { ActionError, authActionClient } from "@/lib/safe-action";
import {
  ruleDeleteSchema,
  ruleInputSchema,
  ruleUpdateSchema,
} from "@/lib/schemas/rule";
import { ownsCar } from "@/lib/repositories/cars";
import { createRule, deleteRule, updateRule } from "@/lib/repositories/rules";

export const createRuleAction = authActionClient
  .inputSchema(ruleInputSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!(await ownsCar(ctx.userId, parsedInput.carId)))
      throw new ActionError("errors.notFound");
    return await createRule(parsedInput);
  });

export const updateRuleAction = authActionClient
  .inputSchema(ruleUpdateSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!(await ownsCar(ctx.userId, parsedInput.carId)))
      throw new ActionError("errors.notFound");
    const ok = await updateRule(parsedInput);
    if (!ok) throw new ActionError("errors.notFound");
    return { ok: true };
  });

export const deleteRuleAction = authActionClient
  .inputSchema(ruleDeleteSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!(await ownsCar(ctx.userId, parsedInput.carId)))
      throw new ActionError("errors.notFound");
    const ok = await deleteRule(parsedInput.ruleId, parsedInput.carId);
    if (!ok) throw new ActionError("errors.notFound");
    return { ok: true };
  });
