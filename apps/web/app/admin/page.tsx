import type { Metadata } from "next";
import {
  AlertTriangle,
  CalendarClock,
  DatabaseZap,
  Flag,
  Shield,
  Swords,
  Users,
} from "lucide-react";
import Link from "next/link";

import { Card, CardHeader } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/admin/auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { formatEventDateWithZone } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Admin dashboard",
  robots: { index: false, follow: false },
};

async function dashboard() {
  const firestore = getFirebaseAdmin().firestore;
  const [events, fights, reports, errors, jobs, flags, eventDocuments] =
    await Promise.all([
      firestore.collection("events").count().get(),
      firestore.collection("fights").count().get(),
      firestore
        .collection("reports")
        .where("status", "==", "open")
        .count()
        .get(),
      firestore
        .collection("providerErrors")
        .orderBy("createdAt", "desc")
        .limit(10)
        .get(),
      firestore
        .collection("adminJobs")
        .where("status", "in", ["queued", "processing", "failed"])
        .limit(25)
        .get(),
      firestore.collection("featureFlags").doc("current").get(),
      firestore
        .collection("events")
        .orderBy("startsAt", "desc")
        .limit(50)
        .get(),
    ]);
  const activeEvents = eventDocuments.docs
    .filter((document) =>
      ["scheduled", "live"].includes(String(document.get("status"))),
    )
    .sort(
      (left, right) =>
        Date.parse(String(left.get("startsAt"))) -
        Date.parse(String(right.get("startsAt"))),
    )
    .slice(0, 6);
  const eventOperations = await Promise.all(
    activeEvents.map(async (event) => {
      const eventFights = await firestore
        .collection("fights")
        .where("eventId", "==", event.id)
        .get();
      return {
        id: event.id,
        name: String(event.get("name") ?? event.id),
        status: String(event.get("status") ?? "unknown"),
        startsAt: String(event.get("startsAt") ?? ""),
        venueTimezone: String(event.get("venueTimezone") ?? "UTC"),
        total: eventFights.size,
        open: eventFights.docs.filter(
          (fight) => fight.get("predictionStatus") === "open",
        ).length,
        locked: eventFights.docs.filter(
          (fight) => fight.get("predictionStatus") === "locked",
        ).length,
      };
    }),
  );
  return {
    events: events.data().count,
    fights: fights.data().count,
    openReports: reports.data().count,
    providerErrors: errors.size,
    adminJobs: jobs.size,
    eventOperations,
    emergencyFlags: [
      "siteReadOnly",
      "chatPostingEnabled",
      "predictionsEnabled",
    ].filter((key) =>
      key === "siteReadOnly"
        ? flags.get(key) === true
        : flags.get(key) === false,
    ),
  };
}

export default async function AdminDashboardPage() {
  await requireAdminPage("/admin");
  const data = await dashboard();
  const cards = [
    {
      label: "Canonical events",
      value: data.events,
      href: "/admin/events",
      icon: Swords,
    },
    {
      label: "Canonical fights",
      value: data.fights,
      href: "/admin/events",
      icon: DatabaseZap,
    },
    {
      label: "Open reports",
      value: data.openReports,
      href: "/admin/moderation",
      icon: Shield,
    },
    {
      label: "Recent provider errors",
      value: data.providerErrors,
      href: "/admin/data-sync",
      icon: AlertTriangle,
    },
    {
      label: "Pending/failed jobs",
      value: data.adminJobs,
      href: "/admin/audit",
      icon: Users,
    },
    {
      label: "Emergency flags",
      value: data.emergencyFlags.length,
      href: "/admin/feature-flags",
      icon: Flag,
    },
  ];
  return (
    <main id="main-content">
      <h1 className="font-display text-5xl font-extrabold sm:text-7xl">
        ADMIN DASHBOARD
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-fl-text-muted">
        Live operational state for UFC data, moderation, emergency controls, and
        audited background work.
      </p>
      <section className="mt-8" aria-labelledby="live-event-operations">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Manual live controls</p>
            <h2
              className="mt-2 font-display text-3xl font-extrabold"
              id="live-event-operations"
            >
              Upcoming and live events
            </h2>
          </div>
          <Link
            className="focus-ring rounded-lg border border-fl-border px-3 py-2 text-xs font-bold text-fl-text-muted"
            href="/admin/events"
          >
            View all events
          </Link>
        </div>
        {data.eventOperations.length > 0 ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {data.eventOperations.map((event) => (
              <Link
                className="focus-ring rounded-2xl"
                href={`/admin/events/${event.id}`}
                key={event.id}
              >
                <Card className="h-full p-5 transition hover:border-fl-accent/50">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold">{event.name}</p>
                      <p className="mt-2 text-xs text-fl-text-muted">
                        {event.startsAt
                          ? `Main card · ${formatEventDateWithZone(
                              event.startsAt,
                              event.venueTimezone,
                            )}`
                          : "Start time unavailable"}
                      </p>
                    </div>
                    <CalendarClock
                      aria-hidden="true"
                      className="shrink-0 text-fl-accent"
                      size={20}
                    />
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-3 border-t border-fl-border pt-4 text-center">
                    {[
                      ["Bouts", event.total],
                      ["Open", event.open],
                      ["Locked", event.locked],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="font-display text-2xl font-bold">
                          {value}
                        </p>
                        <p className="mt-1 text-[10px] text-fl-text-dim uppercase">
                          {label}
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="mt-4 p-5 text-sm text-fl-text-muted">
            No scheduled or live events are loaded yet.
          </Card>
        )}
      </section>
      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ label, value, href, icon: Icon }) => (
          <Link className="focus-ring rounded-2xl" href={href} key={label}>
            <Card className="h-full p-5 transition hover:border-fl-accent/50">
              <Icon aria-hidden="true" className="text-fl-accent" size={20} />
              <p className="mt-5 font-display text-4xl font-bold">{value}</p>
              <p className="mt-1 text-xs text-fl-text-muted">{label}</p>
            </Card>
          </Link>
        ))}
      </section>
      <Card className="mt-6">
        <CardHeader eyebrow="Current state" title="Emergency controls" />
        <div className="p-5 text-sm text-fl-text-muted">
          {data.emergencyFlags.length > 0
            ? `Attention required: ${data.emergencyFlags.join(", ")}`
            : "Normal operating state. Read-only mode is off and core participation controls are enabled."}
        </div>
      </Card>
    </main>
  );
}
