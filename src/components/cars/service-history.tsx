"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { deleteLogAction } from "@/actions/logs";
import { actionErrorKey } from "@/lib/action-feedback";
import { useGarageStore } from "@/stores/garage";
import type { ServiceLog } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ServiceHistory({ carId }: { carId: string }) {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const visits = useGarageStore((s) => s.visits);
  const logs = useGarageStore((s) => s.logs)
    .filter((l) => l.carId === carId)
    .sort((a, b) => b.dateAtService.localeCompare(a.dateAtService));
  const store = useGarageStore();

  // The visit total renders once per visit, on its first (newest) row.
  function visitTotalFor(log: ServiceLog, index: number): number | null {
    if (!log.visitId) return null;
    if (logs.findIndex((l) => l.visitId === log.visitId) !== index) return null;
    return visits.find((v) => v.id === log.visitId)?.totalCost ?? null;
  }

  async function handleDelete(logId: string) {
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
      <h3 className="text-sm font-medium text-muted-foreground">{t("car.history")}</h3>
      {logs.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("car.noLogs")}</p>
      )}
      {logs.map((log, index) => {
        const visitTotal = visitTotalFor(log, index);
        return (
          <Card key={log.id}>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="font-medium">{log.componentName}</p>
                <p className="text-sm text-muted-foreground">
                  {format.dateTime(new Date(log.dateAtService), {
                    dateStyle: "medium",
                  })}
                  {" · "}
                  {log.mileageAtService.toLocaleString()} km
                </p>
                {visitTotal !== null && (
                  <p className="text-sm text-muted-foreground">
                    {t("car.visitTotal", {
                      amount: format.number(visitTotal, {
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
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("common.edit")}
                  onClick={() => router.push(`/cars/${carId}/edit-visit/${log.id}`)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("common.delete")}
                  onClick={() => handleDelete(log.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
