import type { Metadata } from "next";
import {
  ArrowRight,
  CalendarDays,
  MessageCircle,
  Target,
  Trophy,
} from "lucide-react";
import Link from "next/link";

import { EventCountdown } from "@/components/events/event-countdown";
import { LocalEventTime } from "@/components/events/local-event-time";
import { FightCardGroups } from "@/components/fights/fight-card-groups";
import { FighterAvatar } from "@/components/fighters/fighter-avatar";
import { LiveStatusFragment } from "@/components/live/live-status-fragment";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { getPublicEvent, listPublicEvents } from "@/lib/data/public";
import { formatRecord } from "@/lib/format";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: {
    title: "FightLobby — Every fight has a lobby",
    description:
      "Make UFC predictions, compare the community read, and join the conversation around every matchup.",
    url: "/",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default async function HomePage() {
  const events = await listPublicEvents();
  const event =
    events.find((candidate) => candidate.status === "live") ??
    events.find((candidate) => candidate.status === "scheduled") ??
    events[0];
  const card = event ? await getPublicEvent(event.slug) : null;
  const mainFight =
    card?.fights.find((fight) => fight.id === event?.mainEventFightId) ??
    card?.fights.find(
      (fight) => fight.cardSegment === "main_card" && fight.boutOrder === 1,
    );

  return (
    <main id="main-content">
      <section className="relative overflow-hidden border-b border-fl-border">
        <div
          aria-hidden="true"
          className="arena-grid absolute inset-0 opacity-50"
        />
        <div className="shell relative grid gap-12 py-14 lg:min-h-[44rem] lg:grid-cols-[.86fr_1.14fr] lg:items-center lg:py-20">
          <div className="max-w-3xl">
            <Badge tone="accent">UFC launch edition</Badge>
            <h1 className="mt-6 font-display text-[clamp(4rem,9vw,8rem)] leading-[0.79] font-extrabold tracking-[-0.035em] text-balance">
              EVERY FIGHT
              <span className="block text-fl-accent">HAS A LOBBY.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-fl-text-muted sm:text-lg">
              Make the call before the walkout, reveal the community read, and
              build a prediction record that keeps the receipts.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                className="focus-ring inline-flex min-h-12 items-center gap-2 rounded-[10px] bg-fl-accent px-5 text-sm font-bold text-fl-bg shadow-[0_10px_28px_rgba(255,90,54,0.18)] transition hover:bg-fl-accent-strong"
                href={event ? `/events/${event.slug}` : "/events"}
              >
                Enter the next card <ArrowRight aria-hidden="true" size={17} />
              </Link>
              <Link
                className="focus-ring inline-flex min-h-12 items-center rounded-[10px] border border-fl-border bg-fl-surface-1 px-5 text-sm font-bold text-fl-text transition hover:border-fl-text-muted hover:bg-fl-surface-2"
                href="/events"
              >
                Browse events
              </Link>
            </div>
          </div>

          {event && mainFight ? (
            <Card className="relative overflow-hidden lg:ml-auto lg:w-full lg:max-w-2xl">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-fl-border px-5 py-4 sm:px-6">
                <div>
                  <p className="eyebrow">Current / next UFC event</p>
                  <h2 className="font-display text-2xl leading-none font-bold">
                    {event.shortName}
                  </h2>
                </div>
                <LiveStatusFragment
                  collection="events"
                  id={event.id}
                  initialStatus={event.status}
                />
              </div>
              <div className="p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-[10px] tracking-[0.08em] text-fl-text-muted uppercase">
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays aria-hidden="true" size={14} />
                    <LocalEventTime
                      startsAt={event.startsAt}
                      venueTimezone={event.venueTimezone}
                    />
                  </span>
                  <EventCountdown startsAt={event.startsAt} />
                </div>
                <div className="mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
                  <Link
                    className="focus-ring rounded-xl text-center"
                    href={`/fighters/${mainFight.fighterA.slug}`}
                  >
                    <FighterAvatar
                      className="mx-auto size-20 text-2xl sm:size-24 sm:text-3xl"
                      name={mainFight.fighterA.name.full}
                    />
                    <h3 className="mt-4 font-display text-2xl leading-none font-extrabold sm:text-4xl">
                      {mainFight.fighterA.name.full}
                    </h3>
                    <p className="mt-2 font-mono text-[10px] text-fl-text-muted">
                      {formatRecord(mainFight.fighterA.record)}
                    </p>
                  </Link>
                  <span className="font-display text-lg font-extrabold text-fl-text-dim">
                    VS
                  </span>
                  <Link
                    className="focus-ring rounded-xl text-center"
                    href={`/fighters/${mainFight.fighterB.slug}`}
                  >
                    <FighterAvatar
                      className="mx-auto size-20 text-2xl sm:size-24 sm:text-3xl"
                      name={mainFight.fighterB.name.full}
                    />
                    <h3 className="mt-4 font-display text-2xl leading-none font-extrabold sm:text-4xl">
                      {mainFight.fighterB.name.full}
                    </h3>
                    <p className="mt-2 font-mono text-[10px] text-fl-text-muted">
                      {formatRecord(mainFight.fighterB.record)}
                    </p>
                  </Link>
                </div>
                <Link
                  className="focus-ring mt-7 flex min-h-11 items-center justify-center gap-2 rounded-lg border border-fl-border bg-fl-surface-2 text-sm font-bold transition hover:border-fl-accent hover:text-fl-accent"
                  href={`/fights/${mainFight.slug}`}
                >
                  Open main event matchup{" "}
                  <ArrowRight aria-hidden="true" size={15} />
                </Link>
              </div>
            </Card>
          ) : (
            <Card className="p-8">
              <p className="text-fl-text-muted">
                The next verified UFC card will appear here as soon as it is
                published.
              </p>
            </Card>
          )}
        </div>
      </section>

      {card ? (
        <section className="shell py-16 sm:py-20">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Make your picks</p>
              <h2 className="mt-2 font-display text-4xl font-extrabold sm:text-5xl">
                The full fight card
              </h2>
            </div>
            <Link
              className="focus-ring inline-flex items-center gap-2 rounded-lg text-sm font-bold text-fl-accent"
              href={`/events/${card.event.slug}`}
            >
              Event command center <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>
          <FightCardGroups fights={card.fights} />
        </section>
      ) : null}

      <section className="border-y border-fl-border bg-fl-surface-1/50">
        <div className="shell grid gap-px py-16 lg:grid-cols-3 lg:py-20">
          <Card className="rounded-none p-6 shadow-none sm:p-8">
            <Target aria-hidden="true" className="text-fl-accent" size={22} />
            <p className="eyebrow mt-5">01 · Predict</p>
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
            <p className="eyebrow mt-5">02 · React</p>
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
            <p className="eyebrow mt-5">03 · Prove it</p>
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

      {card && mainFight ? (
        <section className="shell grid gap-6 py-16 lg:grid-cols-[1.2fr_.8fr] lg:py-20">
          <Card>
            <CardHeader
              eyebrow="Active matchup spotlight"
              title={
                mainFight.editorial.biggestQuestion ??
                `${mainFight.fighterA.name.full} vs ${mainFight.fighterB.name.full}`
              }
            />
            <div className="p-5 sm:p-6">
              <p className="max-w-3xl text-base leading-7 text-fl-text-muted">
                {mainFight.editorial.styleContrast ??
                  "A verified matchup comparison is being prepared by the FightLobby desk."}
              </p>
              <Link
                className="focus-ring mt-5 inline-flex items-center gap-2 rounded-lg text-sm font-bold text-fl-accent"
                href={`/fights/${mainFight.slug}`}
              >
                Read the matchup <ArrowRight aria-hidden="true" size={15} />
              </Link>
            </div>
          </Card>
          <Card>
            <CardHeader
              eyebrow="Lobby pulse"
              title="Where the card is talking"
            />
            <div className="divide-y divide-fl-border px-5 sm:px-6">
              {card.fights.slice(0, 3).map((fight) => (
                <Link
                  className="focus-ring flex items-center justify-between gap-3 py-4 text-sm transition hover:text-fl-accent"
                  href={`/fights/${fight.slug}`}
                  key={fight.id}
                >
                  <span>
                    {fight.fighterA.name.last ?? fight.fighterA.name.full} vs{" "}
                    {fight.fighterB.name.last ?? fight.fighterB.name.full}
                  </span>
                  <span className="font-mono text-[10px] text-fl-text-muted">
                    {fight.predictionSummary.total.toLocaleString()} picks
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        </section>
      ) : null}
    </main>
  );
}
