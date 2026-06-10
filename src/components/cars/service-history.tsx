"use client";

import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { deleteLogAction } from "@/actions/logs";
import { actionErrorKey } from "@/lib/action-feedback";
import { useGarageStore } from "@/stores/garage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ServiceHistory({ carId }: { carId: string }) {
  const t = useTranslations();
  const format = useFormatter();
  const logs = useGarageStore((s) => s.logs)
    .filter((l) => l.carId === carId)
    .sort((a, b) => b.dateAtService.localeCompare(a.dateAtService));
  const store = useGarageStore();

  async function handleDelete(logId: string) {
    if (!window.confirm(t("car.deleteLogConfirm"))) return;
    const previous = store.logs;
    store.removeLog(logId);
    const result = await deleteLogAction({ logId, carId });
    const errorKey = actionErrorKey(result);
    if (errorKey) {
      useGarageStore.setState({ logs: previous });
      toast.error(t(errorKey));
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold">{t("car.history")}</h3>
      {logs.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("car.noLogs")}</p>
      )}
      {logs.map((log) => (
        <Card key={log.id}>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{log.componentName}</p>
              <p className="text-sm text-muted-foreground">
                {format.dateTime(new Date(log.dateAtService), {
                  dateStyle: "medium",
                })}
                {" · "}
                {log.mileageAtService.toLocaleString()} km
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("common.delete")}
              onClick={() => handleDelete(log.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
