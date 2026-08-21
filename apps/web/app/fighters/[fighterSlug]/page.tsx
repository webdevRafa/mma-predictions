import type { Metadata } from "next";
import {
  Activity,
  ArrowRight,
  Flag,
  MoveHorizontal,
  Ruler,
  Scale,
  Shield,
  Swords,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { getPublicFighter } from "@/lib/data/public";
import {
  formatHeightMeasurement,
  formatReachMeasurement,
  formatRecord,
} from "@/lib/format";
import { isFighterIndexable } from "@/lib/seo/indexability";
import { absoluteUrl } from "@/lib/seo/site";

type Props = { params: Promise<{ fighterSlug: string }> };

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { fighterSlug } = await params;
  const detail = await getPublicFighter(fighterSlug);
  if (!detail)
    return {
      title: "Fighter not found",
      robots: { index: false, follow: false },
    };
  const { fighter } = detail;
  const description = `${fighter.name.full} UFC profile: ${formatRecord(fighter.record)} record, verified stats, upcoming FightLobby matchups, and community prediction history.`;
  const canonical = `/fighters/${fighter.slug}`;
  return {
    title: `${fighter.name.full} Record, Stats & Fight Predictions`,
    description,
    alternates: { canonical },
    robots: { index: isFighterIndexable(fighter), follow: true },
    openGraph: {
      title: `${fighter.name.full} — Fighter Profile | FightLobby`,
      description,
      url: canonical,
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title: `${fighter.name.full} — FightLobby`,
      description,
    },
  };
}

