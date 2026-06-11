import { Db, MongoClient } from "mongodb";

declare global {
  var _mongo: { client: MongoClient; indexesEnsured: Promise<void> } | undefined;
}

function dbName(): string {
  return process.env.MONGODB_DB ?? "car_service_tracker";
}

function createClient(): MongoClient {
  const uri = process.env.MONGODB_URI_CAR;
  if (!uri) throw new Error("MONGODB_URI_CAR is not set");
  return new MongoClient(uri, {
    appName: "car-service-tracker", // shows up in Atlas logs/metrics
    // Serverless sizing: every warm function instance holds its own pool,
    // and Atlas shared tiers cap total connections (M0: 500).
    maxPoolSize: 5,
    maxIdleTimeMS: 30_000, // default is "never close idle" — they pile up across instances
    connectTimeoutMS: 10_000,
    serverSelectionTimeoutMS: 8_000, // fail before the platform kills the function
  });
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

export function getDb(): Db {
  if (!global._mongo) {
    const client = createClient();
    const entry = { client, indexesEnsured: Promise.resolve() };

    // A client whose connect failed is closed for good and would throw
    // "Topology is closed" on every later request in this warm instance,
    // so it must never stay cached.
    const evict = () => {
      if (global._mongo === entry) global._mongo = undefined;
    };

    const connected = client
      .connect()
      .then(() => {
        console.log(`MongoDB connected (db: ${dbName()})`);
      })
      .catch((e) => {
        console.error("MongoDB connect failed:", e);
        evict();
        client.close().catch(() => {});
        throw e;
      });

    client.on("topologyClosed", evict);

    entry.indexesEnsured = connected
      .then(() =>
        ensureIndexes(client.db(dbName())).catch((e) =>
          console.error("ensureIndexes failed:", e),
        ),
      )
      .catch(() => {}); // connect failure already logged above

    global._mongo = entry;
  }
  return global._mongo.client.db(dbName());
}
