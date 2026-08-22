import type { Fight, PredictionSummary } from "@fightlobby/domain";
import { EyeOff, UsersRound } from "lucide-react";

import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { percentage } from "@/lib/format";

const methodRows = [
  { key: "ko_tko", label: "KO / TKO" },
  { key: "submission", label: "Submission" },
  { key: "decision", label: "Decision" },
] as const;

function fighterLabel(fight: Fight, side: "fighterA" | "fighterB") {
  const fighter = side === "fighterA" ? fight.fighterA : fight.fighterB;
  return fighter.name.last ?? fighter.name.full;
}

function FighterConsensus({
  fight,
  summary,
  side,
}: {
  fight: Fight;
  summary: PredictionSummary;
  side: "fighterA" | "fighterB";
}) {
  const isRight = side === "fighterB";
  const fighterName = fighterLabel(fight, side);
  const fighterTotal = summary[side];
  const methods = summary.methodsByFighter?.[side] ?? {};
  const rounds = summary.roundsByFighter?.[side] ?? {};
  const roundNumbers = Array.from(
    { length: fight.scheduledRounds },
    (_, index) => index + 1,
  );

  return (
    <section
      aria-label={`${fighterName} prediction breakdown`}
      className={cn(
        "pt-5 md:pt-0",
        isRight
          ? "border-t border-fl-border md:border-l md:border-t-0 md:pl-7"
          : "md:pr-7",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3",
          isRight && "md:flex-row-reverse",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "h-8 w-1 rounded-full",
            isRight ? "bg-fl-info" : "bg-fl-accent",
          )}
        />
        <div className={cn(isRight && "md:text-right")}>
          <h3 className="font-display text-xl font-bold">{fighterName}</h3>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-fl-text-muted">
            {percentage(fighterTotal, summary.total)}% of community picks
          </p>
        </div>
      </div>

      <div className="mt-5">
        <p className={cn("eyebrow", isRight && "md:text-right")}>
          Method calls
        </p>
        <dl className="mt-3 space-y-2.5">
          {methodRows.map((method) => (
            <div
              className={cn(
                "flex items-center justify-between gap-4 text-xs",
                isRight && "md:flex-row-reverse",
              )}
              key={method.key}
            >
              <dt className="text-fl-text-muted">{method.label}</dt>
              <dd className="font-mono font-semibold">
                {percentage(methods[method.key] ?? 0, summary.total)}%
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-5">
        <p className={cn("eyebrow", isRight && "md:text-right")}>
          Finish rounds
        </p>
        <div
          aria-label={`${fighterName} finish round distribution`}
          className={cn(
            "mt-3 flex flex-wrap items-center gap-y-2 font-mono text-[10px] font-semibold",
            isRight && "md:justify-end",
          )}
        >
          {roundNumbers.map((round, index) => (
            <span
              className={cn(index > 0 && "ml-3 border-l border-fl-border pl-3")}
              key={round}
            >
              <span className="text-fl-text-muted">R{round}</span>
              <span aria-hidden="true" className="mx-1 text-fl-text-dim">
                ·
              </span>
              {percentage(rounds[String(round)] ?? 0, summary.total)}%
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ConsensusCard({
  fight,
  reveal: revealOverride,
  summary: summaryOverride,
}: {
  fight: Fight;
  reveal?: boolean;
  summary?: PredictionSummary;
}) {
  const summary = summaryOverride ?? fight.predictionSummary;
  const reveal = revealOverride ?? false;
  const fighterAPercentage = percentage(summary.fighterA, summary.total);
  const fighterBPercentage = percentage(summary.fighterB, summary.total);

  return (
    <Card className="mt-6">
      <CardHeader eyebrow="Community read" title="Consensus" />
      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-fl-accent-soft text-fl-accent">
            <UsersRound aria-hidden="true" size={19} />
          </span>
          <div>
            <p className="font-display text-2xl font-bold">
              {summary.total.toLocaleString()}
            </p>
            <p className="text-xs text-fl-text-muted">community predictions</p>
          </div>
        </div>
        {reveal ? (
          <div className="mt-6">
            <div className="flex justify-between gap-4 font-display text-xl font-bold">
              <span>
                {fighterAPercentage}% {fighterLabel(fight, "fighterA")}
              </span>
              <span className="text-right">
                {fighterBPercentage}% {fighterLabel(fight, "fighterB")}
              </span>
            </div>
            <div
              className="mt-3 flex h-2 overflow-hidden rounded-full bg-fl-surface-3"
              aria-label={`Community split: ${fighterAPercentage}% for ${fighterLabel(fight, "fighterA")} and ${fighterBPercentage}% for ${fighterLabel(fight, "fighterB")}`}
            >
              <span
                className="bg-fl-accent"
                style={{ width: `${fighterAPercentage}%` }}
              />
              <span
                className="bg-fl-info"
                style={{ width: `${fighterBPercentage}%` }}
              />
            </div>

            <p className="mt-4 text-[11px] leading-5 text-fl-text-dim">
              Method and round percentages show each call as a share of all
              community predictions.
            </p>
            <div className="mt-5 grid gap-5 md:grid-cols-2 md:gap-0">
              <FighterConsensus
                fight={fight}
                side="fighterA"
                summary={summary}
              />
              <FighterConsensus
                fight={fight}
                side="fighterB"
                summary={summary}
              />
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed border-fl-border bg-fl-surface-2 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <EyeOff aria-hidden="true" size={16} /> Make your pick to reveal
              the split
            </p>
            <p className="mt-1 text-xs leading-5 text-fl-text-muted">
              The count is public. The lean stays behind the curtain until you
              lock in your own prediction.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
