import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import type { ServiceLog } from "@/lib/types";

interface LogDoc {
  carId: ObjectId;
  componentName: string;
  mileageAtService: number;
  dateAtService: Date;
}

const logs = () => getDb().collection<LogDoc>("service_logs");

function toLog(doc: LogDoc & { _id: ObjectId }): ServiceLog {
  return {
    id: doc._id.toHexString(),
    carId: doc.carId.toHexString(),
    componentName: doc.componentName,
    mileageAtService: doc.mileageAtService,
    dateAtService: doc.dateAtService.toISOString(),
  };
}

export async function listLogsByCarIds(carIds: string[]): Promise<ServiceLog[]> {
  if (carIds.length === 0) return [];
  const docs = await logs()
    .find({ carId: { $in: carIds.map((id) => new ObjectId(id)) } })
    .sort({ dateAtService: -1 })
    .toArray();
  return docs.map(toLog);
}

export async function createLog(input: {
  carId: string;
  componentName: string;
  mileageAtService: number;
  dateAtService: Date;
}): Promise<ServiceLog> {
  const doc: LogDoc = {
    carId: new ObjectId(input.carId),
    componentName: input.componentName,
    mileageAtService: input.mileageAtService,
    dateAtService: input.dateAtService,
  };
  const result = await logs().insertOne(doc);
  return toLog({ ...doc, _id: result.insertedId });
}

export async function deleteLog(logId: string, carId: string): Promise<boolean> {
  const result = await logs().deleteOne({
    _id: new ObjectId(logId),
    carId: new ObjectId(carId),
  });
  return result.deletedCount === 1;
}
