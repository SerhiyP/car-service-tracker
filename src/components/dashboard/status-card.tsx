"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { MaintenanceInfo } from "@/lib/maintenance";
import type { ServiceLog } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const STATUS_STYLES = {
  green: "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  yellow: "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  red: "bg-red-500/10 text-red-700 dark:bg-red-500/15 dark:text-red-400",
} as const;

const STATUS_LABEL_KEYS = {
  green: "statusOk",
  yellow: "statusDue",
  red: "statusOverdue",
} as const;

export function StatusCard({
  componentName,
  info,
  lastService,
  onLogService,
}: {
  componentName: string;
  info: MaintenanceInfo;
  lastService: ServiceLog | null;
  onLogService: () => void;
}) {
  const t = useTranslations("dashboard");
  const format = useFormatter();

  const kmText =
    info.remainingKm === null
      ? null
      : info.remainingKm >= 0
        ? t("remainingKm", { km: format.number(info.remainingKm) })
        : t("overdueKm", { km: format.number(-info.remainingKm) });

  const daysText =
    info.remainingDays === null
      ? null
      : info.remainingDays >= 0
        ? t("remainingDays", { days: format.number(info.remainingDays) })
        : t("overdueDays", { days: format.number(-info.remainingDays) });

  return (
    <Card>
      <CardContent className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 flex-1 truncate font-medium">{componentName}</p>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
              STATUS_STYLES[info.status],
            )}
          >
            {t(STATUS_LABEL_KEYS[info.status])}
          </span>
        </div>
        <p className="text-lg font-semibold tracking-tight tabular-nums">
          {kmText && daysText ? `${kmText} · ${daysText}` : (kmText ?? daysText ?? t("neverServiced"))}
        </p>
        <div className="flex items-end justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {lastService
              ? t("lastService", {
                  date: format.dateTime(new Date(lastService.dateAtService), {
                    dateStyle: "medium",
                  }),
                  km: format.number(lastService.mileageAtService),
                })
              : " "}
          </p>
          <Button variant="outline" size="sm" onClick={onLogService}>
            {t("logService")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
