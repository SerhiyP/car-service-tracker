import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import type { MaintenanceRule } from "@/lib/types";

interface RuleDoc {
  carId: ObjectId;
  componentName: string;
  intervalKm?: number;
  intervalMonths?: number;
}

const rules = () => getDb().collection<RuleDoc>("maintenance_rules");

function toRule(doc: RuleDoc & { _id: ObjectId }): MaintenanceRule {
  return {
    id: doc._id.toHexString(),
    carId: doc.carId.toHexString(),
    componentName: doc.componentName,
    ...(doc.intervalKm !== undefined && { intervalKm: doc.intervalKm }),
    ...(doc.intervalMonths !== undefined && { intervalMonths: doc.intervalMonths }),
  };
}

export async function listRulesByCarIds(carIds: string[]): Promise<MaintenanceRule[]> {
  if (carIds.length === 0) return [];
  const docs = await rules()
    .find({ carId: { $in: carIds.map((id) => new ObjectId(id)) } })
    .toArray();
  return docs.map(toRule);
}

export async function createRule(input: {
  carId: string;
  componentName: string;
  intervalKm?: number;
  intervalMonths?: number;
}): Promise<MaintenanceRule> {
  const doc: RuleDoc = {
    carId: new ObjectId(input.carId),
    componentName: input.componentName,
    ...(input.intervalKm !== undefined && { intervalKm: input.intervalKm }),
    ...(input.intervalMonths !== undefined && { intervalMonths: input.intervalMonths }),
  };
  const result = await rules().insertOne(doc);
  return toRule({ ...doc, _id: result.insertedId });
}

export async function updateRule(input: {
  ruleId: string;
  carId: string;
  componentName: string;
  intervalKm?: number;
  intervalMonths?: number;
}): Promise<boolean> {
  const result = await rules().replaceOne(
    { _id: new ObjectId(input.ruleId), carId: new ObjectId(input.carId) },
    {
      carId: new ObjectId(input.carId),
      componentName: input.componentName,
      ...(input.intervalKm !== undefined && { intervalKm: input.intervalKm }),
      ...(input.intervalMonths !== undefined && { intervalMonths: input.intervalMonths }),
    },
  );
  return result.matchedCount === 1;
}

export async function deleteRule(ruleId: string, carId: string): Promise<boolean> {
  const result = await rules().deleteOne({
    _id: new ObjectId(ruleId),
    carId: new ObjectId(carId),
  });
  return result.deletedCount === 1;
}
