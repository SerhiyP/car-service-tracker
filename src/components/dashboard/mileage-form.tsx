"use client";

import { useState } from "react";
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
  // Track the last prop value seen so we can reset the input when it changes
  // (e.g. after a successful server update). This is the React-approved
  // "derived state from props" pattern — no effects, no ref reads during render.
  const [prevMileage, setPrevMileage] = useState(currentMileage);
  const [value, setValue] = useState(String(currentMileage));

  if (prevMileage !== currentMileage) {
    setPrevMileage(currentMileage);
    setValue(String(currentMileage));
  }

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
      <Button type="submit" size="lg">{t("updateMileage")}</Button>
    </form>
  );
}
