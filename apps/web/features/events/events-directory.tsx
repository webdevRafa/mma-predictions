"use client";

import type { Event } from "@fightlobby/domain";
import {
  ArrowRight,
  CalendarDays,
  MapPin,
  Search,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { LiveStatusFragment } from "@/components/live/live-status-fragment";
import { filterEvents } from "@/lib/events/directory";
import { formatCompactDate } from "@/lib/format";

const desktopGrid =
  "lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.35fr)_minmax(8rem,.8fr)_minmax(7.5rem,.7fr)_7.5rem]";

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

function EventRows({
  events,
  matchingIds,
}: {
  events: Event[];
  matchingIds: Set<string>;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-fl-border bg-fl-surface-1 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
      <div
        aria-hidden="true"
        className={`hidden ${desktopGrid} bg-fl-surface-2 font-mono text-[10px] tracking-[.08em] text-fl-text-dim uppercase lg:grid`}
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
              className={`group block bg-fl-surface-1 p-5 transition duration-150 hover:bg-fl-surface-2 focus-visible:z-10 focus-visible:bg-fl-surface-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-fl-accent lg:grid lg:min-h-28 lg:items-center lg:p-0 ${desktopGrid}`}
              hidden={!matchingIds.has(event.id)}
              href={`/events/${event.slug}`}
              key={event.id}
            >
              <span className="min-w-0 lg:px-5 lg:py-5">
                <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-4 lg:flex-nowrap lg:gap-4">
                  <span className="order-2 w-full font-display text-3xl leading-[.95] font-bold text-fl-text transition group-hover:text-fl-accent lg:order-1 lg:w-auto lg:text-2xl lg:leading-tight">
                    {event.name}
                  </span>
                  <span className="order-1 shrink-0 lg:order-2">
                    <LiveStatusFragment
                      collection="events"
                      id={event.id}
                      initialStatus={event.status}
                    />
                  </span>
                  <span className="order-1 ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-fl-text-muted lg:hidden">
                    <CalendarDays aria-hidden="true" size={14} />
                    {formatCompactDate(event.startsAt, event.venueTimezone)}
                  </span>
                </span>
              </span>

              <span className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-t border-fl-border pt-4 lg:contents">
                <span className="min-w-0 lg:px-5 lg:py-5">
                  <span className="eyebrow inline-flex items-center gap-1.5 lg:hidden">
                    <MapPin aria-hidden="true" size={13} /> Venue
                  </span>
                  <span className="mt-2 block text-sm font-semibold text-fl-text lg:mt-0">
                    {venue.name}
                  </span>
                  {venue.location ? (
                    <span className="mt-1 block text-xs leading-5 text-fl-text-dim">
                      {venue.location}
                    </span>
                  ) : null}
                </span>
                <span className="hidden px-5 py-5 text-sm font-semibold text-fl-text-muted lg:block">
                  {formatCompactDate(event.startsAt, event.venueTimezone)}
                </span>
                <span className="text-right lg:px-5 lg:py-5 lg:text-left">
                  <span className="eyebrow inline-flex items-center gap-1.5 lg:hidden">
                    <UsersRound aria-hidden="true" size={13} /> Community
                  </span>
                  <span className="mt-2 block text-sm font-semibold text-fl-text lg:mt-0">
                    {picksLabel(event.predictionSummary.totalPredictions)}
                  </span>
                </span>
                <span className="col-span-2 mt-1 flex items-center justify-between gap-4 lg:col-span-1 lg:mt-0 lg:justify-end lg:px-5 lg:py-5">
                  <span className="font-mono text-[10px] tracking-[.08em] text-fl-text-dim uppercase lg:hidden">
                    {event.fightCount} fights
                  </span>
                  <span className="inline-flex items-center gap-2 text-sm font-bold text-fl-accent lg:h-10 lg:rounded-lg lg:border lg:border-fl-border lg:bg-fl-surface-2 lg:px-3.5 lg:text-fl-text lg:transition lg:group-hover:border-fl-accent/45 lg:group-hover:text-fl-accent">
                    <span className="lg:hidden">Open event</span>
                    <span className="hidden lg:inline">Open</span>
                    <ArrowRight aria-hidden="true" size={15} />
                  </span>
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function EventsDirectory({ events }: { events: Event[] }) {
  const [query, setQuery] = useState("");
  const matchingIds = useMemo(
    () => new Set(filterEvents(events, query).map((event) => event.id)),
    [events, query],
  );
  const matchCount = matchingIds.size;

  return (
    <>
      <header className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="font-display text-5xl leading-none font-semibold tracking-[-0.025em] sm:text-6xl">
          Events
        </h1>
        {events.length > 0 ? (
          <div className="relative w-full sm:max-w-sm">
            <label className="sr-only" htmlFor="event-search">
              Search events
            </label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-fl-text-dim"
              size={17}
            />
            <input
              autoComplete="off"
              className="focus-ring h-12 w-full rounded-xl border border-fl-border bg-fl-surface-1 pr-11 pl-11 text-sm text-fl-text outline-none placeholder:text-fl-text-dim hover:border-fl-border-strong focus:border-fl-accent/55"
              id="event-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search events or venues"
              spellCheck={false}
              type="search"
              value={query}
            />
            {query ? (
              <button
                aria-label="Clear event search"
                className="focus-ring absolute top-1/2 right-2.5 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-fl-text-dim transition hover:bg-fl-surface-2 hover:text-fl-text"
                onClick={() => setQuery("")}
                type="button"
              >
                <X aria-hidden="true" size={16} />
              </button>
            ) : null}
          </div>
        ) : null}
      </header>

      <p className="sr-only" role="status">
        {query
          ? `${matchCount} ${matchCount === 1 ? "event" : "events"} found`
          : `${events.length} ${events.length === 1 ? "event" : "events"} available`}
      </p>

      {events.length > 0 ? (
        <section aria-label="UFC events" className="mt-8 sm:mt-10">
          <div hidden={matchCount === 0}>
            <EventRows events={events} matchingIds={matchingIds} />
          </div>
          {matchCount === 0 ? (
            <div className="rounded-2xl border border-fl-border bg-fl-surface-1 p-8 text-center">
              <h2 className="font-display text-3xl font-bold">
                No matching events
              </h2>
              <p className="mt-2 text-sm text-fl-text-muted">
                Try another event name, fighter, city, or venue.
              </p>
              <button
                className="focus-ring mt-5 rounded-lg border border-fl-border bg-fl-surface-2 px-4 py-2 text-sm font-bold text-fl-text transition hover:border-fl-accent/45 hover:text-fl-accent"
                onClick={() => setQuery("")}
                type="button"
              >
                Clear search
              </button>
            </div>
          ) : null}
        </section>
      ) : (
        <div className="mt-8 rounded-2xl border border-fl-border bg-fl-surface-1 p-8 sm:mt-10">
          <h2 className="font-display text-3xl font-bold">
            No verified events yet
          </h2>
          <p className="mt-2 text-sm text-fl-text-muted">
            The next UFC card will appear after its event data passes
            validation.
          </p>
        </div>
      )}
    </>
  );
}
