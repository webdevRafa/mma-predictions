import type { Metadata } from "next";

import { Card, CardHeader } from "@/components/ui/card";
import { DeleteAccountForm } from "@/features/settings/delete-account-form";
import { requireOnboardedSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Delete account",
  robots: { index: false, follow: false },
};

export default async function DeleteAccountPage() {
  await requireOnboardedSession("/account/delete");
  return (
    <main
      className="shell grid min-h-[70vh] place-items-center py-12"
      id="main-content"
    >
      <Card className="w-full max-w-xl border-fl-danger/30">
        <CardHeader
          eyebrow="Permanent account action"
          title="Delete your FightLobby account"
          description="This permanently removes your sign-in, private account data, predictions, follows, and uploaded files. Public posts and chat history are deleted or anonymized so conversations remain understandable."
        />
        <div className="p-5 sm:p-6">
          <DeleteAccountForm />
        </div>
      </Card>
    </main>
  );
}
