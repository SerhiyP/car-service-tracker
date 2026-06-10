import { getTranslations } from "next-intl/server";
import { CarList } from "@/components/cars/car-list";

export default async function GaragePage() {
  const t = await getTranslations("garage");
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">{t("title")}</h2>
      <CarList />
    </div>
  );
}
