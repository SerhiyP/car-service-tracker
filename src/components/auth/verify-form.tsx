"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { resendVerificationCodeAction, verifyEmailAction } from "@/actions/auth";
import { actionErrorKey } from "@/lib/action-feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Feedback =
  | { kind: "codeInvalid"; attemptsLeft: number }
  | { kind: "locked"; key: "auth.tooManyAttempts" | "auth.codeExpired" | "auth.noActiveCode" }
  | { kind: "sent" }
  | { kind: "error"; key: string }
  | null;

export function VerifyForm({ initialEmail }: { initialEmail: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown === 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // While locked, retrying cannot succeed — only a resend re-enables the form.
  const locked = feedback?.kind === "locked";

  const verify = useAction(verifyEmailAction, {
    onSuccess({ data }) {
      if (!data) return;
      switch (data.status) {
        case "verified":
          router.push("/login?verified=1");
          break;
        case "codeInvalid":
          setFeedback({ kind: "codeInvalid", attemptsLeft: data.attemptsLeft });
          setCode("");
          codeRef.current?.focus();
          break;
        case "tooManyAttempts":
          setFeedback({ kind: "locked", key: "auth.tooManyAttempts" });
          setCode("");
          break;
        case "codeExpired":
          setFeedback({ kind: "locked", key: "auth.codeExpired" });
          setCode("");
          break;
        case "noActiveCode":
          setFeedback({ kind: "locked", key: "auth.noActiveCode" });
          setCode("");
          break;
      }
    },
    onError({ error }) {
      setFeedback({ kind: "error", key: actionErrorKey(error) ?? "errors.server" });
    },
  });

  const resend = useAction(resendVerificationCodeAction, {
    onSuccess({ data }) {
      if (!data) return;
      if (data.status === "alreadyVerified") {
        router.push("/login?verified=1");
        return;
      }
      if (data.status === "cooldown") {
        setCooldown(data.retryAfterSec);
        return;
      }
      setFeedback({ kind: "sent" });
      setCode("");
      setCooldown(data.retryAfterSec);
    },
    onError({ error }) {
      setFeedback({ kind: "error", key: actionErrorKey(error) ?? "errors.server" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auth.verifyTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (locked || verify.isExecuting) return;
            verify.execute({ email, code });
          }}
        >
          <p className="text-sm text-muted-foreground">{t("auth.verifyInstructions")}</p>
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFeedback(null); // a different email is a different verification state
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">{t("auth.code")}</Label>
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              disabled={locked}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              ref={codeRef}
              aria-invalid={feedback?.kind === "codeInvalid" || undefined}
              aria-describedby={feedback?.kind === "codeInvalid" ? "code-error" : undefined}
            />
          </div>
          <div aria-live="polite">
            {feedback?.kind === "codeInvalid" && (
              <p id="code-error" className="text-sm text-destructive">
                {t("auth.codeInvalidAttempts", { attemptsLeft: feedback.attemptsLeft })}
              </p>
            )}
            {(feedback?.kind === "locked" || feedback?.kind === "error") && (
              <p className="text-sm text-destructive">{t(feedback.key)}</p>
            )}
            {feedback?.kind === "sent" && (
              <p className="text-sm text-green-600">{t("auth.codeSent")}</p>
            )}
          </div>
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={locked || verify.isExecuting}
          >
            {verify.isExecuting ? t("common.loading") : t("auth.verify")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            disabled={resend.isExecuting || cooldown > 0 || !email}
            onClick={() => resend.execute({ email })}
          >
            {cooldown > 0
              ? t("auth.resendIn", { seconds: cooldown })
              : resend.isExecuting
                ? t("common.loading")
                : t("auth.resendCode")}
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
