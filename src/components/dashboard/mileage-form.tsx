"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MileageForm({
  currentMileage,
  onSubmit,
}: {
  currentMileage: number;
  onSubmit: (mileage: number) => Promise<boolean>;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  // React-approved "derived state from props" reset — no effects.
  const [prevMileage, setPrevMileage] = useState(currentMileage);
  if (editing && prevMileage !== currentMileage) {
    setPrevMileage(currentMileage);
    setValue(String(currentMileage));
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{t("dashboard.currentMileage")}</p>
          <p className="font-medium">{format.number(currentMileage)} km</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("common.edit")}
          onClick={() => {
            setValue(String(currentMileage));
            setPrevMileage(currentMileage);
            setEditing(true);
          }}
        >
          <Pencil className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const mileage = Number(value);
        if (value === "" || !Number.isFinite(mileage) || mileage < 0) return;
        setBusy(true);
        try {
          if (await onSubmit(Math.floor(mileage))) setEditing(false);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="flex-1 space-y-1">
        <Label htmlFor="mileage">{t("dashboard.currentMileage")}</Label>
        <Input
          id="mileage"
          type="number"
          inputMode="numeric"
          min={0}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !busy) setEditing(false);
          }}
        />
      </div>
      <Button type="submit" size="lg" disabled={busy}>
        {t("dashboard.updateMileage")}
      </Button>
    </form>
  );
}
