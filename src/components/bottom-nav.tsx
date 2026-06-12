"use client";

import { useSyncExternalStore } from "react";
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
  // The persisted store rehydrates synchronously on the client, so without
  // this gate the first client render (cars present) would not match the
  // server HTML (no cars) and hydration would fail.
  // useSyncExternalStore returns the serverSnapshot on the server / first
  // hydration pass and switches to the clientSnapshot only after mount.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const cars = useGarageStore((s) => s.cars);
  const rules = useGarageStore((s) => s.rules);
  const selectedCarId = useGarageStore((s) => s.selectedCarId);
  const car = mounted ? (cars.find((c) => c.id === selectedCarId) ?? null) : null;
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
