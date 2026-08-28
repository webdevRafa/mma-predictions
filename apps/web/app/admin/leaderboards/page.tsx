import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/admin/auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Admin leaderboards",
  robots: { index: false, follow: false },
};

export default async function AdminLeaderboardsPage() {
  await requireAdminPage("/admin/leaderboards");
  const snapshot = await getFirebaseAdmin()
    .firestore.collection("leaderboards")
    .limit(100)
    .get();
  return (
    <main id="main-content">
      <h1 className="font-display text-5xl font-extrabold sm:text-7xl">
        LEADERBOARDS
      </h1>
      <p className="mt-3 text-sm text-fl-text-muted">
        Server-built board status. Result corrections enqueue the existing
        idempotent regrade and board rebuild path.
      </p>
      <Card className="mt-8 divide-y divide-fl-border">
        {snapshot.docs.map((document) => (
          <div
            className="flex items-center justify-between gap-4 px-5 py-4"
            key={document.id}
          >
            <div>
              <p className="font-bold">
                {String(document.get("label") ?? document.id)}
              </p>
              <p className="mt-1 font-mono text-[10px] text-fl-text-dim">
                {document.id}
              </p>
            </div>
            <Badge>{String(document.get("type") ?? "board")}</Badge>
          </div>
        ))}
        {snapshot.empty ? (
          <p className="p-5 text-sm text-fl-text-muted">
            No server-built boards in this environment.
          </p>
        ) : null}
      </Card>
    </main>
  );
}
