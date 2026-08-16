import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Card, CardHeader } from "@/components/ui/card";
import { HandleForm } from "@/features/auth/handle-form";
import { safeReturnPath } from "@/lib/auth/return-path";
import { requireSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Choose your handle",
  robots: { index: false, follow: false },
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const returnTo = safeReturnPath((await searchParams).returnTo);
  const session = await requireSession(
    `/onboarding?returnTo=${encodeURIComponent(returnTo)}`,
  );
  if (["banned", "deleted"].includes(session.accountStatus))
    redirect("/account/restricted");
  if (session.onboardingComplete) redirect(returnTo);
  return (
    <main
      className="shell grid min-h-[72vh] place-items-center py-12"
      id="main-content"
    >
      <Card className="w-full max-w-xl">
        <CardHeader
          eyebrow="One last step"
          title="Choose your corner"
          description="Your handle appears on predictions, leaderboards, and public lobby messages. Your email never does."
        />
        <div className="p-5 sm:p-6">
          <HandleForm returnTo={returnTo} />
        </div>
      </Card>
    </main>
  );
}