export default async function FighterPage({ params }: Props) {
  const { fighterSlug } = await params;
  const detail = await getPublicFighter(fighterSlug);
  if (!detail) notFound();
  if (fighterSlug !== detail.fighter.slug)
    permanentRedirect(`/fighters/${detail.fighter.slug}`);
  const { fighter, fights } = detail;
  const upcomingFight = fights.find((fight) =>
    ["scheduled", "prefight"].includes(fight.status),
  );
  const facts: { icon: LucideIcon; label: string; value: string }[] = [
    {
      icon: Scale,
      label: "Division",
      value: fighter.currentWeightClass ?? "—",
    },
    { icon: Shield, label: "Stance", value: fighter.stance ?? "—" },
    {
      icon: Ruler,
      label: "Height",
      value: formatHeightMeasurement(fighter.heightCm),
    },
    {
      icon: MoveHorizontal,
      label: "Reach",
      value: formatReachMeasurement(fighter.reachCm),
    },
    { icon: Flag, label: "Country", value: fighter.countryCode ?? "—" },
    { icon: Activity, label: "Data quality", value: fighter.dataQuality },
  ];

  return (
    <main id="main-content">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Person",
          name: fighter.name.full,
          alternateName: fighter.name.nickname,
          url: absoluteUrl(`/fighters/${fighter.slug}`),
          nationality: fighter.countryCode,
          jobTitle: `${fighter.currentWeightClass ?? "Mixed martial arts"} fighter`,
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
              { label: "Fighters" },
              { label: fighter.name.full },
            ]}
          />
          <div className="mt-10 max-w-4xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent">
                {fighter.currentWeightClass ?? "UFC fighter"}
              </Badge>
              <Badge tone="neutral">{fighter.status}</Badge>
            </div>
            {fighter.name.nickname ? (
              <p className="eyebrow mt-5">“{fighter.name.nickname}”</p>
            ) : null}
            <h1 className="mt-2 font-display text-6xl leading-[.84] font-extrabold tracking-[-.02em] sm:text-8xl">
              {fighter.name.full}
            </h1>
            <p className="mt-5 font-mono text-lg font-semibold">
              {formatRecord(fighter.record)}{" "}
              <span className="text-sm font-medium text-fl-text-muted">
                professional record
              </span>
            </p>
          </div>
        </div>
      </section>

      <div className="shell grid gap-8 py-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:py-16">
        <div className="space-y-6">
          <section aria-labelledby="fighter-facts-title">
            <h2
              className="mb-4 font-display text-4xl font-extrabold"
              id="fighter-facts-title"
            >
              Fighter profile
            </h2>
            <div className="grid gap-px overflow-hidden rounded-2xl border border-fl-border bg-fl-border sm:grid-cols-2 lg:grid-cols-3">
              {facts.map(({ icon: Icon, label, value }) => (
                <div className="bg-fl-surface-1 p-5" key={label}>
                  <Icon
                    aria-hidden="true"
                    className="text-fl-accent"
                    size={18}
                  />
                  <p className="eyebrow mt-4">{label}</p>
                  <p className="mt-2 text-sm font-semibold capitalize">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {fighter.careerStats ? (
            <Card>
              <CardHeader
                eyebrow="Career sample"
                title="Performance metrics"
                description="Verified provider metrics; unavailable values are never estimated."
              />
              <div className="grid gap-px bg-fl-border sm:grid-cols-2 lg:grid-cols-4">
                {[
                  [
                    "Sig. strikes / min",
                    fighter.careerStats.significantStrikesLandedPerMinute?.toFixed(
                      2,
                    ) ?? "—",
                  ],
                  [
                    "Strike accuracy",
                    fighter.careerStats.significantStrikeAccuracy !== undefined
                      ? `${Math.round(fighter.careerStats.significantStrikeAccuracy * 100)}%`
                      : "—",
                  ],
                  [
                    "Takedowns / 15",
                    fighter.careerStats.takedownsPer15?.toFixed(1) ?? "—",
                  ],
                  [
                    "Takedown defense",
                    fighter.careerStats.takedownDefense !== undefined
                      ? `${Math.round(fighter.careerStats.takedownDefense * 100)}%`
                      : "—",
                  ],
                ].map(([label, value]) => (
                  <div className="bg-fl-surface-1 p-5" key={label}>
                    <p className="font-display text-3xl font-bold">{value}</p>
                    <p className="mt-1 text-xs text-fl-text-muted">{label}</p>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              eyebrow="FightLobby history"
              title="Matchup pages"
              description="Scheduled and historical pages connected to this fighter."
            />
            {fights.length > 0 ? (
              <div className="divide-y divide-fl-border">
                {fights.map((fight) => {
                  const isA = fight.fighterAId === fighter.id;
                  const opponent = isA ? fight.fighterB : fight.fighterA;
                  return (
                    <Link
                      className="focus-ring group flex items-center justify-between gap-4 p-5 transition hover:bg-fl-surface-2"
                      href={`/fights/${fight.slug}`}
                      key={fight.id}
                    >
                      <div>
                        <p className="eyebrow">
                          {fight.weightClass} ·{" "}
                          {fight.status.replaceAll("_", " ")}
                        </p>
                        <h3 className="mt-2 font-display text-2xl font-bold">
                          vs {opponent.name.full}
                        </h3>
                        <p className="mt-1 font-mono text-[10px] text-fl-text-muted">
                          Opponent {formatRecord(opponent.record)}
                        </p>
                      </div>
                      <ArrowRight
                        aria-hidden="true"
                        className="text-fl-text-dim transition group-hover:text-fl-accent"
                        size={19}
                      />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="p-6 text-sm text-fl-text-muted">
                No verified FightLobby matchups are connected yet.
              </p>
            )}
          </Card>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          {upcomingFight ? (
            <Card>
              <CardHeader
                eyebrow="Next matchup"
                title={`${upcomingFight.fighterA.name.last ?? upcomingFight.fighterA.name.full} vs ${upcomingFight.fighterB.name.last ?? upcomingFight.fighterB.name.full}`}
              />
              <div className="p-5 sm:p-6">
                <Swords
                  aria-hidden="true"
                  className="text-fl-accent"
                  size={23}
                />
                <p className="mt-4 text-sm leading-6 text-fl-text-muted">
                  Predictions are {upcomingFight.predictionStatus}. The
                  community has made{" "}
                  {upcomingFight.predictionSummary.total.toLocaleString()}{" "}
                  picks.
                </p>
                <Link
                  className="focus-ring mt-5 inline-flex items-center gap-2 rounded-lg text-sm font-bold text-fl-accent"
                  href={`/fights/${upcomingFight.slug}`}
                >
                  Open matchup <ArrowRight aria-hidden="true" size={15} />
                </Link>
              </div>
            </Card>
          ) : null}
          <Card className="p-5 sm:p-6">
            <p className="eyebrow">Community performance</p>
            <h2 className="mt-2 font-display text-3xl font-bold">
              Tracking begins at launch
            </h2>
            <p className="mt-3 text-sm leading-6 text-fl-text-muted">
              Prediction accuracy around this fighter will appear once official
              FightLobby results are graded.
            </p>
          </Card>
        </aside>
      </div>
    </main>
  );
}
