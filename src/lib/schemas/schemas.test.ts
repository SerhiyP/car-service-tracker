import { describe, expect, it } from "vitest";
import { registerSchema, verifyEmailSchema, resendCodeSchema } from "./auth";
import { carInputSchema, mileageUpdateSchema } from "./car";
import { ruleInputSchema, standardRulesInputSchema } from "./rule";
import { logInputSchema } from "./log";
import { visitInputSchema } from "./visit";

const oid = "65f1a2b3c4d5e6f7a8b9c0d1";

describe("auth schemas", () => {
  it("accepts a valid registration", () => {
    expect(
      registerSchema.safeParse({
        name: "Serhii",
        email: "a@b.co",
        password: "12345678",
      }).success,
    ).toBe(true);
  });
  it("rejects short passwords and bad emails", () => {
    expect(
      registerSchema.safeParse({ name: "S", email: "a@b.co", password: "123" })
        .success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({ name: "S", email: "nope", password: "12345678" })
        .success,
    ).toBe(false);
  });
});

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
});

describe("log schema", () => {
  it("accepts a valid log and coerces the date", () => {
    const parsed = logInputSchema.safeParse({
      carId: oid,
      componentName: "Oil",
      mileageAtService: 100000,
      dateAtService: "2026-01-15",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.dateAtService).toBeInstanceOf(Date);
  });
  it("rejects future dates", () => {
    const future = new Date(Date.now() + 7 * 86_400_000).toISOString();
    expect(
      logInputSchema.safeParse({
        carId: oid,
        componentName: "Oil",
        mileageAtService: 1,
        dateAtService: future,
      }).success,
    ).toBe(false);
  });
});

describe("verifyEmailSchema", () => {
  it("accepts an email with a 6-digit code", () => {
    const result = verifyEmailSchema.safeParse({ email: "a@b.co", code: "012345" });
    expect(result.success).toBe(true);
  });

  it.each(["12345", "1234567", "12345a", "", "123 56"])("rejects code %j", (code) => {
    const result = verifyEmailSchema.safeParse({ email: "a@b.co", code });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = verifyEmailSchema.safeParse({ email: "nope", code: "123456" });
    expect(result.success).toBe(false);
  });
});

describe("resendCodeSchema", () => {
  it("accepts a valid email", () => {
    expect(resendCodeSchema.safeParse({ email: "a@b.co" }).success).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(resendCodeSchema.safeParse({ email: "nope" }).success).toBe(false);
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
