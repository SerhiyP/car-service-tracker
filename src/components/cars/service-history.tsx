"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { deleteLogAction } from "@/actions/logs";
import { deleteVisitAction } from "@/actions/visits";
import { actionErrorKey } from "@/lib/action-feedback";
import { resolveIcon } from "@/lib/component-icons";
import { useGarageStore } from "@/stores/garage";
import type { ServiceLog } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Entry = {
  kind: "visit" | "legacy";
  id: string;
  date: string;
  mileage: number;
  totalCost: number | null;
  logs: ServiceLog[];
};

export function ServiceHistory({ carId }: { carId: string }) {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const visits = useGarageStore((s) => s.visits);
  const rules = useGarageStore((s) => s.rules);
  const allLogs = useGarageStore((s) => s.logs);
  const store = useGarageStore();

  const carLogs = allLogs.filter((l) => l.carId === carId);

  const entries: Entry[] = [];
  for (const visit of visits.filter((v) => v.carId === carId)) {
    const logs = carLogs.filter((l) => l.visitId === visit.id);
    if (logs.length === 0) continue;
    entries.push({
      kind: "visit",
      id: visit.id,
      date: visit.dateAtService,
      mileage: visit.mileageAtService,
      totalCost: visit.totalCost ?? null,
      logs,
    });
  }
  for (const log of carLogs.filter((l) => !l.visitId)) {
    entries.push({
      kind: "legacy",
      id: log.id,
      date: log.dateAtService,
      mileage: log.mileageAtService,
      totalCost: null,
      logs: [log],
    });
  }
  entries.sort((a, b) => b.date.localeCompare(a.date));

  function iconFor(log: ServiceLog) {
    const rule = rules.find((r) => r.carId === carId && r.componentName === log.componentName);
    return resolveIcon({ name: log.componentName, storedKey: rule?.icon });
  }

  async function handleDeleteVisit(visitId: string) {
    if (!window.confirm(t("car.deleteVisitConfirm"))) return;
    const snapshot = { visits: store.visits, logs: store.logs };
    store.removeVisitAndLogs(visitId);
    const result = await deleteVisitAction({ carId, visitId });
    const errorKey = actionErrorKey(result);
    if (errorKey) {
      useGarageStore.setState(snapshot);
      toast.error(t(errorKey));
    } else {
      toast.success(t("car.visitDeleted"));
    }
  }

  async function handleDeleteLog(logId: string) {
    if (!window.confirm(t("car.deleteLogConfirm"))) return;
    const previous = store.logs;
    store.removeLog(logId);
    const result = await deleteLogAction({ logId, carId });
    const errorKey = actionErrorKey(result);
    if (errorKey) {
      useGarageStore.setState({ logs: previous });
      toast.error(t(errorKey));
    } else if (result?.data?.removedVisitId) {
      store.removeVisit(result.data.removedVisitId);
    }
  }

  return (
    <div className="space-y-3">
      {entries.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("car.noLogs")}</p>
      )}
      {entries.map((entry) => (
        <Card key={entry.id}>
          <CardContent className="flex items-start justify-between">
            <div className="space-y-2">
              <div>
                <p className="font-medium">
                  {format.dateTime(new Date(entry.date), { dateStyle: "medium" })}
                  {" · "}
                  {entry.mileage.toLocaleString()} km
                </p>
                {entry.totalCost !== null && (
                  <p className="text-sm text-muted-foreground">
                    {t("car.visitTotal", {
                      amount: format.number(entry.totalCost, {
                        style: "currency",
                        currency: "UAH",
                        currencyDisplay: "narrowSymbol",
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      }),
                    })}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {entry.logs.map((log) => {
                  const Icon = iconFor(log);
                  return (
                    <Icon
                      key={log.id}
                      role="img"
                      className="size-5 text-muted-foreground"
                      aria-label={log.componentName}
                    />
                  );
                })}
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("common.edit")}
                onClick={() => router.push(`/cars/${carId}/edit-visit/${entry.logs[0].id}`)}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("common.delete")}
                onClick={() =>
                  entry.kind === "visit"
                    ? handleDeleteVisit(entry.id)
                    : handleDeleteLog(entry.id)
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
