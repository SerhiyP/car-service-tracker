"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MileageForm({
  currentMileage,
  onSubmit,
}: {
  currentMileage: number;
  onSubmit: (mileage: number) => void;
}) {
  const t = useTranslations();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  if (!editing) {
    return (
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{t("dashboard.currentMileage")}</p>
          <p className="font-medium">{currentMileage.toLocaleString()} km</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("common.edit")}
          onClick={() => {
            setValue(String(currentMileage));
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
      onSubmit={(e) => {
        e.preventDefault();
        const mileage = Number(value);
        if (value === "" || !Number.isFinite(mileage) || mileage < 0) return;
        onSubmit(Math.floor(mileage));
        setEditing(false);
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
            if (e.key === "Escape") setEditing(false);
          }}
        />
      </div>
      <Button type="submit" size="lg">
        {t("dashboard.updateMileage")}
      </Button>
    </form>
  );
}
