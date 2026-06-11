import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import type { ServiceLog } from "@/lib/types";

interface LogDoc {
  carId: ObjectId;
  componentName: string;
  mileageAtService: number;
  dateAtService: Date;
  visitId?: ObjectId;
}

const logs = () => getDb().collection<LogDoc>("service_logs");

function toLog(doc: LogDoc & { _id: ObjectId }): ServiceLog {
  return {
    id: doc._id.toHexString(),
    carId: doc.carId.toHexString(),
    componentName: doc.componentName,
    mileageAtService: doc.mileageAtService,
    dateAtService: doc.dateAtService.toISOString(),
    ...(doc.visitId !== undefined && { visitId: doc.visitId.toHexString() }),
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

export async function createLogs(input: {
  carId: string;
  visitId: string;
  componentNames: string[];
  mileageAtService: number;
  dateAtService: Date;
}): Promise<ServiceLog[]> {
  if (input.componentNames.length === 0) return [];
  const docs: LogDoc[] = input.componentNames.map((componentName) => ({
    carId: new ObjectId(input.carId),
    componentName,
    mileageAtService: input.mileageAtService,
    dateAtService: input.dateAtService,
    visitId: new ObjectId(input.visitId),
  }));
  const result = await logs().insertMany(docs);
  return docs.map((doc, i) => toLog({ ...doc, _id: result.insertedIds[i] }));
}

export async function countLogsByVisitId(visitId: string, carId: string): Promise<number> {
  return logs().countDocuments({
    visitId: new ObjectId(visitId),
    carId: new ObjectId(carId),
  });
}

export async function deleteLog(logId: string, carId: string): Promise<ServiceLog | null> {
  const doc = await logs().findOneAndDelete({
    _id: new ObjectId(logId),
    carId: new ObjectId(carId),
  });
  return doc ? toLog(doc) : null;
}
