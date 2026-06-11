import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import type { ServiceVisit } from "@/lib/types";

interface VisitDoc {
  carId: ObjectId;
  mileageAtService: number;
  dateAtService: Date;
  totalCost?: number;
}

const visits = () => getDb().collection<VisitDoc>("service_visits");

function toVisit(doc: VisitDoc & { _id: ObjectId }): ServiceVisit {
  return {
    id: doc._id.toHexString(),
    carId: doc.carId.toHexString(),
    mileageAtService: doc.mileageAtService,
    dateAtService: doc.dateAtService.toISOString(),
    ...(doc.totalCost !== undefined && { totalCost: doc.totalCost }),
  };
}

export async function listVisitsByCarIds(carIds: string[]): Promise<ServiceVisit[]> {
  if (carIds.length === 0) return [];
  const docs = await visits()
    .find({ carId: { $in: carIds.map((id) => new ObjectId(id)) } })
    .toArray();
  return docs.map(toVisit);
}

export async function createVisit(input: {
  carId: string;
  mileageAtService: number;
  dateAtService: Date;
  totalCost?: number;
}): Promise<ServiceVisit> {
  const doc: VisitDoc = {
    carId: new ObjectId(input.carId),
    mileageAtService: input.mileageAtService,
    dateAtService: input.dateAtService,
    ...(input.totalCost !== undefined && { totalCost: input.totalCost }),
  };
  const result = await visits().insertOne(doc);
  return toVisit({ ...doc, _id: result.insertedId });
}

export async function deleteVisit(visitId: string, carId: string): Promise<boolean> {
  const result = await visits().deleteOne({
    _id: new ObjectId(visitId),
    carId: new ObjectId(carId),
  });
  return result.deletedCount === 1;
}
