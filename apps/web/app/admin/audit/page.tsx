import type { Metadata } from "next";
import { Timestamp } from "firebase-admin/firestore";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Admin audit log",
  robots: { index: false, follow: false },
};

function date(value: unknown) {
  return value instanceof Timestamp
    ? value.toDate().toLocaleString()
    : "Pending";
}

export default async function AuditPage() {
  const snapshot = await getFirebaseAdmin()
    .firestore.collection("auditLogs")
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();
  return (
    <main id="main-content">
      <h1 className="font-display text-5xl font-extrabold sm:text-7xl">
        AUDIT LOG
      </h1>
      <p className="mt-3 text-sm text-fl-text-muted">
        Latest 100 server-authored administrative and system records.
      </p>
      <Card className="mt-8 overflow-hidden">
        <div className="divide-y divide-fl-border">
          {snapshot.docs.map((document) => (
            <details className="group px-5 py-4" key={document.id}>
              <summary className="focus-ring flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 rounded">
                <div className="flex items-center gap-3">
                  <Badge
                    tone={
                      document.get("category") === "admin"
                        ? "warning"
                        : "neutral"
                    }
                  >
                    {String(
                      document.get("category") ??
                        document.get("type") ??
                        "system",
                    )}
                  </Badge>
                  <span className="text-sm font-bold">
                    {String(
                      document.get("action") ??
                        document.get("type") ??
                        "activity",
                    )}
                  </span>
                </div>
                <span className="text-xs text-fl-text-dim">
                  {date(document.get("createdAt"))}
                </span>
              </summary>
              <div className="mt-4 grid gap-2 rounded-lg bg-fl-bg p-4 font-mono text-[11px] text-fl-text-muted sm:grid-cols-2">
                <span>
                  Actor: {String(document.get("actorUid") ?? "system")}
                </span>
                <span>Target: {String(document.get("targetId") ?? "—")}</span>
                <span className="sm:col-span-2">
                  Reason:{" "}
                  {String(document.get("reason") ?? "Automated system action")}
                </span>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap sm:col-span-2">
                  {JSON.stringify(document.data(), null, 2)}
                </pre>
              </div>
            </details>
          ))}
        </div>
      </Card>
    </main>
  );
}
