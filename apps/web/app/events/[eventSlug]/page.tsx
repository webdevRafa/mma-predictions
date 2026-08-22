import type { Metadata } from "next";
import { CalendarClock, MapPin, Radio, Trophy, UsersRound } from "lucide-react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { AdSlot } from "@/components/ads/ad-slot";
import { EventCountdown } from "@/components/events/event-countdown";
import { EventSchedule } from "@/components/events/event-schedule";
import { FightCardGroups } from "@/components/fights/fight-card-groups";
import { LiveStatusFragment } from "@/components/live/live-status-fragment";
import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { FightChatLauncher } from "@/features/chat/fight-chat-launcher";
import { TrackAnalyticsEvent } from "@/features/analytics/analytics-runtime";
import { getPublicEvent } from "@/lib/data/public";
import { absoluteUrl } from "@/lib/seo/site";
import { isEventIndexable } from "@/lib/seo/indexability";
import { resolveEventSchedule } from "@/lib/events/timing";
import { getServerRenderTime } from "@/lib/time/server";

type Props = { params: Promise<{ eventSlug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { eventSlug } = await params;
  const card = await getPublicEvent(eventSlug);
  if (!card)
    return {
      title: "Event not found",
      robots: { index: false, follow: false },
    };
  const description = `${card.event.name} fight card, community predictions, matchup analysis, and event lobby on FightLobby.`;
  const canonical = `/events/${card.event.slug}`;
  const indexable = isEventIndexable(card.event, card.fights);
  return {
    title: `${card.event.shortName} Fight Card, Predictions & Event Lobby`,
    description,
    alternates: { canonical },
    robots: { index: indexable, follow: true },
    openGraph: {
      title: `${card.event.name} — FightLobby`,
      description,
      type: "website",
      url: canonical,
      images: [
        {
          url: `${canonical}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: card.event.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: card.event.name,
      description,
      images: [`${canonical}/opengraph-image`],
    },
  };
}

function schemaEventStatus(status: string) {
  return (
    {
      scheduled: "https://schema.org/EventScheduled",
      postponed: "https://schema.org/EventPostponed",
      canceled: "https://schema.org/EventCancelled",
    }[status] ?? "https://schema.org/EventScheduled"
  );
}

export default async function EventPage({ params }: Props) {
  const { eventSlug } = await params;
  const card = await getPublicEvent(eventSlug);
  if (!card) notFound();
  if (eventSlug !== card.event.slug)
    permanentRedirect(`/events/${card.event.slug}`);
  const { event, fights } = card;
  const location = [
    event.venue?.name,
    event.venue?.city,
    event.venue?.region,
    event.venue?.countryCode,
  ]
    .filter(Boolean)
    .join(" · ");
  const renderedAt = getServerRenderTime();
  const eventTiming = {
    status: event.status,
    startsAt: event.startsAt,
    ...(event.prelimsStartsAt
      ? { prelimsStartsAt: event.prelimsStartsAt }
      : {}),
    ...(event.mainCardStartsAt
      ? { mainCardStartsAt: event.mainCardStartsAt }
      : {}),
  };
  const schedule = resolveEventSchedule(eventTiming);

  return (
    <main id="main-content">
      <TrackAnalyticsEvent
        name="view_event"
        parameters={{
          event_id: event.id,
          event_status: event.status,
          promotion: event.promotion,
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SportsEvent",
          name: event.name,
          startDate: schedule.prelimsStartsAt,
          eventStatus: schemaEventStatus(event.status),
          eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
          url: absoluteUrl(`/events/${event.slug}`),
          organizer: {
            "@type": "Organization",
            name: "FightLobby",
            url: absoluteUrl("/"),
          },
          ...(event.venue?.name
            ? {
                location: {
                  "@type": "Place",
                  name: event.venue.name,
                  address: {
                    "@type": "PostalAddress",
                    addressLocality: event.venue.city,
                    addressRegion: event.venue.region,
                    addressCountry: event.venue.countryCode,
                  },
                },
              }
            : {}),
        }}
      />

      <section className="relative overflow-hidden border-b border-fl-border">
        <div
          aria-hidden="true"
          className="arena-grid absolute inset-0 opacity-45"
        />
        <div className="shell relative py-10 sm:py-14">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Events", href: "/events" },
              { label: event.shortName },
            ]}
          />
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-5xl">
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone="accent">{event.promotion.toUpperCase()}</Badge>
                <LiveStatusFragment
                  collection="events"
                  id={event.id}
                  initialStatus={event.status}
                  eventTiming={eventTiming}
                  renderedAt={renderedAt}
                />
              </div>
              <h1 className="mt-5 font-display text-5xl leading-[.88] font-extrabold text-balance sm:text-7xl lg:text-8xl">
                {event.name}
              </h1>
              {event.editorial?.summary ? (
                <p className="mt-5 max-w-3xl text-base leading-7 text-fl-text-muted">
                  {event.editorial.summary}
                </p>
              ) : null}
            </div>
            <div className="rounded-xl border border-fl-border bg-fl-surface-1/90 p-5 lg:min-w-72">
              <p className="eyebrow">Event clock</p>
              <p className="mt-2 font-display text-2xl font-bold">
                <EventCountdown {...eventTiming} renderedAt={renderedAt} />
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-fl-border bg-fl-surface-1/45">
        <div className="shell grid gap-px bg-fl-border sm:grid-cols-2 lg:grid-cols-5">
          <div className="bg-fl-bg p-5 sm:col-span-2">
            <p className="eyebrow inline-flex items-center gap-2">
              <CalendarClock aria-hidden="true" size={13} /> Event schedule
            </p>
            <div className="mt-2 text-sm font-semibold">
              <EventSchedule
                mainCardStartsAt={schedule.mainCardStartsAt}
                prelimsStartsAt={schedule.prelimsStartsAt}
                venueTimezone={event.venueTimezone}
              />
            </div>
          </div>
          <div className="bg-fl-bg p-5">
            <p className="eyebrow inline-flex items-center gap-2">
              <MapPin aria-hidden="true" size={13} /> Venue
            </p>
            <p className="mt-2 text-sm font-semibold">
              {location || "To be confirmed"}
            </p>
          </div>
          <div className="bg-fl-bg p-5">
            <p className="eyebrow inline-flex items-center gap-2">
              <UsersRound aria-hidden="true" size={13} /> Predictions
            </p>
            <p className="mt-2 font-display text-2xl font-bold">
              {event.predictionSummary.totalPredictions.toLocaleString()}
            </p>
          </div>
          <div className="bg-fl-bg p-5">
            <p className="eyebrow inline-flex items-center gap-2">
              <Radio aria-hidden="true" size={13} /> Freshness
            </p>
            <p className="mt-2 text-sm font-semibold">
              <time dateTime={event.updatedAt}>
                Verified{" "}
                {new Date(event.updatedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </time>
            </p>
          </div>
        </div>
      </section>

      <div className="shell py-8">
        <AdSlot
          eligible={event.monetizationEligible}
          placement="event_after_context"
        />
      </div>

      <div className="shell grid gap-8 py-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:py-16">
        <section aria-labelledby="fight-card-title">
          <div className="mb-8">
            <p className="eyebrow">Official card order</p>
            <h2
              className="mt-2 font-display text-4xl font-extrabold sm:text-5xl"
              id="fight-card-title"
            >
              Fight card
            </h2>
            <p className="mt-3 text-sm text-fl-text-muted">
              Individual bout times are approximate. Prediction availability is
              controlled by the server.
            </p>
          </div>
          <FightCardGroups fights={fights} />
        </section>

        <aside
          className="space-y-5 lg:sticky lg:top-24 lg:self-start"
          aria-label="Event community summary"
        >
          <FightChatLauncher
            fightLabel={event.shortName}
            roomId={event.chatRoomId}
            roomType="event"
          />
          <Card>
            <CardHeader
              eyebrow="Event leaderboard"
              title="First result sets the board"
            />
            <div className="p-5 sm:p-6">
              <Trophy
                aria-hidden="true"
                className="text-fl-warning"
                size={23}
              />
              <p className="mt-4 text-sm leading-6 text-fl-text-muted">
                Members become event-board eligible after predicting at least
                70% of graded fights.
              </p>
              <Link
                className="focus-ring mt-4 inline-block rounded-md text-sm font-bold text-fl-accent"
                href="/leaderboards"
              >
                How rankings work
              </Link>
            </div>
          </Card>
        </aside>
      </div>
    </main>
  );
}
