import { describe, expect, it } from "vitest";
import { addMonths, computeMaintenance, latestLogFor } from "./maintenance";
import type { ServiceLog } from "./types";

const NOW = new Date("2026-06-10T12:00:00Z");
const service = (mileage: number, date: string) => ({
  mileageAtService: mileage,
  dateAtService: new Date(date),
});

describe("addMonths", () => {
  it("adds months plainly", () => {
    expect(addMonths(new Date("2026-01-15"), 2).toISOString().slice(0, 10)).toBe("2026-03-15");
  });
  it("clamps month-end overflow (Jan 31 + 1m -> Feb 28)", () => {
    expect(addMonths(new Date("2026-01-31"), 1).toISOString().slice(0, 10)).toBe("2026-02-28");
  });
});

describe("computeMaintenance", () => {
  it("is red with no service history", () => {
    const r = computeMaintenance({ intervalKm: 10000 }, null, 50000, NOW);
    expect(r.status).toBe("red");
    expect(r.remainingKm).toBeNull();
    expect(r.remainingDays).toBeNull();
  });

  it("is green when plenty of km remain", () => {
    const r = computeMaintenance({ intervalKm: 10000 }, service(50000, "2026-05-01"), 52000, NOW);
    expect(r.status).toBe("green");
    expect(r.remainingKm).toBe(8000);
  });

  it("is red at exactly 0 km remaining", () => {
    const r = computeMaintenance({ intervalKm: 10000 }, service(50000, "2026-05-01"), 60000, NOW);
    expect(r.status).toBe("red");
    expect(r.remainingKm).toBe(0);
  });

  it("is red when overdue by km (negative remaining)", () => {
    const r = computeMaintenance({ intervalKm: 10000 }, service(50000, "2026-05-01"), 61000, NOW);
    expect(r.status).toBe("red");
    expect(r.remainingKm).toBe(-1000);
  });

  it("is yellow under 1000 km even if >15% remains", () => {
    // interval 5000, remaining 900 -> 18% but < 1000 km
    const r = computeMaintenance({ intervalKm: 5000 }, service(50000, "2026-05-01"), 54100, NOW);
    expect(r.status).toBe("yellow");
    expect(r.remainingKm).toBe(900);
  });

  it("is yellow under 15% of km interval", () => {
    // interval 20000, remaining 2500 -> 12.5% (>= 1000 km)
    const r = computeMaintenance({ intervalKm: 20000 }, service(50000, "2026-05-01"), 67500, NOW);
    expect(r.status).toBe("yellow");
    expect(r.remainingKm).toBe(2500);
  });

  it("is red when time-overdue", () => {
    const r = computeMaintenance({ intervalMonths: 6 }, service(50000, "2025-11-01"), 50100, NOW);
    expect(r.status).toBe("red");
    expect(r.remainingDays).toBeLessThanOrEqual(0);
  });

  it("is yellow under 30 days remaining", () => {
    // due 2026-07-01 -> 21 days from NOW
    const r = computeMaintenance({ intervalMonths: 12 }, service(50000, "2025-07-01"), 50100, NOW);
    expect(r.status).toBe("yellow");
    expect(r.remainingDays).toBe(21);
  });

  it("is green with months of time remaining", () => {
    const r = computeMaintenance({ intervalMonths: 12 }, service(50000, "2026-05-01"), 50100, NOW);
    expect(r.status).toBe("green");
    expect(r.remainingDays).toBeGreaterThan(300);
  });

  it("takes the worst of the two dimensions", () => {
    // km: green (8000 of 10000 left), time: red (overdue)
    const r = computeMaintenance(
      { intervalKm: 10000, intervalMonths: 1 },
      service(50000, "2026-01-01"),
      52000,
      NOW,
    );
    expect(r.status).toBe("red");
    expect(r.remainingKm).toBe(8000);
  });

  it("only computes the dimensions the rule defines", () => {
    const r = computeMaintenance({ intervalKm: 10000 }, service(50000, "2020-01-01"), 52000, NOW);
    expect(r.remainingDays).toBeNull();
    expect(r.status).toBe("green");
  });
});

describe("latestLogFor", () => {
  const logs: ServiceLog[] = [
    { id: "1", carId: "c1", componentName: "Oil", mileageAtService: 40000, dateAtService: "2025-06-01T00:00:00.000Z" },
    { id: "2", carId: "c1", componentName: "Oil", mileageAtService: 50000, dateAtService: "2026-01-01T00:00:00.000Z" },
    { id: "3", carId: "c1", componentName: "Brakes", mileageAtService: 55000, dateAtService: "2026-03-01T00:00:00.000Z" },
    { id: "4", carId: "c2", componentName: "Oil", mileageAtService: 99000, dateAtService: "2026-05-01T00:00:00.000Z" },
  ];
  it("picks the newest log for the car+component", () => {
    expect(latestLogFor(logs, "c1", "Oil")?.id).toBe("2");
  });
  it("returns null when none exist", () => {
    expect(latestLogFor(logs, "c1", "Coolant")).toBeNull();
  });
});
