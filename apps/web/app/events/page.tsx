import type { Event } from "@fightlobby/domain";
import type { Metadata } from "next";
import { ArrowRight, CalendarDays, MapPin, UsersRound } from "lucide-react";
import Link from "next/link";

import { LiveStatusFragment } from "@/components/live/live-status-fragment";
import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { Card } from "@/components/ui/card";
import { listPublicEvents } from "@/lib/data/public";
import { sortEventsNewestFirst } from "@/lib/events/directory";
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

const desktopGrid =
  "grid-cols-[minmax(0,2.2fr)_minmax(0,1.35fr)_minmax(8rem,.8fr)_minmax(7.5rem,.7fr)_7.5rem]";

function venueDetails(event: Event) {
  return {
    name: event.venue?.name || "Venue to be confirmed",
    location: [event.venue?.city, event.venue?.region, event.venue?.countryCode]
      .filter(Boolean)
      .join(" · "),
  };
}

function picksLabel(totalPredictions: number) {
  return `${totalPredictions.toLocaleString()} ${totalPredictions === 1 ? "pick" : "picks"}`;
}

function DesktopEvents({ events }: { events: Event[] }) {
  return (
    <div className="hidden overflow-hidden rounded-2xl border border-fl-border bg-fl-surface-1 shadow-[0_24px_70px_rgba(0,0,0,0.22)] lg:block">
      <div
        aria-hidden="true"
        className={`grid ${desktopGrid} bg-fl-surface-2 font-mono text-[10px] tracking-[.08em] text-fl-text-dim uppercase`}
      >
        <span className="px-5 py-3">Event</span>
        <span className="px-5 py-3">Venue</span>
        <span className="px-5 py-3">Date</span>
        <span className="px-5 py-3">Community picks</span>
        <span className="px-5 py-3 text-right">Action</span>
      </div>
      <div className="divide-y divide-fl-border">
        {events.map((event) => {
          const venue = venueDetails(event);
          return (
            <Link
              className={`group grid min-h-28 ${desktopGrid} items-center bg-fl-surface-1 transition duration-150 hover:bg-fl-surface-2 focus-visible:z-10 focus-visible:bg-fl-surface-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-fl-accent`}
              href={`/events/${event.slug}`}
              key={event.id}
            >
              <span className="min-w-0 px-5 py-5">
                <LiveStatusFragment
                  collection="events"
                  id={event.id}
                  initialStatus={event.status}
                />
                <span className="mt-3 block font-display text-2xl leading-tight font-bold text-fl-text transition group-hover:text-fl-accent">
                  {event.name}
                </span>
              </span>
              <span className="min-w-0 px-5 py-5">
                <span className="block text-sm font-semibold text-fl-text">
                  {venue.name}
                </span>
                {venue.location ? (
                  <span className="mt-1 block text-xs leading-5 text-fl-text-dim">
                    {venue.location}
                  </span>
                ) : null}
              </span>
              <span className="px-5 py-5 text-sm font-semibold text-fl-text-muted">
                {formatCompactDate(event.startsAt, event.venueTimezone)}
              </span>
              <span className="px-5 py-5 text-sm font-semibold text-fl-text">
                {picksLabel(event.predictionSummary.totalPredictions)}
              </span>
              <span className="px-5 py-5 text-right">
                <span className="inline-flex h-10 items-center gap-2 rounded-lg border border-fl-border bg-fl-surface-2 px-3.5 text-sm font-bold text-fl-text transition group-hover:border-fl-accent/60 group-hover:text-fl-accent">
                  Open <ArrowRight aria-hidden="true" size={15} />
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function MobileEvents({ events }: { events: Event[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-fl-border bg-fl-surface-1 shadow-[0_24px_70px_rgba(0,0,0,0.22)] lg:hidden">
      <div className="divide-y divide-fl-border">
        {events.map((event) => {
          const venue = venueDetails(event);
          return (
            <Link
              className="group block bg-fl-surface-1 p-5 transition duration-150 hover:bg-fl-surface-2 focus-visible:z-10 focus-visible:bg-fl-surface-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-fl-accent"
              href={`/events/${event.slug}`}
              key={event.id}
            >
              <span className="flex items-center justify-between gap-3">
                <LiveStatusFragment
                  collection="events"
                  id={event.id}
                  initialStatus={event.status}
                />
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-fl-text-muted">
                  <CalendarDays aria-hidden="true" size={14} />
                  {formatCompactDate(event.startsAt, event.venueTimezone)}
                </span>
              </span>
              <span className="mt-4 block font-display text-3xl leading-[.95] font-bold text-fl-text transition group-hover:text-fl-accent">
                {event.name}
              </span>
              <span className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-t border-fl-border pt-4">
                <span className="min-w-0">
                  <span className="eyebrow inline-flex items-center gap-1.5">
                    <MapPin aria-hidden="true" size={13} /> Venue
                  </span>
                  <span className="mt-2 block text-sm font-semibold text-fl-text">
                    {venue.name}
                  </span>
                  {venue.location ? (
                    <span className="mt-1 block text-xs leading-5 text-fl-text-dim">
                      {venue.location}
                    </span>
                  ) : null}
                </span>
                <span className="text-right">
                  <span className="eyebrow inline-flex items-center gap-1.5">
                    <UsersRound aria-hidden="true" size={13} /> Community
                  </span>
                  <span className="mt-2 block text-sm font-semibold text-fl-text">
                    {picksLabel(event.predictionSummary.totalPredictions)}
                  </span>
                </span>
              </span>
              <span className="mt-5 flex items-center justify-between gap-4">
                <span className="font-mono text-[10px] tracking-[.08em] text-fl-text-dim uppercase">
                  {event.fightCount} fights
                </span>
                <span className="inline-flex items-center gap-2 text-sm font-bold text-fl-accent">
                  Open event <ArrowRight aria-hidden="true" size={15} />
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default async function EventsPage() {
  const events = sortEventsNewestFirst(
    (await listPublicEvents()).filter(
      (event) => event.status !== "draft" && event.dataQuality !== "blocked",
    ),
  );

  return (
    <main className="shell py-10 sm:py-14" id="main-content">
      <Breadcrumbs
        items={[{ label: "Home", href: "/" }, { label: "Events" }]}
      />
      <header className="mt-8">
        <h1 className="font-display text-5xl leading-none font-extrabold sm:text-6xl">
          EVENTS
        </h1>
      </header>

      {events.length > 0 ? (
        <section aria-label="UFC events" className="mt-8 sm:mt-10">
          <DesktopEvents events={events} />
          <MobileEvents events={events} />
        </section>
      ) : (
        <Card className="mt-8 p-8 sm:mt-10">
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
