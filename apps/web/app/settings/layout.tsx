import type { Metadata } from "next";

import { SettingsWorkspace } from "@/features/settings/settings-workspace";
import { requireOnboardedSession } from "@/lib/auth/session";
import { getPrivateAccountView } from "@/lib/auth/user-records";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

export default async function SettingsLayout() {
  const session = await requireOnboardedSession("/settings");
  const { firestore } = getFirebaseAdmin();
  const [account, blocks] = await Promise.all([
    getPrivateAccountView(session.uid),
    firestore
      .collection("users")
      .doc(session.uid)
      .collection("blocks")
      .limit(500)
      .get(),
  ]);
  const blockedMembers = blocks.docs.map((document) => {
    const handle: unknown = document.get("handle");
    return {
      uid: document.id,
      ...(typeof handle === "string" ? { handle } : {}),
    };
  });

  return (
    <SettingsWorkspace
      initialAccount={account}
      initialBlockedMembers={blockedMembers}
    />
  );
}
