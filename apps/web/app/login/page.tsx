import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Card, CardHeader } from "@/components/ui/card";
import { AuthForm } from "@/features/auth/auth-form";
import { getOptionalSession } from "@/lib/auth/session";
import { safeReturnPath } from "@/lib/auth/return-path";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const returnTo = safeReturnPath((await searchParams).returnTo);
  const session = await getOptionalSession();
  if (session?.onboardingComplete) redirect(returnTo);
  if (session) redirect(`/onboarding?returnTo=${encodeURIComponent(returnTo)}`);
  return (
    <main
      className="shell grid min-h-[72vh] place-items-center py-12"
      id="main-content"
    >
      <Card className="w-full max-w-md">
        <CardHeader
          eyebrow="Welcome back"
          title="Return to the lobby"
          description="Your pending route and prediction context stay with you."
        />
        <div className="p-5 sm:p-6">
          <AuthForm mode="login" returnTo={returnTo} />
        </div>
      </Card>
    </main>
  );
}
