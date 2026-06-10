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
}

export interface ServiceLog {
  id: string;
  carId: string;
  componentName: string;
  mileageAtService: number;
  dateAtService: string;
}

export interface GarageData {
  cars: Car[];
  rules: MaintenanceRule[];
  logs: ServiceLog[];
  syncedAt: string;
}
