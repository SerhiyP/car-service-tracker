import type { ServiceLog } from "./types";

export type ComponentStatus = "green" | "yellow" | "red";

export interface MaintenanceInfo {
  status: ComponentStatus;
  remainingKm: number | null;
  remainingDays: number | null;
}

const DAY_MS = 86_400_000;
const YELLOW_KM_FLOOR = 1000;
const YELLOW_DAYS_FLOOR = 30;
const YELLOW_RATIO = 0.15;

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const daysInTarget = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, daysInTarget));
  return d;
}

function dimensionStatus(remaining: number, total: number, floor: number): ComponentStatus {
  if (remaining <= 0) return "red";
  if (remaining < floor || remaining < total * YELLOW_RATIO) return "yellow";
  return "green";
}

const WORST: Record<ComponentStatus, number> = { green: 0, yellow: 1, red: 2 };

export function computeMaintenance(
  rule: { intervalKm?: number; intervalMonths?: number },
  lastService: { mileageAtService: number; dateAtService: Date } | null,
  currentMileage: number,
  now: Date,
): MaintenanceInfo {
  if (!lastService) {
    return { status: "red", remainingKm: null, remainingDays: null };
  }

  const statuses: ComponentStatus[] = [];
  let remainingKm: number | null = null;
  let remainingDays: number | null = null;

  if (rule.intervalKm !== undefined) {
    remainingKm = lastService.mileageAtService + rule.intervalKm - currentMileage;
    statuses.push(dimensionStatus(remainingKm, rule.intervalKm, YELLOW_KM_FLOOR));
  }

  if (rule.intervalMonths !== undefined) {
    const due = addMonths(lastService.dateAtService, rule.intervalMonths);
    remainingDays = Math.ceil((due.getTime() - now.getTime()) / DAY_MS);
    const totalDays = (due.getTime() - lastService.dateAtService.getTime()) / DAY_MS;
    statuses.push(dimensionStatus(remainingDays, totalDays, YELLOW_DAYS_FLOOR));
  }

  const status = statuses.reduce<ComponentStatus>(
    (worst, s) => (WORST[s] > WORST[worst] ? s : worst),
    "green",
  );

  return { status, remainingKm, remainingDays };
}

export function latestLogFor(
  logs: ServiceLog[],
  carId: string,
  componentName: string,
): ServiceLog | null {
  let latest: ServiceLog | null = null;
  for (const log of logs) {
    if (log.carId !== carId || log.componentName !== componentName) continue;
    if (!latest || log.dateAtService > latest.dateAtService) latest = log;
  }
  return latest;
}
