import type { Metadata } from "next";
import {
  BellRing,
  ExternalLink,
  MessageCircle,
  ShieldCheck,
  TimerReset,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/admin/auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Cost controls",
  robots: { index: false, follow: false },
};

function numeric(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

async function loadActivity() {
  const firestore = getFirebaseAdmin().firestore;
  const [events, queuedAggregateJobs] = await Promise.all([
    firestore.collection("events").orderBy("startsAt", "desc").limit(6).get(),
    firestore.collection("predictionAggregateJobs").count().get(),
  ]);

  const eventActivity = await Promise.all(
    events.docs.map(async (event) => {
      const [fights, rooms] = await Promise.all([
        firestore.collection("fights").where("eventId", "==", event.id).get(),
        firestore
          .collection("chatRooms")
          .where("eventId", "==", event.id)
          .get(),
      ]);
      const discussionReferences = fights.docs.map((fight) =>
        firestore.collection("fightDiscussions").doc(fight.id),
      );
      const discussions =
        discussionReferences.length > 0
          ? await firestore.getAll(...discussionReferences)
          : [];

      return {
        id: event.id,
        name: String(event.get("name") ?? event.id),
        status: String(event.get("status") ?? "unknown"),
        picks: fights.docs.reduce(
          (total, fight) =>
            total + numeric(record(fight.get("predictionSummary")).total),
          0,
        ),
        chatMessages: rooms.docs.reduce(
          (total, room) => total + numeric(room.get("messageCount")),
          0,
        ),
        discussionItems: discussions.reduce(
          (total, discussion) =>
            total +
            numeric(discussion.get("postCount")) +
            numeric(discussion.get("replyCount")),
          0,
        ),
        liveRooms: rooms.docs.filter((room) =>
          ["open", "slow_mode"].includes(String(room.get("status"))),
        ).length,
        retainedRooms: rooms.docs.filter(
          (room) => room.get("retentionExpiresAt") !== undefined,
        ).length,
        purgedRooms: rooms.docs.filter(
          (room) => room.get("messagesPurgedAt") !== undefined,
        ).length,
      };
    }),
  );

  return {
    eventActivity,
    queuedAggregateJobs: queuedAggregateJobs.data().count,
  };
}

function ProviderLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      className="focus-ring inline-flex items-center gap-2 rounded-lg border border-fl-border bg-fl-surface-2 px-3 py-2 text-xs font-bold text-fl-text hover:border-fl-accent/50"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {children} <ExternalLink aria-hidden="true" size={13} />
    </a>
  );
}

export default async function AdminCostsPage() {
  await requireAdminPage("/admin/costs");
  const data = await loadActivity();
  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ??
    process.env.VITE_FIREBASE_PROJECT_ID ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
    "mma-cortex";
  const appCheckConfigured = Boolean(
    process.env.VITE_FIREBASE_APP_CHECK_SITE_KEY ??
    process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY,
  );

  return (
    <main id="main-content">
      <p className="eyebrow">Cost and capacity</p>
      <h1 className="mt-2 font-display text-5xl font-extrabold sm:text-7xl">
        USAGE GUARDRAILS
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-fl-text-muted">
        Logical activity counters for fast event-day checks. These are product
        counters—not a substitute for the provider invoices linked below.
      </p>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "App Check",
            value: appCheckConfigured ? "Configured" : "Needs attention",
            icon: ShieldCheck,
          },
          {
            label: "Chat delivery",
            value: "Incremental",
            icon: MessageCircle,
          },
          {
            label: "Chat retention",
            value: "30 days",
            icon: TimerReset,
          },
          {
            label: "Aggregate queue",
            value: data.queuedAggregateJobs.toLocaleString(),
            icon: TrendingUp,
          },
        ].map(({ label, value, icon: Icon }) => (
          <Card className="p-5" key={label}>
            <Icon aria-hidden="true" className="text-fl-accent" size={19} />
            <p className="mt-5 font-display text-2xl font-bold">{value}</p>
            <p className="mt-1 text-xs text-fl-text-muted">{label}</p>
          </Card>
        ))}
      </section>

      <Card className="mt-6 overflow-hidden">
        <CardHeader
          eyebrow="Recent events"
          title="Activity by card"
          description="Use sudden changes here as a signal to inspect the matching Firebase product usage before the next card."
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead className="bg-fl-surface-2 font-mono text-[10px] tracking-[.08em] text-fl-text-dim uppercase">
              <tr>
                <th className="px-5 py-3">Event</th>
                <th className="px-5 py-3">Picks</th>
                <th className="px-5 py-3">Chat messages</th>
                <th className="px-5 py-3">Posts + replies</th>
                <th className="px-5 py-3">Rooms</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-fl-border">
              {data.eventActivity.map((event) => (
                <tr key={event.id}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <p className="font-bold">{event.name}</p>
                      <Badge>{event.status}</Badge>
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-fl-text-dim">
                      {event.id}
                    </p>
                  </td>
                  <td className="px-5 py-4 font-mono">{event.picks}</td>
                  <td className="px-5 py-4 font-mono">{event.chatMessages}</td>
                  <td className="px-5 py-4 font-mono">
                    {event.discussionItems}
                  </td>
                  <td className="px-5 py-4 text-xs text-fl-text-muted">
                    {event.liveRooms} live · {event.retainedRooms} awaiting
                    purge · {event.purgedRooms} purged
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader
          eyebrow="Provider controls"
          title="Billing alerts and hard limits"
          description="These controls live at the account level and cannot safely be changed by application code. Configure them once, then verify them before every event."
        />
        <div className="grid gap-5 p-5 lg:grid-cols-2 lg:p-6">
          <div className="rounded-xl border border-fl-border bg-fl-surface-2 p-4">
            <BellRing aria-hidden="true" className="text-fl-accent" size={19} />
            <h2 className="mt-4 font-bold">Google Cloud / Firebase</h2>
            <p className="mt-2 text-sm leading-6 text-fl-text-muted">
              Create actual-cost alerts at $10, $25, $50, and $100. During an
              event, watch Functions, Firestore, Realtime Database, App Check,
              and Storage usage for project {projectId}.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <ProviderLink
                href={`https://console.firebase.google.com/project/${projectId}/usage`}
              >
                Firebase usage
              </ProviderLink>
              <ProviderLink
                href={`https://console.cloud.google.com/billing/budgets?project=${projectId}`}
              >
                Billing budgets
              </ProviderLink>
            </div>
          </div>
          <div className="rounded-xl border border-fl-border bg-fl-surface-2 p-4">
            <ShieldCheck
              aria-hidden="true"
              className="text-fl-accent"
              size={19}
            />
            <h2 className="mt-4 font-bold">Vercel</h2>
            <p className="mt-2 text-sm leading-6 text-fl-text-muted">
              Enable Spend Management notifications and choose a hard limit or
              pause action that matches the amount you can safely absorb. Keep
              function and bandwidth alerts routed to an account you monitor.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <ProviderLink href="https://vercel.com/dashboard">
                Vercel dashboard
              </ProviderLink>
              <ProviderLink href="https://vercel.com/docs/pricing/spend-management">
                Spend Management guide
              </ProviderLink>
            </div>
          </div>
        </div>
      </Card>
    </main>
  );
}
