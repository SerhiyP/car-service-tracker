"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("dashboard");
  const [value, setValue] = useState(String(currentMileage));

  useEffect(() => {
    setValue(String(currentMileage));
  }, [currentMileage]);

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const mileage = Number(value);
        if (value === "" || !Number.isFinite(mileage) || mileage < 0) return;
        onSubmit(Math.floor(mileage));
      }}
    >
      <div className="flex-1 space-y-1">
        <Label htmlFor="mileage">{t("currentMileage")}</Label>
        <Input
          id="mileage"
          type="number"
          inputMode="numeric"
          min={0}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      <Button type="submit">{t("updateMileage")}</Button>
    </form>
  );
}
