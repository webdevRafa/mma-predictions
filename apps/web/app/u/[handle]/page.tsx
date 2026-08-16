import type { Metadata } from "next";
import {
  Award,
  CalendarDays,
  Flame,
  Medal,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { notFound, permanentRedirect } from "next/navigation";

import { FighterAvatar } from "@/components/fighters/fighter-avatar";
import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { getPublicProfile, listPublicProfiles } from "@/lib/data/profiles";
import { absoluteUrl } from "@/lib/seo/site";

type Props = { params: Promise<{ handle: string }> };

export async function generateStaticParams() {
  return (await listPublicProfiles()).map((profile) => ({
    handle: profile.handleNormalized,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const profile = await getPublicProfile(handle);
  if (!profile)
    return {
      title: "Member not found",
      robots: { index: false, follow: false },
    };
  const indexable =
    profile.profileVisibility === "public" && profile.stats.gradedPicks >= 5;
  const description = `@${profile.handle} on FightLobby: ${profile.stats.totalPoints} points, ${Math.round(profile.stats.winnerAccuracy * 100)}% winner accuracy, and ${profile.stats.exactPicks} exact picks.`;
  return {
    title: `@${profile.handle} — UFC Prediction Record`,
    description,
    alternates: { canonical: `/u/${profile.handleNormalized}` },
    robots: { index: indexable, follow: true },
    openGraph: {
      title: `@${profile.handle} on FightLobby`,
      description,
      url: `/u/${profile.handleNormalized}`,
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title: `@${profile.handle} on FightLobby`,
      description,
    },
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const { handle } = await params;
  const profile = await getPublicProfile(handle);
  if (!profile) notFound();
  if (handle.toLowerCase() !== profile.handleNormalized)
    permanentRedirect(`/u/${profile.handleNormalized}`);
  const joined = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(profile.joinedAt));
  const stats: { icon: LucideIcon; label: string; value: string }[] = [
    {
      icon: Trophy,
      label: "Points",
      value: profile.stats.totalPoints.toLocaleString(),
    },
    {
      icon: Target,
      label: "Winner accuracy",
      value: `${Math.round(profile.stats.winnerAccuracy * 100)}%`,
    },
    {
      icon: Medal,
      label: "Exact picks",
      value: profile.stats.exactPicks.toLocaleString(),
    },
    {
      icon: Flame,
      label: "Current streak",
      value: profile.stats.currentStreak.toLocaleString(),
    },
  ];

  return (
    <main id="main-content">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          url: absoluteUrl(`/u/${profile.handleNormalized}`),
          dateCreated: profile.joinedAt,
          dateModified: profile.updatedAt,
          mainEntity: {
            "@type": "Person",
            name: profile.displayName ?? profile.handle,
            alternateName: `@${profile.handle}`,
          },
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
              { label: `@${profile.handle}` },
            ]}
          />
          <div className="mt-10 flex flex-col gap-6 sm:flex-row sm:items-center">
            <FighterAvatar
              className="size-28 text-4xl"
              name={profile.displayName ?? profile.handle}
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">Member record</Badge>
                {profile.rankSummary?.pointsRank ? (
                  <Badge tone="neutral">
                    Points rank #{profile.rankSummary.pointsRank}
                  </Badge>
                ) : null}
              </div>
              <h1 className="mt-4 font-display text-5xl font-extrabold sm:text-7xl">
                @{profile.handle}
              </h1>
              {profile.displayName ? (
                <p className="mt-2 text-base text-fl-text-muted">
                  {profile.displayName}
                </p>
              ) : null}
              <p className="mt-3 flex items-center gap-2 font-mono text-[10px] tracking-[.08em] text-fl-text-dim uppercase">
                <CalendarDays aria-hidden="true" size={13} /> Joined {joined}
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="shell py-12 sm:py-16">
        <div className="grid gap-px overflow-hidden rounded-2xl border border-fl-border bg-fl-border sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(({ icon: Icon, label, value }) => (
            <div className="bg-fl-surface-1 p-5 sm:p-6" key={label}>
              <Icon aria-hidden="true" className="text-fl-accent" size={20} />
              <p className="mt-5 font-display text-4xl font-extrabold">
                {value}
              </p>
              <p className="mt-1 text-xs text-fl-text-muted">{label}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_.72fr]">
          <Card>
            <CardHeader
              eyebrow="Prediction record"
              title={`${profile.stats.gradedPicks} graded picks`}
              description="Upcoming picks stay private until lock unless this member explicitly shares one."
            />
            <div className="p-5 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-fl-surface-2 p-4">
                  <p className="eyebrow">Correct winners</p>
                  <p className="mt-2 font-display text-3xl font-bold">
                    {profile.stats.correctWinners}
                  </p>
                </div>
                <div className="rounded-xl bg-fl-surface-2 p-4">
                  <p className="eyebrow">Longest streak</p>
                  <p className="mt-2 font-display text-3xl font-bold">
                    {profile.stats.longestStreak}
                  </p>
                </div>
                <div className="rounded-xl bg-fl-surface-2 p-4">
                  <p className="eyebrow">Event titles</p>
                  <p className="mt-2 font-display text-3xl font-bold">
                    {profile.stats.eventChampionships}
                  </p>
                </div>
              </div>
              <p className="mt-5 text-sm leading-6 text-fl-text-muted">
                Recent graded picks will populate as the prediction engine
                records official outcomes.
              </p>
            </div>
          </Card>
          <Card>
            <CardHeader eyebrow="Earned badges" title="Receipts" />
            <div className="flex flex-wrap gap-2 p-5 sm:p-6">
              {profile.badges.length > 0 ? (
                profile.badges.map((badge) => (
                  <Badge key={badge} tone="warning">
                    <Award aria-hidden="true" className="mr-1.5" size={12} />
                    {badge}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-fl-text-muted">No badges yet.</p>
              )}
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}
