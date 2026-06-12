"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CarFront,
  LayoutDashboard,
  Warehouse,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useGarageStore } from "@/stores/garage";
import { cn } from "@/lib/utils";

// Stable references from the initial store config — same objects on every call,
// so selectors that return them don't trigger useSyncExternalStore infinite loops.
const { cars: INIT_CARS, rules: INIT_RULES } = useGarageStore.getInitialState();

function itemClasses(active: boolean) {
  return cn(
    "flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors",
    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
  );
}

function ItemIcon({ icon: Icon, active }: { icon: LucideIcon; active: boolean }) {
  return (
    <span
      className={cn(
        "flex h-6 w-12 items-center justify-center rounded-full transition-colors",
        active && "bg-primary/10",
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
    </span>
  );
}

export function BottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const router = useRouter();
  // isServerSyncing is not persisted, so it is true on the server and during
  // hydration even when persisted cars are already in the store — these
  // selectors return the initial values until GarageProvider's first sync,
  // keeping the first client render identical to the server HTML.
  const cars = useGarageStore((s) => (s.isServerSyncing ? INIT_CARS : s.cars));
  const rules = useGarageStore((s) => (s.isServerSyncing ? INIT_RULES : s.rules));
  const selectedCarId = useGarageStore((s) => (s.isServerSyncing ? null : s.selectedCarId));
  const car = cars.find((c) => c.id === selectedCarId) ?? null;
  const hasRules = car !== null && rules.some((r) => r.carId === car.id);

  const dashboardActive = pathname === "/";
  const carActive = car !== null && pathname === `/cars/${car.id}`;
  const garageActive = pathname === "/cars";

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/80 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-md">
        <Link
          href="/"
          aria-current={dashboardActive ? "page" : undefined}
          className={itemClasses(dashboardActive)}
        >
          <ItemIcon icon={LayoutDashboard} active={dashboardActive} />
          {t("dashboard")}
        </Link>
        <button
          type="button"
          disabled={!hasRules}
          onClick={() => car && router.push(`/cars/${car.id}/log-visit`)}
          className={cn(itemClasses(false), "disabled:opacity-40")}
        >
          <ItemIcon icon={Wrench} active={false} />
          {t("log")}
        </button>
        {car ? (
          <Link
            href={`/cars/${car.id}`}
            aria-current={carActive ? "page" : undefined}
            className={itemClasses(carActive)}
          >
            <ItemIcon icon={CarFront} active={carActive} />
            {t("car")}
          </Link>
        ) : (
          <span aria-disabled="true" className={cn(itemClasses(false), "opacity-40")}>
            <ItemIcon icon={CarFront} active={false} />
            {t("car")}
          </span>
        )}
        <Link
          href="/cars"
          aria-current={garageActive ? "page" : undefined}
          className={itemClasses(garageActive)}
        >
          <ItemIcon icon={Warehouse} active={garageActive} />
          {t("garage")}
        </Link>
      </div>
    </nav>
  );
}
