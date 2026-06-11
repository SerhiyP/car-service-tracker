import { createTranslator } from "next-intl";
import { defaultLocale, locales, type Locale } from "@/i18n/config";

async function translatorFor(locale: string) {
  // Whitelist-validate: `locale` feeds a dynamic import path.
  const safeLocale: Locale = (locales as readonly string[]).includes(locale)
    ? (locale as Locale)
    : defaultLocale;
  const messages = (await import(`../messages/${safeLocale}.json`)).default;
  return createTranslator({ locale: safeLocale, messages });
}

/**
 * Sends via Brevo's transactional API. Plain fetch — no SDK. Throws on
 * missing config or non-2xx response; callers decide whether that is fatal.
 */
async function sendEmail(to: string, subject: string, textContent: string): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey) throw new Error("BREVO_API_KEY is not set");
  if (!from) throw new Error("EMAIL_FROM is not set");
  const fromName = process.env.EMAIL_FROM_NAME ?? "Car Service Tracker";

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
      subject,
      textContent,
    }),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    throw new Error(`Brevo send failed: ${res.status} ${body}`);
  }
}

export async function sendVerificationEmail(
  to: string,
  code: string,
  locale: string,
): Promise<void> {
  const t = await translatorFor(locale);
  await sendEmail(to, t("auth.verifyEmailSubject"), t("auth.verifyEmailBody", { code }));
}

export async function sendPasswordResetEmail(
  to: string,
  code: string,
  locale: string,
): Promise<void> {
  const t = await translatorFor(locale);
  await sendEmail(to, t("auth.resetEmailSubject"), t("auth.resetEmailBody", { code }));
}
