export const COMPONENT_ICON_KEYS = [
  "oil",
  "filter",
  "spark",
  "brake",
  "belt",
  "coolant",
  "transmission",
  "battery",
  "tire",
  "light",
  "fluid",
  "wrench",
] as const;

export type ComponentIconKey = (typeof COMPONENT_ICON_KEYS)[number];

export interface Car {
  id: string;
  name: string;
  currentMileage: number;
  updatedAt: string;
}

export interface MaintenanceRule {
  id: string;
  carId: string;
  componentName: string;
  intervalKm?: number;
  intervalMonths?: number;
  /** User-picked icon; when absent the icon is inferred from componentName. */
  icon?: ComponentIconKey;
}

export interface ServiceLog {
  id: string;
  carId: string;
  componentName: string;
  mileageAtService: number;
  dateAtService: string;
  /** Present on logs created through a visit; absent on legacy logs. */
  visitId?: string;
}

export interface ServiceVisit {
  id: string;
  carId: string;
  mileageAtService: number;
  dateAtService: string;
  totalCost?: number;
}

export interface GarageData {
  cars: Car[];
  rules: MaintenanceRule[];
  logs: ServiceLog[];
  visits: ServiceVisit[];
  syncedAt: string;
}
