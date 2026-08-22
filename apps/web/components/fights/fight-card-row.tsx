import type { Fight } from "@fightlobby/domain";
import { ArrowUpRight, MessageCircle } from "lucide-react";
import Link from "next/link";

import { FightResultBadge } from "@/components/fights/fight-result-badge";
import { LiveStatusFragment } from "@/components/live/live-status-fragment";
import { Badge } from "@/components/ui/badge";
import { resultBelongsToFighter } from "@/lib/fight-result";
import { formatRecord } from "@/lib/format";

export function FightCardRow({
  fight,
  featuredLabel,
}: {
  fight: Fight;
  featuredLabel?: "Main event" | "Co-main event";
}) {
  const fighterAWon = resultBelongsToFighter(fight.result, fight.fighterAId);
  const fighterBWon = resultBelongsToFighter(fight.result, fight.fighterBId);
  const noWinnerResult =
    fight.result && !fight.result.winnerFighterId ? fight.result : undefined;

  return (
    <article className="group border-b border-fl-border/80 p-4 last:border-b-0 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {featuredLabel ? (
            <span className="font-mono text-[10px] font-semibold tracking-[0.1em] text-fl-accent uppercase">
              {featuredLabel}
            </span>
          ) : null}
          {fight.isTitleFight ? <Badge tone="accent">Title fight</Badge> : null}
          {noWinnerResult ? <FightResultBadge result={noWinnerResult} /> : null}
        </div>
        <LiveStatusFragment
          collection="fights"
          id={fight.id}
          initialStatus={fight.status}
        />
      </div>
      <Link
        aria-label={`${fight.fighterA.name.full} versus ${fight.fighterB.name.full}`}
        className="focus-ring mt-4 grid rounded-xl md:grid-cols-[1fr_auto_1fr_auto] md:items-center md:gap-5"
        href={`/fights/${fight.slug}`}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-2xl leading-none font-bold transition group-hover:text-fl-accent">
              {fight.fighterA.name.full}
            </h3>
            {fighterAWon && fight.result ? (
              <FightResultBadge result={fight.result} />
            ) : null}
          </div>
          <p className="mt-1 font-mono text-[11px] text-fl-text-muted">
            {formatRecord(fight.fighterA.record)}
          </p>
        </div>
        <div className="my-3 flex items-center gap-3 text-fl-text-dim md:my-0">
          <span className="h-px flex-1 bg-fl-border md:hidden" />
          <span className="font-display text-sm font-bold">VS</span>
          <span className="h-px flex-1 bg-fl-border md:hidden" />
        </div>
        <div className="min-w-0 md:text-right">
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            {fighterBWon && fight.result ? (
              <FightResultBadge
                className="order-2 md:order-1"
                result={fight.result}
              />
            ) : null}
            <h3 className="order-1 font-display text-2xl leading-none font-bold transition group-hover:text-fl-accent md:order-2">
              {fight.fighterB.name.full}
            </h3>
          </div>
          <p className="mt-1 font-mono text-[11px] text-fl-text-muted">
            {formatRecord(fight.fighterB.record)}
          </p>
        </div>
        <ArrowUpRight
          aria-hidden="true"
          className="hidden text-fl-text-dim transition group-hover:text-fl-accent md:block"
          size={20}
        />
      </Link>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-fl-border/60 pt-3 text-xs text-fl-text-muted">
        <span>
          {fight.weightClass} · {fight.scheduledRounds} rounds
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase">
          <MessageCircle aria-hidden="true" size={13} />{" "}
          {fight.predictionSummary.total.toLocaleString()} picks
        </span>
      </div>
    </article>
  );
}
