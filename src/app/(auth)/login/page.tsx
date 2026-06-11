import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string; reset?: string }>;
}) {
  const { verified, reset } = await searchParams;
  return <LoginForm verified={verified === "1"} reset={reset === "1"} />;
}
