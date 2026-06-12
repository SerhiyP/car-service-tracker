import { Suspense } from "react";
import { LogVisitPage } from "@/components/cars/log-visit-page";

export default async function LogVisitRoute({
  params,
}: {
  params: Promise<{ carId: string }>;
}) {
  const { carId } = await params;
  return (
    <Suspense>
      <LogVisitPage carId={carId} />
    </Suspense>
  );
}
