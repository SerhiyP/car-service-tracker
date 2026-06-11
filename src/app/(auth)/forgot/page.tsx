import { ForgotForm } from "@/components/auth/forgot-form";

export default async function ForgotPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return <ForgotForm initialEmail={email ?? ""} />;
}
