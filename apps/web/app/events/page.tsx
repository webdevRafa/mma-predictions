import type { Metadata } from "next";
import { ArrowRight, CalendarDays, MapPin, UsersRound } from "lucide-react";
import Link from "next/link";

import { LiveStatusFragment } from "@/components/live/live-status-fragment";
import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { Card } from "@/components/ui/card";
import { listPublicEvents } from "@/lib/data/public";
import { formatCompactDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "UFC Events",
  description:
    "Browse upcoming and completed UFC cards, community prediction totals, and every FightLobby matchup room.",
  alternates: { canonical: "/events" },
  openGraph: {
    title: "UFC Events and Fight Cards",
    description:
      "Find the next UFC card, make predictions, and enter every matchup lobby.",
    url: "/events",
  },
  twitter: { card: "summary_large_image" },
};

export default async function EventsPage() {
  const events = (await listPublicEvents()).filter(
    (event) => event.status !== "draft" && event.dataQuality !== "blocked",
  );

  return (
    <main className="shell py-10 sm:py-14" id="main-content">
      <Breadcrumbs
        items={[{ label: "Home", href: "/" }, { label: "Events" }]}
      />
      <header className="mt-8 max-w-3xl">
        <h1 className="font-display text-5xl leading-[.9] font-extrabold sm:text-7xl">
          EVENT COMMAND CENTER
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-fl-text-muted">
          Upcoming cards, verified matchup pages, and every community lobby in
          one place.
        </p>
      </header>

      {events.length > 0 ? (
        <section
          aria-label="UFC events"
          className="mt-10 grid gap-5 lg:grid-cols-2"
        >
          {events.map((event) => {
            const location = [
              event.venue?.name,
              event.venue?.city,
              event.venue?.region,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <Card className="group overflow-hidden" key={event.id}>
                <div className="arena-grid border-b border-fl-border p-5 sm:p-6">
                  <div className="flex justify-end">
                    <LiveStatusFragment
                      collection="events"
                      id={event.id}
                      initialStatus={event.status}
                    />
                  </div>
                  <h2 className="mt-6 max-w-xl font-display text-4xl leading-[.92] font-extrabold sm:text-5xl">
                    {event.name}
                  </h2>
                </div>
                <div className="grid grid-cols-2 gap-px bg-fl-border">
                  <div className="bg-fl-surface-1 p-4">
                    <span className="eyebrow inline-flex items-center gap-2">
                      <CalendarDays aria-hidden="true" size={13} /> Date
                    </span>
                    <p className="mt-2 text-sm font-semibold">
                      {formatCompactDate(event.startsAt)}
                    </p>
                  </div>
                  <div className="bg-fl-surface-1 p-4">
                    <span className="eyebrow inline-flex items-center gap-2">
                      <UsersRound aria-hidden="true" size={13} /> Community
                    </span>
                    <p className="mt-2 text-sm font-semibold">
                      {event.predictionSummary.totalPredictions.toLocaleString()}{" "}
                      picks
                    </p>
                  </div>
                </div>
                <div className="p-5 sm:p-6">
                  <p className="flex items-start gap-2 text-sm text-fl-text-muted">
                    <MapPin
                      aria-hidden="true"
                      className="mt-0.5 shrink-0"
                      size={15}
                    />
                    {location || "Venue to be confirmed"}
                  </p>
                  <div className="mt-5 flex items-center justify-between gap-4">
                    <span className="font-mono text-[10px] tracking-[.08em] text-fl-text-dim uppercase">
                      {event.fightCount} fights · {event.cardSegments.mainCard}{" "}
                      main card
                    </span>
                    <Link
                      className="focus-ring inline-flex items-center gap-2 rounded-lg text-sm font-bold text-fl-accent transition group-hover:text-fl-accent-strong"
                      href={`/events/${event.slug}`}
                    >
                      Open event <ArrowRight aria-hidden="true" size={15} />
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </section>
      ) : (
        <Card className="mt-10 p-8">
          <h2 className="font-display text-3xl font-bold">
            No verified events yet
          </h2>
          <p className="mt-2 text-sm text-fl-text-muted">
            The next UFC card will appear after its event data passes
            validation.
          </p>
        </Card>
      )}
    </main>
  );
}
