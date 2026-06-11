import { createTranslator } from "next-intl";

/**
 * Sends the verification code via Brevo's transactional API.
 * Plain fetch — no SDK. Throws on missing config or non-2xx response;
 * callers decide whether that is fatal (resend) or survivable (register).
 */
export async function sendVerificationEmail(
  to: string,
  code: string,
  locale: string,
): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey) throw new Error("BREVO_API_KEY is not set");
  if (!from) throw new Error("EMAIL_FROM is not set");
  const fromName = process.env.EMAIL_FROM_NAME ?? "Car Service Tracker";

  const messages = (await import(`../messages/${locale}.json`)).default;
  const t = createTranslator({ locale, messages });

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: from, name: fromName },
      to: [{ email: to }],
      subject: t("auth.verifyEmailSubject"),
      textContent: t("auth.verifyEmailBody", { code }),
    }),
  });
  if (!res.ok) {
    throw new Error(`Brevo send failed: ${res.status} ${await res.text()}`);
  }
}
