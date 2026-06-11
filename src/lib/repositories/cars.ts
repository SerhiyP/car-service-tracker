import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import type { Car } from "@/lib/types";

interface CarDoc {
  userId: ObjectId;
  name: string;
  currentMileage: number;
  updatedAt: Date;
}

const cars = () => getDb().collection<CarDoc>("cars");

function toCar(doc: CarDoc & { _id: ObjectId }): Car {
  return {
    id: doc._id.toHexString(),
    name: doc.name,
    currentMileage: doc.currentMileage,
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function listCars(userId: string): Promise<Car[]> {
  const docs = await cars()
    .find({ userId: new ObjectId(userId) })
    .sort({ updatedAt: -1 })
    .toArray();
  return docs.map(toCar);
}

export async function ownsCar(userId: string, carId: string): Promise<boolean> {
  const count = await cars().countDocuments(
    { _id: new ObjectId(carId), userId: new ObjectId(userId) },
    { limit: 1 },
  );
  return count === 1;
}

export async function createCar(
  userId: string,
  input: { name: string; currentMileage: number },
): Promise<Car> {
  const doc: CarDoc = {
    userId: new ObjectId(userId),
    name: input.name,
    currentMileage: input.currentMileage,
    updatedAt: new Date(),
  };
  const result = await cars().insertOne(doc);
  return toCar({ ...doc, _id: result.insertedId });
}

export async function renameCar(
  userId: string,
  carId: string,
  name: string,
): Promise<boolean> {
  const result = await cars().updateOne(
    { _id: new ObjectId(carId), userId: new ObjectId(userId) },
    { $set: { name, updatedAt: new Date() } },
  );
  return result.matchedCount === 1;
}

export async function setCarMileage(
  userId: string,
  carId: string,
  mileage: number,
): Promise<boolean> {
  const result = await cars().updateOne(
    { _id: new ObjectId(carId), userId: new ObjectId(userId) },
    { $set: { currentMileage: mileage, updatedAt: new Date() } },
  );
  return result.matchedCount === 1;
}

export async function getCar(userId: string, carId: string): Promise<Car | null> {
  const doc = await cars().findOne({
    _id: new ObjectId(carId),
    userId: new ObjectId(userId),
  });
  return doc ? toCar(doc) : null;
}

export async function deleteCarCascade(
  userId: string,
  carId: string,
): Promise<boolean> {
  const result = await cars().deleteOne({
    _id: new ObjectId(carId),
    userId: new ObjectId(userId),
  });
  if (result.deletedCount !== 1) return false;
  const carObjectId = new ObjectId(carId);
  await Promise.all([
    getDb().collection("maintenance_rules").deleteMany({ carId: carObjectId }),
    getDb().collection("service_logs").deleteMany({ carId: carObjectId }),
  ]);
  return true;
}
