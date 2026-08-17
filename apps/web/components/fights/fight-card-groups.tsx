import type { Fight } from "@fightlobby/domain";

import { FightCardRow } from "@/components/fights/fight-card-row";
import { Card } from "@/components/ui/card";
import { formatCardSegment } from "@/lib/format";

const segments = ["main_card", "prelims", "early_prelims"] as const;

export function FightCardGroups({ fights }: { fights: Fight[] }) {
  const orderedFights = [...fights].sort(
    (fightA, fightB) => fightA.boutOrder - fightB.boutOrder,
  );
  const mainEventId = orderedFights[0]?.id;
  const coMainEventId = orderedFights[1]?.id;

  return (
    <div className="space-y-6">
      {segments.map((segment) => {
        const segmentFights = fights
          .filter((fight) => fight.cardSegment === segment)
          .sort((a, b) => a.boutOrder - b.boutOrder);
        if (segmentFights.length === 0) return null;
        return (
          <section aria-labelledby={`segment-${segment}`} key={segment}>
            <div className="mb-3 flex items-end justify-between gap-4">
              <h2
                className="font-display text-3xl font-bold"
                id={`segment-${segment}`}
              >
                {formatCardSegment(segment)}
              </h2>
              <span className="font-mono text-[10px] tracking-[0.1em] text-fl-text-dim uppercase">
                {segmentFights.length}{" "}
                {segmentFights.length === 1 ? "fight" : "fights"}
              </span>
            </div>
            <Card className="overflow-hidden">
              {segmentFights.map((fight) => {
                const featuredLabel =
                  fight.id === mainEventId
                    ? "Main event"
                    : fight.id === coMainEventId
                      ? "Co-main event"
                      : undefined;

                return (
                  <FightCardRow
                    fight={fight}
                    key={fight.id}
                    {...(featuredLabel ? { featuredLabel } : {})}
                  />
                );
              })}
            </Card>
          </section>
        );
      })}
    </div>
  );
}
