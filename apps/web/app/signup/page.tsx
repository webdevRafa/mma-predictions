import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Card, CardHeader } from "@/components/ui/card";
import { AuthForm } from "@/features/auth/auth-form";
import { safeReturnPath } from "@/lib/auth/return-path";
import { getOptionalSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Create account",
  robots: { index: false, follow: false },
};

export default async function SignupPage({
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
          eyebrow="Join FightLobby"
          title="Start your record"
          description="Predictions, accuracy, streaks, and every matchup lobby—under one public handle."
        />
        <div className="p-5 sm:p-6">
          <AuthForm mode="signup" returnTo={returnTo} />
        </div>
      </Card>
    </main>
  );
}
