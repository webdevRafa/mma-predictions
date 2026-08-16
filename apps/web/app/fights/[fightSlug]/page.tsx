import type { Metadata } from "next";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  MessageCircle,
  Radio,
  Target,
} from "lucide-react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { StatsComparison } from "@/components/fights/stats-comparison";
import { FighterAvatar } from "@/components/fighters/fighter-avatar";
import { LiveStatusFragment } from "@/components/live/live-status-fragment";
import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PredictionExperience } from "@/features/predictions/prediction-experience";
import { getPublicFight, listPublicCards } from "@/lib/data/public";
import { formatCardSegment, formatRecord } from "@/lib/format";
import { isFightIndexable } from "@/lib/seo/indexability";
import { absoluteUrl } from "@/lib/seo/site";

type Props = { params: Promise<{ fightSlug: string }> };

export async function generateStaticParams() {
  return (await listPublicCards()).flatMap((card) =>
    card.fights.map((fight) => ({ fightSlug: fight.slug })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { fightSlug } = await params;
  const detail = await getPublicFight(fightSlug);
  if (!detail)
    return {
      title: "Fight not found",
      robots: { index: false, follow: false },
    };
  const { fight, fighters } = detail;
  const title = `${fight.fighterA.name.full} vs ${fight.fighterB.name.full} Predictions, Stats & Live Chat`;
  const description = `${fight.fighterA.name.full} vs ${fight.fighterB.name.full}: compare UFC stats, make your prediction, and follow the community discussion on FightLobby.`;
  const canonical = `/fights/${fight.slug}`;
  const indexable = isFightIndexable(fight, fighters);
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: indexable, follow: true },
    openGraph: {
      title: `${title} | FightLobby`,
      description,
      type: "website",
      url: canonical,
      images: [
        {
          url: `${canonical}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `${fight.fighterA.name.full} versus ${fight.fighterB.name.full}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${canonical}/opengraph-image`],
    },
  };
}

export default async function FightPage({ params }: Props) {
  const { fightSlug } = await params;
  const detail = await getPublicFight(fightSlug);
  if (!detail) notFound();
  if (fightSlug !== detail.fight.slug)
    permanentRedirect(`/fights/${detail.fight.slug}`);
  const { event, fight, fighters } = detail;
  const fighterA = fighters.find((fighter) => fighter.id === fight.fighterAId);
  const fighterB = fighters.find((fighter) => fighter.id === fight.fighterBId);
  if (!fighterA || !fighterB) notFound();

  return (
    <main id="main-content">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SportsEvent",
          name: `${fighterA.name.full} vs ${fighterB.name.full}`,
          description:
            fight.editorial.styleContrast ??
            `${fight.weightClass} matchup at ${event.name}.`,
          startDate: event.startsAt,
          url: absoluteUrl(`/fights/${fight.slug}`),
          competitor: [
            {
              "@type": "Person",
              name: fighterA.name.full,
              url: absoluteUrl(`/fighters/${fighterA.slug}`),
            },
            {
              "@type": "Person",
              name: fighterB.name.full,
              url: absoluteUrl(`/fighters/${fighterB.slug}`),
            },
          ],
          superEvent: {
            "@type": "SportsEvent",
            name: event.name,
            url: absoluteUrl(`/events/${event.slug}`),
            startDate: event.startsAt,
          },
        }}
      />

      <section className="relative overflow-hidden border-b border-fl-border">
        <div
          aria-hidden="true"
          className="arena-grid absolute inset-0 opacity-50"
        />
        <div className="shell relative py-8 sm:py-12">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Events", href: "/events" },
              { label: event.shortName, href: `/events/${event.slug}` },
              {
                label: `${fighterA.name.last ?? fighterA.name.full} vs ${fighterB.name.last ?? fighterB.name.full}`,
              },
            ]}
          />
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">
                {formatCardSegment(fight.cardSegment)}
              </Badge>
              {fight.isTitleFight ? (
                <Badge tone="accent">
                  {fight.titleType === "interim"
                    ? "Interim title"
                    : "Title fight"}
                </Badge>
              ) : null}
            </div>
            <LiveStatusFragment
              collection="fights"
              id={fight.id}
              initialStatus={fight.status}
            />
          </div>

          <h1 className="sr-only">
            {fighterA.name.full} vs {fighterB.name.full} predictions, stats, and
            live chat
          </h1>
          <div className="mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-8">
            <div className="text-center">
              <Link
                className="focus-ring inline-block rounded-full"
                href={`/fighters/${fighterA.slug}`}
              >
                <FighterAvatar
                  className="size-20 text-2xl sm:size-32 sm:text-4xl"
                  name={fighterA.name.full}
                />
              </Link>
              {fighterA.name.nickname ? (
                <p className="eyebrow mt-5">“{fighterA.name.nickname}”</p>
              ) : null}
              <h2 className="mt-2 font-display text-[clamp(2.25rem,7vw,6.5rem)] leading-[.82] font-extrabold tracking-[-.02em]">
                {fighterA.name.full}
              </h2>
              <p className="mt-3 font-mono text-[11px] text-fl-text-muted">
                {formatRecord(fighterA.record)} · {fighterA.countryCode ?? "—"}
              </p>
            </div>
            <div className="text-center">
              <span className="font-display text-xl font-extrabold text-fl-text-dim sm:text-3xl">
                VS
              </span>
              <span className="mx-auto mt-3 block h-16 w-px bg-gradient-to-b from-fl-accent to-transparent" />
            </div>
            <div className="text-center">
              <Link
                className="focus-ring inline-block rounded-full"
                href={`/fighters/${fighterB.slug}`}
              >
                <FighterAvatar
                  className="size-20 text-2xl sm:size-32 sm:text-4xl"
                  name={fighterB.name.full}
                />
              </Link>
              {fighterB.name.nickname ? (
                <p className="eyebrow mt-5">“{fighterB.name.nickname}”</p>
              ) : null}
              <h2 className="mt-2 font-display text-[clamp(2.25rem,7vw,6.5rem)] leading-[.82] font-extrabold tracking-[-.02em]">
                {fighterB.name.full}
              </h2>
              <p className="mt-3 font-mono text-[11px] text-fl-text-muted">
                {formatRecord(fighterB.record)} · {fighterB.countryCode ?? "—"}
              </p>
            </div>
          </div>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-fl-border pt-5 font-mono text-[10px] tracking-[.08em] text-fl-text-muted uppercase">
            <span>{fight.weightClass}</span>
            <span>{fight.scheduledRounds} rounds</span>
            <span>
              Event start{" "}
              {new Date(event.startsAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
            <span>Individual bout time is approximate</span>
          </div>
        </div>
      </section>

      <nav
        aria-label="Fight page sections"
        className="sticky top-16 z-30 border-b border-fl-border bg-fl-bg/95 backdrop-blur md:hidden"
      >
        <div className="shell grid grid-cols-4 text-center text-xs font-semibold">
          <a className="focus-ring py-4" href="#matchup">
            Matchup
          </a>
          <a className="focus-ring py-4" href="#predict">
            Predict
          </a>
          <a className="focus-ring py-4" href="#stats">
            Stats
          </a>
          <a className="focus-ring py-4" href="#lobby">
            Lobby
          </a>
        </div>
      </nav>

      <div
        className="shell grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:py-14"
        id="matchup"
      >
        <div className="space-y-6">
          <PredictionExperience fight={fight} />
          <div id="stats">
            <StatsComparison fighterA={fighterA} fighterB={fighterB} />
          </div>

          <Card>
            <CardHeader
              eyebrow="FightLobby desk"
              title={fight.editorial.biggestQuestion ?? "The matchup question"}
            />
            <div className="space-y-6 p-5 sm:p-6">
              {fight.editorial.status === "published" ? (
                <>
                  {fight.editorial.styleContrast ? (
                    <div>
                      <p className="eyebrow">Style contrast</p>
                      <p className="mt-2 leading-7 text-fl-text-muted">
                        {fight.editorial.styleContrast}
                      </p>
                    </div>
                  ) : null}
                  <div className="grid gap-5 sm:grid-cols-2">
                    {fight.editorial.keysForFighterA?.length ? (
                      <div>
                        <h3 className="font-display text-2xl font-bold">
                          Keys for {fighterA.name.last ?? fighterA.name.full}
                        </h3>
                        <ul className="mt-3 space-y-2 text-sm text-fl-text-muted">
                          {fight.editorial.keysForFighterA.map((key) => (
                            <li className="flex gap-2" key={key}>
                              <CheckCircle2
                                aria-hidden="true"
                                className="mt-0.5 shrink-0 text-fl-accent"
                                size={15}
                              />
                              {key}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {fight.editorial.keysForFighterB?.length ? (
                      <div>
                        <h3 className="font-display text-2xl font-bold">
                          Keys for {fighterB.name.last ?? fighterB.name.full}
                        </h3>
                        <ul className="mt-3 space-y-2 text-sm text-fl-text-muted">
                          {fight.editorial.keysForFighterB.map((key) => (
                            <li className="flex gap-2" key={key}>
                              <CheckCircle2
                                aria-hidden="true"
                                className="mt-0.5 shrink-0 text-fl-accent"
                                size={15}
                              />
                              {key}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                  {fight.editorial.fightLobbyTake ? (
                    <blockquote className="border-l-2 border-fl-accent pl-4 text-lg leading-7">
                      “{fight.editorial.fightLobbyTake}”
                    </blockquote>
                  ) : null}
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-fl-border bg-fl-surface-2 p-5">
                  <p className="font-semibold">Analysis under review</p>
                  <p className="mt-2 text-sm leading-6 text-fl-text-muted">
                    This page stays out of search indexing until verified stats
                    and original matchup context clear the content review.
                  </p>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Fight state"
              title={
                fight.result ? "Official result" : "Awaiting the opening horn"
              }
            />
            <div className="p-5 sm:p-6">
              {fight.result ? (
                <p className="text-sm text-fl-text-muted">
                  Result data is recorded at version{" "}
                  {fight.result.resultVersion} and will display here after
                  official verification.
                </p>
              ) : (
                <div className="flex items-start gap-3">
                  <Clock3
                    aria-hidden="true"
                    className="mt-0.5 text-fl-info"
                    size={20}
                  />
                  <p className="text-sm leading-6 text-fl-text-muted">
                    This matchup is scheduled. Live status updates can replace
                    this fragment without rebuilding the full page.
                  </p>
                </div>
              )}
            </div>
          </Card>

          <Link
            className="focus-ring inline-flex items-center gap-2 rounded-lg text-sm font-bold text-fl-accent"
            href={`/events/${event.slug}`}
          >
            <ArrowLeft aria-hidden="true" size={16} /> Back to {event.shortName}
          </Link>
        </div>

        <aside
          className="space-y-5 lg:sticky lg:top-24 lg:self-start"
          id="lobby"
        >
          <Card>
            <CardHeader eyebrow="Fight lobby" title="Matchup room" />
            <div className="p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-sm font-semibold">
                  <Radio
                    aria-hidden="true"
                    className="text-fl-live"
                    size={16}
                  />{" "}
                  Room preview
                </span>
                <Badge tone="neutral">Read only</Badge>
              </div>
              <div className="mt-5 space-y-3">
                {[
                  "Community chat connects in Phase 8.",
                  "Predictions stay separate from lobby noise.",
                ].map((message) => (
                  <div
                    className="rounded-xl bg-fl-surface-2 p-3 text-xs leading-5 text-fl-text-muted"
                    key={message}
                  >
                    {message}
                  </div>
                ))}
              </div>
              <p className="mt-5 flex items-center gap-2 font-mono text-[10px] tracking-[.08em] text-fl-text-dim uppercase">
                <MessageCircle aria-hidden="true" size={13} />{" "}
                {fight.chatRoomId}
              </p>
            </div>
          </Card>
          <Card className="p-5 sm:p-6">
            <Target aria-hidden="true" className="text-fl-accent" size={22} />
            <h2 className="mt-4 font-display text-2xl font-bold">
              10 points available
            </h2>
            <p className="mt-2 text-sm leading-6 text-fl-text-muted">
              5 winner · 3 method · 2 exact detail. A wrong winner scores zero
              for the fight.
            </p>
          </Card>
        </aside>
      </div>
    </main>
  );
}
