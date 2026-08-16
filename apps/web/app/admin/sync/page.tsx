import type { Metadata } from "next";
import { Timestamp } from "firebase-admin/firestore";
import { Activity, Archive, DatabaseZap, ShieldAlert } from "lucide-react";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { requireOnboardedSession } from "@/lib/auth/session";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Provider sync console",
  robots: { index: false, follow: false },
};

type ConsoleRecord = Record<string, unknown> & { id: string };

function dateLabel(value: unknown) {
  if (value instanceof Timestamp) return value.toDate().toLocaleString();
  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString();
  }
  return "Pending";
}

function textValue(value: unknown, fallback = "—") {
  return typeof value === "string" && value ? value : fallback;
}

async function loadConsoleData() {
  const firestore = getFirebaseAdmin().firestore;
  const [runs, errors, manifests] = await Promise.all([
    firestore
      .collection("syncRuns")
      .orderBy("startedAt", "desc")
      .limit(20)
      .get(),
    firestore
      .collection("providerErrors")
      .orderBy("createdAt", "desc")
      .limit(10)
      .get(),
    firestore
      .collection("rawManifests")
      .orderBy("createdAt", "desc")
      .limit(1)
      .get(),
  ]);
  const values = (documents: typeof runs.docs) =>
    documents.map((document) => ({
      id: document.id,
      ...document.data(),
    })) as ConsoleRecord[];
  return {
    runs: values(runs.docs),
    errors: values(errors.docs),
    latestManifest: values(manifests.docs)[0],
  };
}

export default async function SyncConsolePage() {
  const session = await requireOnboardedSession("/admin/sync");
  if (!session.roles.includes("admin")) redirect("/account/restricted");
  const data = await loadConsoleData();
  const configured =
    process.env.MMA_PROVIDER === "sportsdataio" &&
    process.env.SPORTSDATAIO_COMMERCIAL_RIGHTS_CONFIRMED === "true" &&
    Boolean(process.env.SPORTSDATAIO_MMA_KEY);

  return (
    <main className="shell py-10 sm:py-14" id="main-content">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Admin · data operations</p>
          <h1 className="mt-2 font-display text-5xl font-extrabold sm:text-7xl">
            SYNC CONSOLE
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-fl-text-muted">
            Provider runs, archived source manifests, and retryable ingestion
            errors. API keys and raw payloads never appear in this console.
          </p>
        </div>
        <Badge tone={configured ? "success" : "warning"}>
          {configured ? "Licensed sync enabled" : "Provider disabled"}
        </Badge>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <Activity aria-hidden="true" className="text-fl-accent" size={20} />
          <p className="mt-4 font-display text-3xl font-bold">
            {data.runs.length}
          </p>
          <p className="mt-1 text-xs text-fl-text-muted">Recent event runs</p>
        </Card>
        <Card className="p-5">
          <ShieldAlert
            aria-hidden="true"
            className="text-fl-warning"
            size={20}
          />
          <p className="mt-4 font-display text-3xl font-bold">
            {data.errors.length}
          </p>
          <p className="mt-1 text-xs text-fl-text-muted">
            Recent provider errors
          </p>
        </Card>
        <Card className="p-5">
          <Archive aria-hidden="true" className="text-fl-info" size={20} />
          <p className="mt-4 truncate font-mono text-xs font-bold">
            {data.latestManifest
              ? textValue(data.latestManifest.archiveStatus)
              : "No manifest"}
          </p>
          <p className="mt-2 text-xs text-fl-text-muted">
            Latest raw archive status
          </p>
        </Card>
      </section>

      <Card className="mt-6 overflow-hidden">
        <CardHeader
          eyebrow="Last 20"
          title="Event sync runs"
          description="Dry runs return a diff without writing canonical event data. Production runs are checksum-idempotent."
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="bg-fl-surface-2 font-mono text-[10px] tracking-[.08em] text-fl-text-dim uppercase">
              <tr>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Provider event</th>
                <th className="px-5 py-3">Canonical event</th>
                <th className="px-5 py-3">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-fl-border">
              {data.runs.map((run) => (
                <tr key={run.id}>
                  <td className="px-5 py-4">
                    <Badge
                      tone={run.status === "complete" ? "success" : "warning"}
                    >
                      {textValue(run.status, "unknown")}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs">
                    {textValue(run.externalEventId)}
                  </td>
                  <td className="px-5 py-4 font-mono text-xs">
                    {textValue(run.eventId)}
                  </td>
                  <td className="px-5 py-4 text-xs text-fl-text-muted">
                    {dateLabel(run.startedAt)}
                  </td>
                </tr>
              ))}
              {data.runs.length === 0 ? (
                <tr>
                  <td className="px-5 py-6 text-fl-text-muted" colSpan={4}>
                    No provider sync has run in this environment.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader
          eyebrow="Retry queue"
          title="Provider errors"
          description="Task failures are recorded before Cloud Tasks applies its bounded exponential retry policy."
        />
        <div className="divide-y divide-fl-border">
          {data.errors.map((error) => (
            <div
              className="grid gap-2 px-5 py-4 sm:grid-cols-[170px_1fr_auto]"
              key={error.id}
            >
              <span className="font-mono text-xs text-fl-text-dim">
                {textValue(error.operation, "event_sync")}
              </span>
              <span className="text-sm">{textValue(error.message)}</span>
              <span className="text-xs text-fl-text-muted">
                {dateLabel(error.createdAt)}
              </span>
            </div>
          ))}
          {data.errors.length === 0 ? (
            <div className="flex items-center gap-3 px-5 py-6 text-sm text-fl-text-muted">
              <DatabaseZap aria-hidden="true" size={18} /> No provider errors
              recorded.
            </div>
          ) : null}
        </div>
      </Card>
    </main>
  );
}
