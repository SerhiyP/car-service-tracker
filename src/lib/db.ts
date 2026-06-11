import { Db, MongoClient } from "mongodb";

declare global {
  var _mongo: { client: MongoClient; indexesEnsured: Promise<void> } | undefined;
}

function createClient(): MongoClient {
  const uri = process.env.MONGODB_URI_CAR;
  if (!uri) throw new Error("MONGODB_URI_CAR is not set");
  return new MongoClient(uri, { maxPoolSize: 10 });
}

async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("cars").createIndex({ userId: 1 }),
    db.collection("maintenance_rules").createIndex({ carId: 1 }),
    db
      .collection("service_logs")
      .createIndex({ carId: 1, componentName: 1, dateAtService: -1 }),
    db.collection("verification_codes").createIndex({ userId: 1 }, { unique: true }),
    db
      .collection("verification_codes")
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
}

let cachedDb: Db | undefined;

export function getDb(): Db {
  if (!global._mongo) {
    const client = createClient();
    const db = client.db(process.env.MONGODB_DB ?? "car_service_tracker");
    cachedDb = db;
    global._mongo = {
      client,
      indexesEnsured: ensureIndexes(db).catch((e) =>
        console.error("ensureIndexes failed:", e)
      ),
    };
  }
  return cachedDb!;
}
