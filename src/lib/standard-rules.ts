import type { ComponentIconKey } from "@/lib/types";

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
  icon: ComponentIconKey;
}

/** Conservative defaults; users edit the created rules like any other rule. */
export const STANDARD_RULES: readonly StandardRule[] = [
  { key: "engineOil", intervalKm: 10_000, intervalMonths: 12, icon: "oil" },
  { key: "airFilter", intervalKm: 30_000, intervalMonths: 24, icon: "filter" },
  { key: "cabinFilter", intervalKm: 15_000, intervalMonths: 12, icon: "filter" },
  { key: "fuelFilter", intervalKm: 30_000, icon: "filter" },
  { key: "sparkPlugs", intervalKm: 60_000, icon: "spark" },
  { key: "brakePadsFront", intervalKm: 40_000, icon: "brake" },
  { key: "brakePadsRear", intervalKm: 60_000, icon: "brake" },
  { key: "brakeDiscsFront", intervalKm: 80_000, icon: "brake" },
  { key: "brakeDiscsRear", intervalKm: 100_000, icon: "brake" },
  { key: "brakeFluid", intervalKm: 40_000, intervalMonths: 24, icon: "fluid" },
  { key: "timingBelt", intervalKm: 90_000, intervalMonths: 60, icon: "belt" },
  { key: "coolant", intervalKm: 60_000, intervalMonths: 48, icon: "coolant" },
  { key: "transmissionOil", intervalKm: 60_000, icon: "transmission" },
  { key: "battery", intervalMonths: 60, icon: "battery" },
];

export interface StandardRuleResolved {
  componentName: string;
  intervalKm?: number;
  intervalMonths?: number;
  icon?: ComponentIconKey;
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
    icon: r.icon,
  }));
}
