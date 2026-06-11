"use client";

import { useTranslations } from "next-intl";
import { WifiOff } from "lucide-react";
import { useOnline } from "@/hooks/use-online";
import { Badge } from "@/components/ui/badge";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SignOutButton } from "@/components/sign-out-button";

export function AppHeader() {
  const t = useTranslations("common");
  const online = useOnline();

  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between gap-2 p-3">
        <h1 className="text-base font-semibold tracking-tight">{t("appName")}</h1>
        <div className="flex items-center gap-2">
          {!online && (
            <Badge variant="secondary" className="gap-1">
              <WifiOff className="size-3" />
              {t("offline")}
            </Badge>
          )}
          <LocaleSwitcher />
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
