import { getTranslations } from "next-intl/server";
import { CarList } from "@/components/cars/car-list";
import { DeleteAccountDialog } from "@/components/account/delete-account-dialog";

export default async function GaragePage() {
  const t = await getTranslations("garage");
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight">{t("title")}</h2>
      <CarList />
      <div className="pt-8 text-center">
        <DeleteAccountDialog />
      </div>
    </div>
  );
}
