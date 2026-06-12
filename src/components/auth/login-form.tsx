"use client";

import { useState } from "react";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { loginAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ verified = false, reset = false }: { verified?: boolean; reset?: boolean }) {
  const t = useTranslations();
  const { execute, result, isExecuting } = useAction(loginAction);
  const [email, setEmail] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");

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
            setSubmittedEmail(email);
            execute({ email, password: String(data.get("password")) });
          }}
        >
          {verified && (
            <p className="text-sm text-green-600">{t("auth.verifiedNowLogin")}</p>
          )}
          {reset && <p className="text-sm text-green-600">{t("auth.resetNowLogin")}</p>}
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
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
          <p className="text-right text-sm">
            <Link
              href={email ? `/forgot?email=${encodeURIComponent(email)}` : "/forgot"}
              className="text-muted-foreground underline hover:text-foreground"
            >
              {t("auth.forgotPassword")}
            </Link>
          </p>
          {result.serverError === "auth.emailNotVerified" ? (
            <div className="space-y-1">
              <p className="text-sm text-destructive">{t("auth.emailNotVerified")}</p>
              <Link
                href={`/verify?email=${encodeURIComponent(submittedEmail)}`}
                className="text-sm underline"
              >
                {t("auth.verifyNow")}
              </Link>
            </div>
          ) : result.serverError ? (
            <p className="text-sm text-destructive">{t(result.serverError)}</p>
          ) : null}
          <Button type="submit" size="lg" className="w-full" loading={isExecuting}>
            {t("auth.signIn")}
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
