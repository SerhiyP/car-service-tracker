import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, LOCALE_COOKIE, locales, type Locale } from "./config";

export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieLocale = store.get(LOCALE_COOKIE)?.value;
  const locale: Locale = locales.includes(cookieLocale as Locale)
    ? (cookieLocale as Locale)
    : defaultLocale;

  return {
    locale,
    // Business logic uses UTC date accessors; format in UTC too so server
    // and client render identical markup regardless of environment TZ.
    timeZone: "UTC",
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
