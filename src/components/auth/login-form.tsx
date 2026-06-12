"use client";

import { useTranslations } from "next-intl";
import { loginWithGoogleAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginForm({ error = false }: { error?: boolean }) {
  const t = useTranslations();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auth.loginTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={loginWithGoogleAction} className="space-y-4">
          <div aria-live="polite">
            {error && (
              <p className="text-sm text-destructive">{t("auth.googleSignInFailed")}</p>
            )}
          </div>
          <Button type="submit" size="lg" className="w-full">
            {t("auth.continueWithGoogle")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
