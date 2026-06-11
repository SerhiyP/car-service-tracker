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
