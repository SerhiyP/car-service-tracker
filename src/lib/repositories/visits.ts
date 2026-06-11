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

export async function getVisit(visitId: string, carId: string): Promise<ServiceVisit | null> {
  const doc = await visits().findOne({
    _id: new ObjectId(visitId),
    carId: new ObjectId(carId),
  });
  return doc ? toVisit(doc) : null;
}

export async function updateVisit(input: {
  visitId: string;
  carId: string;
  mileageAtService: number;
  dateAtService: Date;
  totalCost?: number;
}): Promise<ServiceVisit | null> {
  const doc = await visits().findOneAndUpdate(
    { _id: new ObjectId(input.visitId), carId: new ObjectId(input.carId) },
    {
      $set: {
        mileageAtService: input.mileageAtService,
        dateAtService: input.dateAtService,
        ...(input.totalCost !== undefined && { totalCost: input.totalCost }),
      },
      // Clearing the cost field in the form clears the stored cost.
      ...(input.totalCost === undefined && { $unset: { totalCost: "" } }),
    },
    { returnDocument: "after" },
  );
  return doc ? toVisit(doc) : null;
}
