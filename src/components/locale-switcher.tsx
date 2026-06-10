"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { setLocale } from "@/actions/locale";
import { locales } from "@/i18n/config";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("locale");
  const router = useRouter();

  return (
    <Select
      value={locale}
      onValueChange={async (value) => {
        if (value) {
          await setLocale(value);
          router.refresh();
        }
      }}
    >
      <SelectTrigger className="w-28" aria-label={t("language")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {locales.map((l) => (
          <SelectItem key={l} value={l}>
            {t(l)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
