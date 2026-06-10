import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { GarageProvider } from "@/components/garage-provider";
import { Toaster } from "@/components/ui/sonner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <GarageProvider>
      <AppHeader />
      <main className="mx-auto max-w-md p-4 pb-20">{children}</main>
      <BottomNav />
      <Toaster position="top-center" />
    </GarageProvider>
  );
}
