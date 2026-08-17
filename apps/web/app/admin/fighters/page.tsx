import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/admin/auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Admin fighters",
  robots: { index: false, follow: false },
};

export default async function AdminFightersPage() {
  await requireAdminPage("/admin/fighters");
  const snapshot = await getFirebaseAdmin()
    .firestore.collection("fighters")
    .orderBy("name.normalized")
    .limit(250)
    .get();
  return (
    <main id="main-content">
      <h1 className="font-display text-5xl font-extrabold sm:text-7xl">
        FIGHTERS
      </h1>
      <p className="mt-3 text-sm text-fl-text-muted">
        Identity review, profile corrections, and provider comparisons.
      </p>
      <Card className="mt-8 overflow-hidden">
        <div className="divide-y divide-fl-border">
          {snapshot.docs.map((document) => (
            <Link
              className="focus-ring flex items-center justify-between gap-5 px-5 py-4 hover:bg-fl-surface-2"
              href={`/admin/fighters/${document.id}`}
              key={document.id}
            >
              <div>
                <p className="font-bold">
                  {String(document.get("name.full") ?? document.id)}
                </p>
                <p className="mt-1 font-mono text-[10px] text-fl-text-dim">
                  {document.id} ·{" "}
                  {String(document.get("currentWeightClass") ?? "Unassigned")}
                </p>
              </div>
              <Badge>{String(document.get("dataQuality") ?? "partial")}</Badge>
            </Link>
          ))}
        </div>
      </Card>
    </main>
  );
}
