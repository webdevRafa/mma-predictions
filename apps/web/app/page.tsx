import type { Metadata } from "next";
import { ArrowRight, MessageCircle, Target, Trophy } from "lucide-react";
import Link from "next/link";

import { AdSlot } from "@/components/ads/ad-slot";
import { HeroEventCountdowns } from "@/components/events/hero-event-countdowns";
import { FightCardGroups } from "@/components/fights/fight-card-groups";
import { Card } from "@/components/ui/card";
import { EventPredictionModal } from "@/features/predictions/event-prediction-modal";
import { getPublicEvent, listPublicEvents } from "@/lib/data/public";
import { selectFeaturedEvent } from "@/lib/events/featured-event";
import { getServerRenderTime } from "@/lib/time/server";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: {
    title: "FightLobby — UFC predictions and live fight chat",
    description:
      "Make UFC predictions, compare picks, and join live matchup chats with the FightLobby community.",
    url: "/",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default async function HomePage() {
  const renderedAt = getServerRenderTime();
  const events = await listPublicEvents();
  const event = selectFeaturedEvent(events, renderedAt);
  const card = event ? await getPublicEvent(event.slug) : null;
  const eventTiming = event
    ? {
        status: event.status,
        startsAt: event.startsAt,
        ...(event.prelimsStartsAt
          ? { prelimsStartsAt: event.prelimsStartsAt }
          : {}),
        ...(event.mainCardStartsAt
          ? { mainCardStartsAt: event.mainCardStartsAt }
          : {}),
      }
    : null;
  const [eventTitlePrefix, eventTitleMatchup] = event?.name.includes(":")
    ? event.name.split(/:\s+/, 2)
    : [event?.name, undefined];

  return (
    <main id="main-content">
      <section className="relative overflow-hidden border-b border-fl-border">
        <div
          aria-hidden="true"
          className="arena-grid absolute inset-0 opacity-50"
        />
        <div className="shell relative grid gap-14 py-14 lg:min-h-[44rem] lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:gap-20 lg:py-20">
          <div className="max-w-3xl">
            <h1 className="font-display text-[clamp(3rem,4.5vw,5.25rem)] leading-[0.9] font-bold tracking-[-0.035em] text-fl-text text-balance">
              {eventTitlePrefix ? (
                eventTitleMatchup ? (
                  <>
                    {eventTitlePrefix}:
                    <span className="mt-2 block font-semibold text-fl-text/90">
                      {eventTitleMatchup}
                    </span>
                  </>
                ) : (
                  eventTitlePrefix
                )
              ) : (
                <>
                  UPCOMING
                  <span className="block font-semibold text-fl-text/90">
                    UFC EVENTS
                  </span>
                </>
              )}
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-fl-text-muted sm:text-lg">
              Make predictions, compare picks, and join live matchup chats with
              the FightLobby community.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                className="focus-ring inline-flex min-h-12 max-w-full cursor-pointer items-center gap-2 rounded-[10px] border border-fl-accent/80 bg-fl-accent/10 px-5 text-left text-sm leading-5 font-bold text-fl-text shadow-[0_8px_24px_rgba(241,64,29,0.08)] transition hover:bg-fl-accent hover:text-fl-bg hover:shadow-[0_10px_28px_rgba(241,64,29,0.18)]"
                href={event ? `/events/${event.slug}` : "/events"}
              >
                <span>{event ? "View event" : "View events"}</span>
                <ArrowRight aria-hidden="true" className="shrink-0" size={17} />
              </Link>
            </div>
          </div>

          {eventTiming ? (
            <HeroEventCountdowns {...eventTiming} renderedAt={renderedAt} />
          ) : (
            <Card className="p-8 lg:ml-auto lg:w-full lg:max-w-xl">
              <p className="text-fl-text-muted">
                The next verified UFC card will appear here as soon as it is
                published.
              </p>
            </Card>
          )}
        </div>
      </section>

      {event ? (
        <div className="shell py-8">
          <AdSlot
            eligible={event.monetizationEligible}
            placement="home_after_hero"
          />
        </div>
      ) : null}

      {card ? (
        <section className="shell py-16 sm:py-20">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Make your picks</p>
              <h2 className="mt-2 font-display text-4xl font-extrabold sm:text-5xl">
                The full fight card
              </h2>
            </div>
            <EventPredictionModal
              eventId={card.event.id}
              eventName={card.event.name}
              eventSlug={card.event.slug}
              fights={card.fights}
            />
          </div>
          <FightCardGroups fights={card.fights} />
        </section>
      ) : null}

      <section className="border-y border-fl-border bg-fl-surface-1/50">
        <div className="shell grid gap-px py-16 lg:grid-cols-3 lg:py-20">
          <Card className="rounded-none p-6 shadow-none sm:p-8">
            <Target aria-hidden="true" className="text-fl-accent" size={22} />
            <p className="eyebrow mt-5">Predict</p>
            <h2 className="mt-2 font-display text-3xl font-bold">
              Call the outcome
            </h2>
            <p className="mt-3 text-sm leading-6 text-fl-text-muted">
              Earn 5 points for the winner, 3 for the method group, and 2 for
              the exact finish detail.
            </p>
          </Card>
          <Card className="rounded-none p-6 shadow-none sm:p-8">
            <MessageCircle
              aria-hidden="true"
              className="text-fl-accent"
              size={22}
            />
            <p className="eyebrow mt-5">React</p>
            <h2 className="mt-2 font-display text-3xl font-bold">
              Meet in the lobby
            </h2>
            <p className="mt-3 text-sm leading-6 text-fl-text-muted">
              Each event and matchup gets a focused room built for the
              conversation around that fight.
            </p>
          </Card>
          <Card className="rounded-none p-6 shadow-none sm:p-8">
            <Trophy aria-hidden="true" className="text-fl-accent" size={22} />
            <p className="eyebrow mt-5">Prove it</p>
            <h2 className="mt-2 font-display text-3xl font-bold">
              Build your record
            </h2>
            <p className="mt-3 text-sm leading-6 text-fl-text-muted">
              The event board activates after official results. Accuracy, exact
              picks, and streaks follow every member.
            </p>
          </Card>
        </div>
      </section>
    </main>
  );
}
