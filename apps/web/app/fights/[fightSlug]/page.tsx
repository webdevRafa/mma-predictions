import type { Metadata } from "next";
import { Target } from "lucide-react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { AdSlot } from "@/components/ads/ad-slot";
import { FightPageWorkspace } from "@/components/fights/fight-page-workspace";
import { StatsComparison } from "@/components/fights/stats-comparison";
import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FightChatLauncher } from "@/features/chat/fight-chat-launcher";
import { FightDiscussion } from "@/features/discussions/fight-discussion";
import { TrackAnalyticsEvent } from "@/features/analytics/analytics-runtime";
import { PredictionExperience } from "@/features/predictions/prediction-experience";
import { getPublicFight } from "@/lib/data/public";
import { formatCardSegment, formatRecord } from "@/lib/format";
import { isFightIndexable } from "@/lib/seo/indexability";
import { absoluteUrl } from "@/lib/seo/site";

type Props = { params: Promise<{ fightSlug: string }> };

export function generateStaticParams() {
  return [];
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
    <main className="overflow-x-clip" id="main-content">
      <TrackAnalyticsEvent
        name="view_fight"
        parameters={{ fight_id: fight.id, fight_status: fight.status }}
      />
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
          <div className="mt-8 flex flex-wrap items-center gap-3">
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
          </div>

          <h1 className="sr-only">
            {fighterA.name.full} vs {fighterB.name.full} predictions, stats, and
            live chat
          </h1>
          <div className="mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-8">
            <div className="min-w-0 text-center">
              {fighterA.name.nickname ? (
                <p className="eyebrow">“{fighterA.name.nickname}”</p>
              ) : null}
              <Link
                className="focus-ring mt-2 inline-block rounded-md"
                href={`/fighters/${fighterA.slug}`}
              >
                <h2 className="font-display text-3xl leading-none font-extrabold tracking-[-.02em] sm:text-4xl lg:whitespace-nowrap lg:text-5xl">
                  {fighterA.name.full}
                </h2>
              </Link>
              <p className="mt-3 font-mono text-[11px] text-fl-text-muted">
                {formatRecord(fighterA.record)} · {fighterA.countryCode ?? "—"}
              </p>
            </div>
            <div className="min-w-0 text-center">
              <span className="font-display text-xl font-extrabold text-fl-text-dim sm:text-3xl">
                VS
              </span>
              <span className="mx-auto mt-3 block h-16 w-px bg-gradient-to-b from-fl-accent to-transparent" />
            </div>
            <div className="min-w-0 text-center">
              {fighterB.name.nickname ? (
                <p className="eyebrow">“{fighterB.name.nickname}”</p>
              ) : null}
              <Link
                className="focus-ring mt-2 inline-block rounded-md"
                href={`/fighters/${fighterB.slug}`}
              >
                <h2 className="font-display text-3xl leading-none font-extrabold tracking-[-.02em] sm:text-4xl lg:whitespace-nowrap lg:text-5xl">
                  {fighterB.name.full}
                </h2>
              </Link>
              <p className="mt-3 font-mono text-[11px] text-fl-text-muted">
                {formatRecord(fighterB.record)} · {fighterB.countryCode ?? "—"}
              </p>
            </div>
          </div>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-fl-border pt-5 font-mono text-[10px] tracking-[.08em] text-fl-text-muted uppercase">
            <span>{fight.weightClass}</span>
            <span>{fight.scheduledRounds} rounds</span>
          </div>
        </div>
      </section>

      <div className="shell py-8">
        <AdSlot
          eligible={fight.monetizationEligible}
          placement="fight_after_matchup"
        />
      </div>

      <FightPageWorkspace
        backHref={`/events/${event.slug}`}
        backLabel={`Back to ${event.shortName}`}
        fighterAName={fighterA.name.full}
        fighterBName={fighterB.name.full}
        lobby={
          <>
            <FightChatLauncher
              fightLabel={`${fighterA.name.full} vs ${fighterB.name.full}`}
              roomId={fight.chatRoomId}
            />
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
          </>
        }
        prediction={<PredictionExperience fight={fight} />}
        stats={<StatsComparison fighterA={fighterA} fighterB={fighterB} />}
        posts={
          <FightDiscussion
            fightId={fight.id}
            fightLabel={`${fighterA.name.full} vs ${fighterB.name.full}`}
          />
        }
      />
    </main>
  );
}
