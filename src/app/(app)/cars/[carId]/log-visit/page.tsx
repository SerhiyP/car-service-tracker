import { LogVisitPage } from "@/components/cars/log-visit-page";

export default async function LogVisitRoute({
  params,
  searchParams,
}: {
  params: Promise<{ carId: string }>;
  searchParams: Promise<{ component?: string }>;
}) {
  const { carId } = await params;
  const { component } = await searchParams;
  return <LogVisitPage carId={carId} preselectedComponent={component ?? null} />;
}
