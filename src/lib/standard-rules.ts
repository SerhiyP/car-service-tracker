export const STANDARD_RULE_KEYS = [
  "engineOil",
  "airFilter",
  "cabinFilter",
  "fuelFilter",
  "sparkPlugs",
  "brakePadsFront",
  "brakePadsRear",
  "brakeDiscsFront",
  "brakeDiscsRear",
  "brakeFluid",
  "timingBelt",
  "coolant",
  "transmissionOil",
  "battery",
] as const;

export type StandardRuleKey = (typeof STANDARD_RULE_KEYS)[number];

export interface StandardRule {
  key: StandardRuleKey;
  intervalKm?: number;
  intervalMonths?: number;
}

/** Conservative defaults; users edit the created rules like any other rule. */
export const STANDARD_RULES: readonly StandardRule[] = [
  { key: "engineOil", intervalKm: 10_000, intervalMonths: 12 },
  { key: "airFilter", intervalKm: 30_000, intervalMonths: 24 },
  { key: "cabinFilter", intervalKm: 15_000, intervalMonths: 12 },
  { key: "fuelFilter", intervalKm: 30_000 },
  { key: "sparkPlugs", intervalKm: 60_000 },
  { key: "brakePadsFront", intervalKm: 40_000 },
  { key: "brakePadsRear", intervalKm: 60_000 },
  { key: "brakeDiscsFront", intervalKm: 80_000 },
  { key: "brakeDiscsRear", intervalKm: 100_000 },
  { key: "brakeFluid", intervalKm: 40_000, intervalMonths: 24 },
  { key: "timingBelt", intervalKm: 90_000, intervalMonths: 60 },
  { key: "coolant", intervalKm: 60_000, intervalMonths: 48 },
  { key: "transmissionOil", intervalKm: 60_000 },
  { key: "battery", intervalMonths: 60 },
];

export interface StandardRuleResolved {
  componentName: string;
  intervalKm?: number;
  intervalMonths?: number;
}

/**
 * Maps selected keys to rule inputs, translating names with `t` and skipping
 * names that already exist on the car (case-insensitive).
 */
export function resolveStandardRules(
  keys: readonly StandardRuleKey[],
  existingComponentNames: readonly string[],
  t: (key: StandardRuleKey) => string,
): StandardRuleResolved[] {
  const existing = new Set(existingComponentNames.map((n) => n.toLowerCase()));
  const selected = new Set(keys);
  return STANDARD_RULES.filter(
    (r) => selected.has(r.key) && !existing.has(t(r.key).toLowerCase()),
  ).map((r) => ({
    componentName: t(r.key),
    ...(r.intervalKm !== undefined && { intervalKm: r.intervalKm }),
    ...(r.intervalMonths !== undefined && { intervalMonths: r.intervalMonths }),
  }));
}
