import { CarDetail } from "@/components/cars/car-detail";

export default async function CarPage({
  params,
}: {
  params: Promise<{ carId: string }>;
}) {
  const { carId } = await params;
  return <CarDetail carId={carId} />;
}
