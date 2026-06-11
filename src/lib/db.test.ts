import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { MockMongoClient, instances, control } = vi.hoisted(() => {
  const instances: Array<{ connectResult: "ok" | "fail"; closed: boolean }> = [];
  // Toggled by tests to control whether the next client's connect succeeds.
  const control = { nextConnect: "ok" as "ok" | "fail" };

  class MockMongoClient {
    state: { connectResult: "ok" | "fail"; closed: boolean };

    constructor() {
      this.state = { connectResult: control.nextConnect, closed: false };
      instances.push(this.state);
    }

    connect() {
      return this.state.connectResult === "ok"
        ? Promise.resolve(this)
        : Promise.reject(new Error("connect refused"));
    }

    db() {
      return {
        collection: () => ({ createIndex: () => Promise.resolve("idx") }),
      };
    }

    close() {
      this.state.closed = true;
      return Promise.resolve();
    }

    once() {}
    on() {}
  }

  return { MockMongoClient, instances, control };
});

vi.mock("mongodb", () => ({ MongoClient: MockMongoClient }));

import { getDb } from "./db";

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("getDb", () => {
  beforeEach(() => {
    vi.stubEnv("MONGODB_URI_CAR", "mongodb://test-host/");
    instances.length = 0;
    control.nextConnect = "ok";
    (globalThis as { _mongo?: unknown })._mongo = undefined;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reuses one client across calls when connect succeeds", async () => {
    getDb();
    getDb();
    await flush();
    expect(instances).toHaveLength(1);
  });

  it("creates a fresh client after a failed connect instead of reusing the dead one", async () => {
    control.nextConnect = "fail";
    getDb();
    await flush(); // let the connect rejection clear the cache

    control.nextConnect = "ok";
    getDb();
    await flush();

    expect(instances).toHaveLength(2);
    expect(instances[0].closed).toBe(true);
  });
});
