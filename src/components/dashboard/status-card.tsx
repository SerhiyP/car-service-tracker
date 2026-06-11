"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { MaintenanceInfo } from "@/lib/maintenance";
import type { ServiceLog } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const STATUS_STYLES = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  red: "bg-red-500",
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
      <CardContent className="flex items-center gap-3 p-4">
        <span
          aria-label={info.status}
          className={cn("size-3 shrink-0 rounded-full", STATUS_STYLES[info.status])}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{componentName}</p>
          <p className="text-sm text-muted-foreground">
            {kmText && daysText ? `${kmText} · ${daysText}` : (kmText ?? daysText ?? t("neverServiced"))}
          </p>
          {lastService && (
            <p className="text-xs text-muted-foreground">
              {t("lastService", {
                date: format.dateTime(new Date(lastService.dateAtService), {
                  dateStyle: "medium",
                }),
                km: format.number(lastService.mileageAtService),
              })}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={onLogService}>
          {t("logService")}
        </Button>
      </CardContent>
    </Card>
  );
}
