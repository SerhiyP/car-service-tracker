"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { requestPasswordResetAction, resetPasswordAction } from "@/actions/auth";
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

export function ForgotForm({ initialEmail }: { initialEmail: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [stage, setStage] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown === 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // While locked, retrying cannot succeed — only a resend re-enables the form.
  const locked = feedback?.kind === "locked";

  const request = useAction(requestPasswordResetAction, {
    onSuccess({ data }) {
      if (!data) return;
      setStage("reset");
      setCooldown(data.retryAfterSec);
      if (data.status === "sent") {
        setFeedback({ kind: "sent" });
        setCode("");
      }
    },
    onError({ error }) {
      setFeedback({ kind: "error", key: actionErrorKey(error) ?? "errors.server" });
    },
  });

  const reset = useAction(resetPasswordAction, {
    onSuccess({ data }) {
      if (!data) return;
      switch (data.status) {
        case "reset":
          router.push("/login?reset=1");
          break;
        case "codeInvalid":
          setFeedback({ kind: "codeInvalid", attemptsLeft: data.attemptsLeft });
          setCode("");
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

  const busy = request.isExecuting || reset.isExecuting;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auth.forgotTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (busy) return;
            if (stage === "request") {
              request.execute({ email });
            } else if (!locked) {
              reset.execute({ email, code, newPassword });
            }
          }}
        >
          <p className="text-sm text-muted-foreground">{t("auth.forgotInstructions")}</p>
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
                setFeedback(null); // a different email is a different reset state
              }}
            />
          </div>
          {stage === "reset" && (
            <>
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
                  aria-invalid={feedback?.kind === "codeInvalid" || undefined}
                  aria-describedby={feedback?.kind === "codeInvalid" ? "code-error" : undefined}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">{t("auth.newPassword")}</Label>
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  disabled={locked}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </>
          )}
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
          {stage === "request" ? (
            <Button type="submit" size="lg" className="w-full" disabled={busy || !email}>
              {request.isExecuting ? t("common.loading") : t("auth.sendCode")}
            </Button>
          ) : (
            <>
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={locked || busy}
              >
                {reset.isExecuting ? t("common.loading") : t("auth.resetPassword")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full"
                disabled={busy || cooldown > 0 || !email}
                onClick={() => {
                  if (locked) setFeedback(null); // a fresh code unlocks the form
                  request.execute({ email });
                }}
              >
                {cooldown > 0
                  ? t("auth.resendIn", { seconds: cooldown })
                  : request.isExecuting
                    ? t("common.loading")
                    : t("auth.resendCode")}
              </Button>
            </>
          )}
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
