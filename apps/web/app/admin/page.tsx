import type { Metadata } from "next";
import {
  AlertTriangle,
  DatabaseZap,
  Flag,
  Shield,
  Swords,
  Users,
} from "lucide-react";
import Link from "next/link";

import { Card, CardHeader } from "@/components/ui/card";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Admin dashboard",
  robots: { index: false, follow: false },
};

async function dashboard() {
  const firestore = getFirebaseAdmin().firestore;
  const [events, fights, reports, errors, jobs, flags] = await Promise.all([
    firestore.collection("events").count().get(),
    firestore.collection("fights").count().get(),
    firestore.collection("reports").where("status", "==", "open").count().get(),
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
  ]);
  return {
    events: events.data().count,
    fights: fights.data().count,
    openReports: reports.data().count,
    providerErrors: errors.size,
    adminJobs: jobs.size,
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
