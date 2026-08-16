import { Card, CardHeader } from "@/components/ui/card";
import { BlockedMemberList } from "@/features/chat/blocked-member-list";
import { requireOnboardedSession } from "@/lib/auth/session";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export default async function BlockedUsersPage() {
  const session = await requireOnboardedSession("/settings/blocked-users");
  const snapshot = await getFirebaseAdmin()
    .firestore.collection("users")
    .doc(session.uid)
    .collection("blocks")
    .limit(500)
    .get();
  const members = snapshot.docs.map((document) => {
    const handle: unknown = document.get("handle");
    return {
      uid: document.id,
      ...(typeof handle === "string" ? { handle } : {}),
    };
  });
  return (
    <Card>
      <CardHeader eyebrow="Community controls" title="Blocked users" />
      <BlockedMemberList initialMembers={members} />
    </Card>
  );
}
