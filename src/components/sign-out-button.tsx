"use client";

import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const t = useTranslations("auth");
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t("signOut")}
      onClick={() => logoutAction()}
    >
      <LogOut className="size-5" />
    </Button>
  );
}
