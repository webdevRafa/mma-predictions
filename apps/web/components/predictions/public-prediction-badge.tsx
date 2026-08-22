import type { PublicPredictionBadge as PublicPredictionBadgeData } from "@fightlobby/domain";

const methodLabels = {
  ko_tko: "KO/TKO",
  submission: "Submission",
  decision: "Decision",
} satisfies Record<PublicPredictionBadgeData["method"], string>;

export function PublicPredictionBadge({
  badge,
}: {
  badge: PublicPredictionBadgeData;
}) {
  const label = `${badge.winnerLastName} by ${methodLabels[badge.method]}`;
  return (
    <span
      aria-label={`Locked prediction: ${label}`}
      className="inline-flex max-w-full items-center rounded-full border border-fl-info/35 bg-fl-info/10 px-2 py-0.5 font-mono text-[9px] font-bold leading-4 tracking-[.035em] text-fl-info whitespace-nowrap"
      title={`Locked prediction: ${label}`}
    >
      {label}
    </span>
  );
}
