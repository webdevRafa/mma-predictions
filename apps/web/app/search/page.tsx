import { normalizeSearchText } from "@fightlobby/domain";
import type { Metadata } from "next";
import {
  ArrowRight,
  CalendarDays,
  Search,
  Swords,
  UserRound,
} from "lucide-react";
import Link from "next/link";

import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { Card } from "@/components/ui/card";
import { listPublicCards } from "@/lib/data/public";
import { listPublicProfiles } from "@/lib/data/profiles";

export const metadata: Metadata = {
  title: "Search",
  description:
    "Find UFC events, matchup pages, fighters, and FightLobby members.",
  robots: { index: false, follow: true },
};

interface SearchResult {
  href: string;
  label: string;
  meta: string;
  type: "Event" | "Fight" | "Fighter" | "Member";
}

function matches(query: string, ...values: Array<string | undefined>) {
  const terms = query.split(" ").filter(Boolean);
  const haystack = normalizeSearchText(values.filter(Boolean).join(" "));
  return terms.every((term) => haystack.includes(term));
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const query = normalizeSearchText((await searchParams).q?.trim() ?? "").slice(
    0,
    80,
  );
  const [cards, profiles] = await Promise.all([
    listPublicCards(),
    listPublicProfiles(),
  ]);
  const events = cards.map(({ event }) => event);
  const fights = cards.flatMap(({ fights }) => fights);
  const fighters = [
    ...new Map(
      cards
        .flatMap(({ fighters }) => fighters)
        .map((fighter) => [fighter.id, fighter]),
    ).values(),
  ];
  const results: SearchResult[] = query
    ? [
        ...events
          .filter((event) =>
            matches(query, event.name, event.shortName, event.venue?.city),
          )
          .map((event) => ({
            href: `/events/${event.slug}`,
            label: event.name,
            meta: `${event.promotion.toUpperCase()} event`,
            type: "Event" as const,
          })),
        ...fights
          .filter((fight) =>
            matches(
              query,
              fight.fighterA.name.full,
              fight.fighterB.name.full,
              fight.weightClass,
            ),
          )
          .map((fight) => ({
            href: `/fights/${fight.slug}`,
            label: `${fight.fighterA.name.full} vs ${fight.fighterB.name.full}`,
            meta: fight.weightClass,
            type: "Fight" as const,
          })),
        ...fighters
          .filter((fighter) =>
            matches(
              query,
              fighter.name.full,
              fighter.name.nickname,
              fighter.currentWeightClass,
            ),
          )
          .map((fighter) => ({
            href: `/fighters/${fighter.slug}`,
            label: fighter.name.full,
            meta: fighter.currentWeightClass ?? "UFC fighter",
            type: "Fighter" as const,
          })),
        ...profiles
          .filter((profile) =>
            matches(query, profile.handle, profile.displayName),
          )
          .map((profile) => ({
            href: `/u/${profile.handle}`,
            label: `@${profile.handle}`,
            meta: `${profile.stats.gradedPicks.toLocaleString()} graded picks`,
            type: "Member" as const,
          })),
      ].slice(0, 24)
    : [];

  const icon = {
    Event: CalendarDays,
    Fight: Swords,
    Fighter: UserRound,
    Member: UserRound,
  } as const;

  return (
    <main className="shell py-10 sm:py-14" id="main-content">
      <Breadcrumbs
        items={[{ label: "Home", href: "/" }, { label: "Search" }]}
      />
      <header className="mt-8 max-w-3xl">
        <p className="eyebrow">FightLobby search</p>
        <h1 className="mt-3 font-display text-5xl leading-[.92] font-extrabold sm:text-7xl">
          FIND YOUR FIGHT
        </h1>
        <p className="mt-4 text-base leading-7 text-fl-text-muted">
          Search UFC events, matchup pages, fighters, and public member handles.
        </p>
      </header>

      <form
        action="/search"
        className="mt-8 flex max-w-3xl gap-3"
        role="search"
      >
        <label className="sr-only" htmlFor="site-search">
          Search FightLobby
        </label>
        <input
          autoFocus
          className="focus-ring min-h-12 min-w-0 flex-1 rounded-xl border border-fl-border bg-fl-surface-1 px-4 text-sm outline-none placeholder:text-fl-text-dim"
          defaultValue={query}
          id="site-search"
          maxLength={80}
          name="q"
          placeholder="Search a fighter, event, matchup, or member…"
          type="search"
        />
        <button
          className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-fl-accent px-5 text-sm font-bold text-fl-bg hover:bg-fl-accent-strong"
          type="submit"
        >
          <Search aria-hidden="true" size={17} />
          <span className="hidden sm:inline">Search</span>
        </button>
      </form>

      {query ? (
        <section
          aria-live="polite"
          className="mt-10"
          aria-label="Search results"
        >
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Results</p>
              <h2 className="mt-2 font-display text-3xl font-bold">
                {results.length > 0
                  ? `${results.length} match${results.length === 1 ? "" : "es"}`
                  : "No matches yet"}
              </h2>
            </div>
            <p className="text-sm text-fl-text-muted">“{query}”</p>
          </div>
          {results.length > 0 ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {results.map((result) => {
                const ResultIcon = icon[result.type];
                return (
                  <Link
                    className="focus-ring group rounded-2xl"
                    href={result.href}
                    key={`${result.type}-${result.href}`}
                  >
                    <Card className="flex h-full items-center gap-4 p-4 transition group-hover:border-fl-accent/60 group-hover:bg-fl-surface-2">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-fl-accent-soft text-fl-accent">
                        <ResultIcon aria-hidden="true" size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="eyebrow">{result.type}</span>
                        <span className="mt-1 block truncate text-sm font-bold">
                          {result.label}
                        </span>
                        <span className="mt-1 block text-xs text-fl-text-muted">
                          {result.meta}
                        </span>
                      </span>
                      <ArrowRight
                        aria-hidden="true"
                        className="shrink-0 text-fl-text-dim transition group-hover:translate-x-1 group-hover:text-fl-accent"
                        size={16}
                      />
                    </Card>
                  </Link>
                );
              })}
            </div>
          ) : (
            <Card className="mt-5 p-6">
              <p className="text-sm text-fl-text-muted">
                Try a fighter surname, UFC event name, matchup, or member
                handle.
              </p>
            </Card>
          )}
        </section>
      ) : (
        <Card className="mt-10 p-6">
          <h2 className="font-display text-2xl font-bold">Start with a name</h2>
          <p className="mt-2 text-sm text-fl-text-muted">
            You can also browse every currently published card from the events
            page.
          </p>
          <Link
            className="focus-ring mt-5 inline-flex items-center gap-2 rounded-lg text-sm font-bold text-fl-accent"
            href="/events"
          >
            Browse UFC events <ArrowRight aria-hidden="true" size={15} />
          </Link>
        </Card>
      )}
    </main>
  );
}
