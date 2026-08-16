import type { Metadata } from "next";
import { ExternalLink, Pencil } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Admin events",
  robots: { index: false, follow: false },
};

export default async function AdminEventsPage() {
  const snapshot = await getFirebaseAdmin()
    .firestore.collection("events")
    .orderBy("startsAt", "desc")
    .limit(100)
    .get();
  return (
    <main id="main-content">
      <h1 className="font-display text-5xl font-extrabold sm:text-7xl">
        EVENTS
      </h1>
      <p className="mt-3 text-sm text-fl-text-muted">
        Provider-backed canonical cards and persistent editorial overrides.
      </p>
      <Card className="mt-8 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="bg-fl-surface-2 font-mono text-[10px] tracking-[.08em] text-fl-text-dim uppercase">
              <tr>
                <th className="px-5 py-3">Event</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Starts</th>
                <th className="px-5 py-3">Fights</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-fl-border">
              {snapshot.docs.map((document) => (
                <tr key={document.id}>
                  <td className="px-5 py-4">
                    <p className="font-bold">
                      {String(document.get("name") ?? document.id)}
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-fl-text-dim">
                      {document.id}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <Badge>{String(document.get("status") ?? "unknown")}</Badge>
                  </td>
                  <td className="px-5 py-4 text-xs text-fl-text-muted">
                    {String(document.get("startsAt") ?? "—")}
                  </td>
                  <td className="px-5 py-4">
                    {String(document.get("fightCount") ?? 0)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-3">
                      <Link
                        className="focus-ring inline-flex items-center gap-1 rounded text-xs font-bold text-fl-accent"
                        href={`/admin/events/${document.id}`}
                      >
                        <Pencil aria-hidden="true" size={13} /> Edit
                      </Link>
                      <Link
                        className="focus-ring inline-flex items-center gap-1 rounded text-xs text-fl-text-muted"
                        href={`/events/${String(document.get("slug") ?? "")}`}
                      >
                        <ExternalLink aria-hidden="true" size={13} /> Public
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );
}
