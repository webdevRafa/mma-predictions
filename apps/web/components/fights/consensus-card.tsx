import type { Fight } from "@fightlobby/domain";
import { EyeOff, UsersRound } from "lucide-react";

import { Card, CardHeader } from "@/components/ui/card";
import { percentage } from "@/lib/format";

export function ConsensusCard({ fight }: { fight: Fight }) {
  const reveal = fight.predictionStatus !== "open";
  const fighterAPercentage = percentage(
    fight.predictionSummary.fighterA,
    fight.predictionSummary.total,
  );
  const fighterBPercentage = percentage(
    fight.predictionSummary.fighterB,
    fight.predictionSummary.total,
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
              {fight.predictionSummary.total.toLocaleString()}
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
