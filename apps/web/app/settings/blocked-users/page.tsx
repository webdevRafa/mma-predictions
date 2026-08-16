import { UserRoundX } from "lucide-react";

import { Card, CardHeader } from "@/components/ui/card";
import { requireOnboardedSession } from "@/lib/auth/session";

export default async function BlockedUsersPage() {
  await requireOnboardedSession("/settings/blocked-users");
  return (
    <Card>
      <CardHeader eyebrow="Community controls" title="Blocked users" />
      <div className="p-6 text-center">
        <UserRoundX
          aria-hidden="true"
          className="mx-auto text-fl-text-dim"
          size={28}
        />
        <p className="mt-4 font-semibold">No blocked users</p>
        <p className="mt-2 text-sm text-fl-text-muted">
          People you block from a lobby will appear here when chat launches.
        </p>
      </div>
    </Card>
  );
}
