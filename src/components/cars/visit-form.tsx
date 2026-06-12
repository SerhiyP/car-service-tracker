"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function VisitForm({
  listedNames,
  initialChecked,
  initialMileage,
  initialDate,
  initialCost,
  submitLabel,
  busy,
  onSubmit,
}: {
  listedNames: string[];
  initialChecked: string[];
  initialMileage: number;
  initialDate: string;
  initialCost?: number;
  submitLabel: (count: number) => string;
  busy: boolean;
  onSubmit: (values: {
    componentNames: string[];
    mileage: number;
    date: string;
    cost: string;
  }) => void;
}) {
  const t = useTranslations("car");
  const today = new Date().toISOString().slice(0, 10);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const isChecked = (name: string) => checked[name] ?? initialChecked.includes(name);
  const selected = listedNames.filter(isChecked);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    onSubmit({
      componentNames: selected,
      mileage: Number(data.get("mileage")),
      date: String(data.get("date")),
      cost: String(data.get("cost") ?? "").trim(),
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1">
        {listedNames.map((name) => (
          <label
            key={name}
            className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-accent"
          >
            <input
              type="checkbox"
              className="size-4 accent-primary"
              aria-label={name}
              checked={isChecked(name)}
              disabled={busy}
              onChange={(e) =>
                setChecked((c) => ({ ...c, [name]: e.target.checked }))
              }
            />
            <span className="flex-1 font-medium">{name}</span>
          </label>
        ))}
      </div>
      <div className="space-y-2">
        <Label htmlFor="visit-mileage">{t("serviceMileage")}</Label>
        <Input
          id="visit-mileage"
          name="mileage"
          type="number"
          inputMode="numeric"
          min={0}
          defaultValue={initialMileage}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="visit-date">{t("serviceDate")}</Label>
        <Input
          id="visit-date"
          name="date"
          type="date"
          max={today}
          defaultValue={initialDate}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="visit-cost">{t("totalCost")}</Label>
        <Input
          id="visit-cost"
          name="cost"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          defaultValue={initialCost ?? ""}
        />
      </div>
      <Button
        type="submit"
        size="lg"
        className="w-full"
        loading={busy}
        disabled={selected.length === 0}
      >
        {submitLabel(selected.length)}
      </Button>
    </form>
  );
}
