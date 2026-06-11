"use server";

import { getTranslations } from "next-intl/server";
import { ActionError, authActionClient } from "@/lib/safe-action";
import {
  ruleDeleteSchema,
  ruleInputSchema,
  ruleUpdateSchema,
  standardRulesInputSchema,
} from "@/lib/schemas/rule";
import { ownsCar } from "@/lib/repositories/cars";
import {
  createRule,
  createRules,
  deleteRule,
  listRulesByCarIds,
  updateRule,
} from "@/lib/repositories/rules";
import { resolveStandardRules } from "@/lib/standard-rules";

export const createRuleAction = authActionClient
  .inputSchema(ruleInputSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!(await ownsCar(ctx.userId, parsedInput.carId)))
      throw new ActionError("errors.notFound");
    return await createRule(parsedInput);
  });

export const addStandardRulesAction = authActionClient
  .inputSchema(standardRulesInputSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!(await ownsCar(ctx.userId, parsedInput.carId)))
      throw new ActionError("errors.notFound");
    const t = await getTranslations("standardRules");
    const existing = await listRulesByCarIds([parsedInput.carId]);
    const inputs = resolveStandardRules(
      parsedInput.keys,
      existing.map((r) => r.componentName),
      t,
    );
    return await createRules(parsedInput.carId, inputs);
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
