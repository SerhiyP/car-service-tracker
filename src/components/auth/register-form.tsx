"use client";

import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { registerAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function FieldError({ messages }: { messages?: string[] }) {
  const t = useTranslations();
  if (!messages?.length) return null;
  return <p className="text-sm text-destructive">{t(messages[0])}</p>;
}

export function RegisterForm() {
  const t = useTranslations();
  const { execute, result, isExecuting } = useAction(registerAction);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auth.registerTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            execute({
              name: String(data.get("name")),
              email: String(data.get("email")),
              password: String(data.get("password")),
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="name">{t("auth.name")}</Label>
            <Input id="name" name="name" autoComplete="name" required />
            <FieldError messages={result.validationErrors?.name?._errors} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
            <FieldError messages={result.validationErrors?.email?._errors} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
            />
            <FieldError messages={result.validationErrors?.password?._errors} />
          </div>
          {result.serverError && (
            <p className="text-sm text-destructive">{t(result.serverError)}</p>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={isExecuting}>
            {isExecuting ? t("common.loading") : t("auth.signUp")}
          </Button>
          <p className="text-center text-sm">
            <Link href="/login" className="underline">
              {t("auth.haveAccount")}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
