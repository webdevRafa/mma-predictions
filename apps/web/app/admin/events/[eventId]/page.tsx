import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AdminNotice,
  AdminSafetyFields,
  ProviderDiffTable,
  adminInputClass,
  adminLabelClass,
} from "@/components/admin/admin-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { providerDiff } from "@/lib/admin/diff";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Edit event",
  robots: { index: false, follow: false },
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export default async function AdminEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ adminSuccess?: string; adminError?: string }>;
}) {
  const { eventId } = await params;
  const firestore = getFirebaseAdmin().firestore;
  const [eventSnapshot, fights, stateSnapshot] = await Promise.all([
    firestore.collection("events").doc(eventId).get(),
    firestore
      .collection("fights")
      .where("eventId", "==", eventId)
      .orderBy("boutOrder")
      .get(),
    firestore.collection("providerEntityState").doc(`event_${eventId}`).get(),
  ]);
  if (!eventSnapshot.exists) notFound();
  const event = eventSnapshot.data()!;
  const editorial = record(event.editorial);
  const query = await searchParams;
  const returnTo = `/admin/events/${eventId}`;
  const diff = providerDiff(event, stateSnapshot.data());
  return (
    <main id="main-content">
      <AdminNotice
        error={query.adminError}
        success={query.adminSuccess ? "Audited event change saved." : undefined}
      />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Event editor</p>
          <h1 className="mt-2 font-display text-4xl font-extrabold sm:text-6xl">
            {String(event.name)}
          </h1>
          <p className="mt-2 font-mono text-xs text-fl-text-dim">{eventId}</p>
        </div>
        <Badge>{String(event.status)}</Badge>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_.9fr]">
        <Card>
          <CardHeader
            eyebrow="Persistent override"
            title="Event fields"
            description="Saved values remain higher priority than future provider syncs."
          />
          <form action="/api/admin/actions" className="p-5" method="post">
            <input name="action" type="hidden" value="update_event" />
            <input name="eventId" type="hidden" value={eventId} />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={adminLabelClass}>
                Name
                <input
                  className={adminInputClass}
                  defaultValue={String(event.name ?? "")}
                  name="name"
                />
              </label>
              <label className={adminLabelClass}>
                Short name
                <input
                  className={adminInputClass}
                  defaultValue={String(event.shortName ?? "")}
                  name="shortName"
                />
              </label>
              <label className={adminLabelClass}>
                Status
                <select
                  className={adminInputClass}
                  defaultValue={String(event.status)}
                  name="status"
                >
                  {[
                    "draft",
                    "scheduled",
                    "live",
                    "completed",
                    "canceled",
                    "postponed",
                  ].map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label className={adminLabelClass}>
                Start (ISO with offset)
                <input
                  className={adminInputClass}
                  defaultValue={String(event.startsAt ?? "")}
                  name="startsAt"
                />
              </label>
              <label className={adminLabelClass}>
                Venue timezone
                <input
                  className={adminInputClass}
                  defaultValue={String(
                    event.venueTimezone ?? "America/New_York",
                  )}
                  name="venueTimezone"
                />
              </label>
              <label className={adminLabelClass}>
                Data quality
                <select
                  className={adminInputClass}
                  defaultValue={String(event.dataQuality ?? "partial")}
                  name="dataQuality"
                >
                  {["verified", "complete", "partial", "blocked"].map(
                    (quality) => (
                      <option key={quality}>{quality}</option>
                    ),
                  )}
                </select>
              </label>
              <label className={adminLabelClass}>
                Monetization
                <select
                  className={adminInputClass}
                  defaultValue={String(event.monetizationEligible === true)}
                  name="monetizationEligible"
                >
                  <option value="false">Disabled</option>
                  <option value="true">Eligible</option>
                </select>
              </label>
              <label className={adminLabelClass}>
                Editorial status
                <select
                  className={adminInputClass}
                  defaultValue={text(editorial.status, "missing")}
                  name="editorialStatus"
                >
                  {["missing", "draft", "reviewed", "published"].map(
                    (status) => (
                      <option key={status}>{status}</option>
                    ),
                  )}
                </select>
              </label>
              <label className={`${adminLabelClass} sm:col-span-2`}>
                Editorial summary
                <textarea
                  className={adminInputClass}
                  defaultValue={text(editorial.summary)}
                  maxLength={800}
                  minLength={20}
                  name="editorialSummary"
                  placeholder="Original Fight Lobby event context and stakes."
                  rows={5}
                />
              </label>
            </div>
            <AdminSafetyFields
              confirmation={`UPDATE ${eventId}`}
              returnTo={returnTo}
            />
          </form>
        </Card>

        <Card>
          <CardHeader
            eyebrow="Source comparison"
            title="Provider diff"
            description="External identifiers remain private; this view shows canonical field differences only."
          />
          <ProviderDiffTable rows={diff} />
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          eyebrow={`${fights.size} bouts`}
          title="Card order"
          description="Put one fight ID per line, in display order. Every current fight must be included exactly once."
        />
        <form action="/api/admin/actions" className="p-5" method="post">
          <input name="action" type="hidden" value="reorder_card" />
          <input name="eventId" type="hidden" value={eventId} />
          <textarea
            className={`${adminInputClass} font-mono`}
            defaultValue={fights.docs.map((document) => document.id).join("\n")}
            name="fightIds"
            rows={Math.max(5, fights.size)}
          />
          <AdminSafetyFields
            confirmation={`REORDER ${eventId}`}
            returnTo={returnTo}
            submitLabel="Save card order"
          />
        </form>
        <div className="divide-y divide-fl-border border-t border-fl-border">
          {fights.docs.map((document) => (
            <div
              className="flex items-center justify-between gap-4 px-5 py-4"
              key={document.id}
            >
              <div>
                <p className="font-bold">
                  {String(document.get("fighterA.name.full"))} vs{" "}
                  {String(document.get("fighterB.name.full"))}
                </p>
                <p className="mt-1 font-mono text-[10px] text-fl-text-dim">
                  #{String(document.get("boutOrder"))} · {document.id}
                </p>
              </div>
              <Link
                className="focus-ring rounded text-xs font-bold text-fl-accent"
                href={`/admin/fights/${document.id}`}
              >
                Edit fight
              </Link>
            </div>
          ))}
        </div>
      </Card>
    </main>
  );
}
