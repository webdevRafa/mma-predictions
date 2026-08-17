import type { Fight, PredictionSummary } from "@fightlobby/domain";
import { EyeOff, UsersRound } from "lucide-react";

import { Card, CardHeader } from "@/components/ui/card";
import { percentage } from "@/lib/format";

const methodLabels: Record<string, string> = {
  ko_tko: "KO/TKO",
  submission: "Submission",
  decision: "Decision",
  other: "Other",
};

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
  const reveal = revealOverride ?? fight.predictionStatus !== "open";
  const fighterAPercentage = percentage(summary.fighterA, summary.total);
  const fighterBPercentage = percentage(summary.fighterB, summary.total);
  const methodEntries = Object.entries(summary.methods).filter(
    ([, count]) => count > 0,
  );
  const roundEntries = Object.entries(summary.rounds).filter(
    ([key, count]) => /^\d$/.test(key) && count > 0,
  );

  return (
    <Card>
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
                {fighterAPercentage}%{" "}
                {fight.fighterA.name.last ?? fight.fighterA.name.full}
              </span>
              <span>
                {fighterBPercentage}%{" "}
                {fight.fighterB.name.last ?? fight.fighterB.name.full}
              </span>
            </div>
            <div
              className="mt-3 flex h-2 overflow-hidden rounded-full bg-fl-surface-3"
              aria-label={`Community split: ${fighterAPercentage}% to ${fighterBPercentage}%`}
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
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div>
                <p className="eyebrow">Method calls</p>
                <div className="mt-3 space-y-2">
                  {methodEntries.map(([method, count]) => (
                    <div
                      className="flex items-center justify-between gap-3 text-xs"
                      key={method}
                    >
                      <span className="text-fl-text-muted">
                        {methodLabels[method] ?? method}
                      </span>
                      <span className="font-mono font-semibold">
                        {percentage(count, summary.total)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="eyebrow">Finish rounds</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {roundEntries.length > 0 ? (
                    roundEntries.map(([round, count]) => (
                      <span
                        className="rounded-md border border-fl-border bg-fl-surface-2 px-2.5 py-1.5 font-mono text-[10px]"
                        key={round}
                      >
                        R{round} · {percentage(count, summary.total)}%
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-fl-text-dim">
                      No round calls yet
                    </span>
                  )}
                </div>
              </div>
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
              participate or picks lock.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
