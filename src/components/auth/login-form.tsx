"use client";

import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { loginAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const t = useTranslations();
  const { execute, result, isExecuting } = useAction(loginAction);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auth.loginTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            execute({
              email: String(data.get("email")),
              password: String(data.get("password")),
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          {result.serverError && (
            <p className="text-sm text-destructive">{t(result.serverError)}</p>
          )}
          <Button type="submit" className="w-full" disabled={isExecuting}>
            {isExecuting ? t("common.loading") : t("auth.signIn")}
          </Button>
          <p className="text-center text-sm">
            <Link href="/register" className="underline">
              {t("auth.noAccount")}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
