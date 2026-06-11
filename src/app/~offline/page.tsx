import { getTranslations } from "next-intl/server";

export default async function OfflinePage() {
  const t = await getTranslations("offlinePage");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("description")}</p>
    </main>
  );
}
