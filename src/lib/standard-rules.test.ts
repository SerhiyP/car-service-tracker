import { describe, expect, it } from "vitest";
import { STANDARD_RULES, STANDARD_RULE_KEYS } from "./standard-rules";
import en from "@/messages/en.json";
import uk from "@/messages/uk.json";

describe("STANDARD_RULES", () => {
  it("has unique keys matching STANDARD_RULE_KEYS exactly", () => {
    const keys = STANDARD_RULES.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual([...STANDARD_RULE_KEYS].sort());
  });

  it("every rule has at least one interval within schema bounds", () => {
    for (const r of STANDARD_RULES) {
      expect(r.intervalKm !== undefined || r.intervalMonths !== undefined).toBe(true);
      if (r.intervalKm !== undefined) {
        expect(r.intervalKm).toBeGreaterThanOrEqual(1);
        expect(r.intervalKm).toBeLessThanOrEqual(1_000_000);
      }
      if (r.intervalMonths !== undefined) {
        expect(r.intervalMonths).toBeGreaterThanOrEqual(1);
        expect(r.intervalMonths).toBeLessThanOrEqual(600);
      }
    }
  });

  it("en and uk catalogs name every standard rule (and nothing else)", () => {
    for (const catalog of [en, uk]) {
      const names = (catalog as { standardRules: Record<string, string> }).standardRules;
      expect(Object.keys(names).sort()).toEqual([...STANDARD_RULE_KEYS].sort());
      for (const key of STANDARD_RULE_KEYS) {
        expect(names[key].length).toBeGreaterThan(0);
      }
    }
  });
});
