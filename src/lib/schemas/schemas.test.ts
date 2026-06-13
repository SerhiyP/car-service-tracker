import { describe, expect, it } from "vitest";
import { carInputSchema, mileageUpdateSchema } from "./car";
import { ruleInputSchema, standardRulesInputSchema } from "./rule";
import { visitInputSchema, visitUpdateSchema } from "./visit";

const oid = "65f1a2b3c4d5e6f7a8b9c0d1";

describe("car schemas", () => {
  it("accepts a valid car", () => {
    expect(
      carInputSchema.safeParse({ name: "Octavia", currentMileage: 120000 })
        .success,
    ).toBe(true);
  });
  it("rejects empty name and negative mileage", () => {
    expect(carInputSchema.safeParse({ name: "", currentMileage: 1 }).success).toBe(false);
    expect(carInputSchema.safeParse({ name: "A", currentMileage: -1 }).success).toBe(false);
  });
  it("validates mileage updates", () => {
    expect(mileageUpdateSchema.safeParse({ carId: oid, mileage: 5 }).success).toBe(true);
    expect(mileageUpdateSchema.safeParse({ carId: "short", mileage: 5 }).success).toBe(false);
  });
});

describe("rule schema", () => {
  it("requires at least one interval", () => {
    expect(
      ruleInputSchema.safeParse({ carId: oid, componentName: "Oil" }).success,
    ).toBe(false);
    expect(
      ruleInputSchema.safeParse({ carId: oid, componentName: "Oil", intervalKm: 10000 }).success,
    ).toBe(true);
    expect(
      ruleInputSchema.safeParse({ carId: oid, componentName: "Oil", intervalMonths: 12 }).success,
    ).toBe(true);
  });
  it("rejects non-positive intervals", () => {
    expect(
      ruleInputSchema.safeParse({ carId: oid, componentName: "Oil", intervalKm: 0 }).success,
    ).toBe(false);
  });
  it("accepts a valid icon and rejects an unknown one", () => {
    expect(
      ruleInputSchema.safeParse({
        carId: oid,
        componentName: "Oil",
        intervalKm: 10000,
        icon: "oil",
      }).success,
    ).toBe(true);
    expect(
      ruleInputSchema.safeParse({
        carId: oid,
        componentName: "Oil",
        intervalKm: 10000,
        icon: "rocket",
      }).success,
    ).toBe(false);
  });
});

describe("standard rules schema", () => {
  it("accepts known keys", () => {
    expect(
      standardRulesInputSchema.safeParse({ carId: oid, keys: ["engineOil", "battery"] })
        .success,
    ).toBe(true);
  });
  it("rejects unknown keys, empty list, and bad carId", () => {
    expect(
      standardRulesInputSchema.safeParse({ carId: oid, keys: ["notAKey"] }).success,
    ).toBe(false);
    expect(standardRulesInputSchema.safeParse({ carId: oid, keys: [] }).success).toBe(false);
    expect(
      standardRulesInputSchema.safeParse({ carId: "short", keys: ["engineOil"] }).success,
    ).toBe(false);
  });
});

describe("visit schema", () => {
  const valid = {
    carId: oid,
    componentNames: ["Engine oil", "Air filter"],
    mileageAtService: 120000,
    dateAtService: "2026-01-15",
  };

  it("accepts a valid visit without cost and coerces the date", () => {
    const parsed = visitInputSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.dateAtService).toBeInstanceOf(Date);
      expect(parsed.data.totalCost).toBeUndefined();
    }
  });

  it("accepts a non-negative total cost and rejects bad costs", () => {
    expect(visitInputSchema.safeParse({ ...valid, totalCost: 1500.5 }).success).toBe(true);
    expect(visitInputSchema.safeParse({ ...valid, totalCost: 0 }).success).toBe(true);
    expect(visitInputSchema.safeParse({ ...valid, totalCost: -1 }).success).toBe(false);
    expect(visitInputSchema.safeParse({ ...valid, totalCost: "free" }).success).toBe(false);
    expect(visitInputSchema.safeParse({ ...valid, totalCost: 100_000_000 }).success).toBe(false);
  });

  it("requires at least one component name", () => {
    expect(visitInputSchema.safeParse({ ...valid, componentNames: [] }).success).toBe(false);
    expect(visitInputSchema.safeParse({ ...valid, componentNames: [""] }).success).toBe(false);
  });

  it("rejects future dates and bad car ids", () => {
    const future = new Date(Date.now() + 7 * 86_400_000).toISOString();
    expect(visitInputSchema.safeParse({ ...valid, dateAtService: future }).success).toBe(false);
    expect(visitInputSchema.safeParse({ ...valid, carId: "short" }).success).toBe(false);
  });
});

describe("visit update schema", () => {
  const valid = {
    carId: oid,
    target: { visitId: oid },
    componentNames: ["Engine oil"],
    mileageAtService: 120000,
    dateAtService: "2026-01-15",
  };

  it("accepts a visit target and a log target", () => {
    expect(visitUpdateSchema.safeParse(valid).success).toBe(true);
    expect(
      visitUpdateSchema.safeParse({ ...valid, target: { logId: oid } }).success,
    ).toBe(true);
  });

  it("rejects a missing or malformed target", () => {
    expect(visitUpdateSchema.safeParse({ ...valid, target: {} }).success).toBe(false);
    expect(
      visitUpdateSchema.safeParse({ ...valid, target: { visitId: "short" } }).success,
    ).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { target, ...withoutTarget } = valid;
    expect(visitUpdateSchema.safeParse(withoutTarget).success).toBe(false);
  });

  it("treats an ambiguous target as a visit target (union order) and strips logId", () => {
    const parsed = visitUpdateSchema.safeParse({
      ...valid,
      target: { visitId: oid, logId: oid },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.target).toEqual({ visitId: oid });
  });

  it("applies the shared field rules", () => {
    expect(
      visitUpdateSchema.safeParse({ ...valid, componentNames: [] }).success,
    ).toBe(false);
    expect(
      visitUpdateSchema.safeParse({ ...valid, totalCost: -1 }).success,
    ).toBe(false);
    expect(
      visitUpdateSchema.safeParse({ ...valid, totalCost: 2500 }).success,
    ).toBe(true);
    const future = new Date(Date.now() + 7 * 86_400_000).toISOString();
    expect(
      visitUpdateSchema.safeParse({ ...valid, dateAtService: future }).success,
    ).toBe(false);
  });
});
