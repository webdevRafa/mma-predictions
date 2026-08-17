import type { Fighter } from "@fightlobby/domain";

import { Card, CardHeader } from "@/components/ui/card";

function metric(
  value: number | undefined,
  format: "number" | "percentage" = "number",
) {
  if (value === undefined) return "—";
  return format === "percentage"
    ? `${Math.round(value * 100)}%`
    : value.toFixed(1);
}

function measurement(value: number | undefined) {
  if (value === undefined) return "—";
  const inches = Math.round(value / 2.54);
  return `${Math.floor(inches / 12)}′${inches % 12}″ · ${Math.round(value)} cm`;
}

export function StatsComparison({
  fighterA,
  fighterB,
}: {
  fighterA: Fighter;
  fighterB: Fighter;
}) {
  const rows = [
    ["Height", measurement(fighterA.heightCm), measurement(fighterB.heightCm)],
    ["Reach", measurement(fighterA.reachCm), measurement(fighterB.reachCm)],
    [
      "Sig. strikes / min",
      metric(fighterA.careerStats?.significantStrikesLandedPerMinute),
      metric(fighterB.careerStats?.significantStrikesLandedPerMinute),
    ],
    [
      "Strike accuracy",
      metric(fighterA.careerStats?.significantStrikeAccuracy, "percentage"),
      metric(fighterB.careerStats?.significantStrikeAccuracy, "percentage"),
    ],
    [
      "Strike defense",
      metric(fighterA.careerStats?.significantStrikeDefense, "percentage"),
      metric(fighterB.careerStats?.significantStrikeDefense, "percentage"),
    ],
    [
      "Takedowns / 15",
      metric(fighterA.careerStats?.takedownsPer15),
      metric(fighterB.careerStats?.takedownsPer15),
    ],
    [
      "Takedown defense",
      metric(fighterA.careerStats?.takedownDefense, "percentage"),
      metric(fighterB.careerStats?.takedownDefense, "percentage"),
    ],
    [
      "Submission attempts / 15",
      metric(fighterA.careerStats?.submissionsPer15),
      metric(fighterB.careerStats?.submissionsPer15),
    ],
  ] as const;

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader eyebrow="Tale of the tape" title="Stats comparison" />
      <div className="max-w-full overflow-x-auto overscroll-x-contain p-5 sm:p-6">
        <table className="w-full min-w-[32rem] border-collapse text-sm">
          <thead>
            <tr className="text-left font-display text-xl">
              <th className="pb-4">{fighterA.name.full}</th>
              <th className="pb-4 text-center text-xs font-semibold text-fl-text-dim uppercase">
                Metric
              </th>
              <th className="pb-4 text-right">{fighterB.name.full}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, a, b]) => (
              <tr className="border-t border-fl-border/70" key={label}>
                <td className="py-3 font-mono font-semibold">{a}</td>
                <th className="px-3 py-3 text-center text-[11px] font-medium text-fl-text-muted">
                  {label}
                </th>
                <td className="py-3 text-right font-mono font-semibold">{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
