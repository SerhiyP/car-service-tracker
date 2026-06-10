import { describe, expect, it } from "vitest";
import { registerSchema } from "./auth";
import { carInputSchema, mileageUpdateSchema } from "./car";
import { ruleInputSchema } from "./rule";
import { logInputSchema } from "./log";

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
