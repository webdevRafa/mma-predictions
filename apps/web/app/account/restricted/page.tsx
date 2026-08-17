import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Account restricted",
  robots: { index: false, follow: false },
};

export default async function RestrictedAccountPage() {
  const session = await requireSession("/account/restricted");
  return (
    <main
      className="shell grid min-h-[70vh] place-items-center py-12"
      id="main-content"
    >
      <Card className="w-full max-w-xl p-6 text-center sm:p-8">
        <ShieldAlert
          aria-hidden="true"
          className="mx-auto text-fl-danger"
          size={34}
        />
        <p className="eyebrow mt-5">Account status</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold capitalize">
          {session.accountStatus}
        </h1>
        <p className="mt-4 text-sm leading-6 text-fl-text-muted">
          This account can read public FightLobby pages but cannot submit
          mutations while restricted. Contact support if you believe this is an
          error.
        </p>
        <Link
          className="focus-ring mt-6 inline-block rounded-lg text-sm font-bold text-fl-accent"
          href="/"
        >
          Return home
        </Link>
      </Card>
    </main>
  );
}
