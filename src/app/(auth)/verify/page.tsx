import { VerifyForm } from "@/components/auth/verify-form";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return <VerifyForm initialEmail={email ?? ""} />;
}
