import { EditVisitPage } from "@/components/cars/edit-visit-page";

export default async function EditVisitRoute({
  params,
}: {
  params: Promise<{ carId: string; logId: string }>;
}) {
  const { carId, logId } = await params;
  return <EditVisitPage carId={carId} logId={logId} />;
}
