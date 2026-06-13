import {
  BatteryCharging,
  CircleDot,
  CircleStop,
  Cog,
  Droplet,
  Droplets,
  Filter,
  Lightbulb,
  Settings2,
  Snowflake,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ComponentIconKey } from "@/lib/types";

const ICONS: Record<ComponentIconKey, LucideIcon> = {
  oil: Droplet,
  filter: Filter,
  spark: Zap,
  brake: CircleStop,
  belt: Cog,
  coolant: Snowflake,
  transmission: Settings2,
  battery: BatteryCharging,
  tire: CircleDot,
  light: Lightbulb,
  fluid: Droplets,
  wrench: Wrench,
};

export function iconByKey(key: ComponentIconKey): LucideIcon {
  return ICONS[key] ?? Wrench;
}

// Ordered: first match wins, so "brake fluid" resolves to brake (not a fluid key).
const INFERENCE: ReadonlyArray<readonly [ComponentIconKey, readonly string[]]> = [
  ["oil", ["oil", "олив", "масл"]],
  ["filter", ["filter", "фільтр"]],
  ["spark", ["spark", "свічк"]],
  ["brake", ["brake", "гальмів"]],
  ["belt", ["belt", "timing", "ремінь", "грм"]],
  ["coolant", ["coolant", "antifreeze", "охолодж", "антифриз"]],
  ["transmission", ["transmission", "трансмісій", "коробк"]],
  ["battery", ["battery", "акумулятор"]],
  ["tire", ["tire", "tyre", "шин", "колес"]],
];

export function inferIconKey(name: string): ComponentIconKey | null {
  const lower = name.toLowerCase();
  for (const [key, keywords] of INFERENCE) {
    if (keywords.some((kw) => lower.includes(kw))) return key;
  }
  return null;
}

export function resolveIcon({
  name,
  storedKey,
}: {
  name: string;
  storedKey?: ComponentIconKey;
}): LucideIcon {
  if (storedKey) return iconByKey(storedKey);
  const inferred = inferIconKey(name);
  return inferred ? iconByKey(inferred) : Wrench;
}
