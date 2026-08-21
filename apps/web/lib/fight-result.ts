import type { FightResult } from "@fightlobby/domain";

const winnerMethodLabels = {
  ko_tko: "KO/TKO",
  submission: "submission",
  decision_unanimous: "unanimous decision",
  decision_split: "split decision",
  decision_majority: "majority decision",
  dq: "disqualification",
  other: "other result",
} as const;

const noWinnerMethodLabels = {
  draw: "Draw",
  no_contest: "No contest",
  overturned: "Result overturned",
} as const;

function formatRoundTime(seconds: number) {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = String(wholeSeconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function meaningfulMethodDetail(detail: string | undefined, method: string) {
  const trimmed = detail?.trim();
  if (!trimmed) return undefined;

  const methodWords = new Set(method.toLowerCase().match(/[a-z0-9]+/g) ?? []);
  const detailWords = trimmed.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return detailWords.length > 0 &&
    detailWords.every((word) => methodWords.has(word))
    ? undefined
    : trimmed;
}

export function formatFightResult(result: FightResult) {
  const hasWinner = Boolean(result.winnerFighterId);
  const methodLabel = hasWinner
    ? (winnerMethodLabels[result.method as keyof typeof winnerMethodLabels] ??
      "other result")
    : (noWinnerMethodLabels[
        result.method as keyof typeof noWinnerMethodLabels
      ] ?? result.method.replaceAll("_", " "));
  const outcome = hasWinner ? `Wins by ${methodLabel}` : methodLabel;
  const details = [
    meaningfulMethodDetail(result.methodDetail, methodLabel),
    typeof result.round === "number" ? `Round ${result.round}` : undefined,
    typeof result.timeInRoundSeconds === "number"
      ? formatRoundTime(result.timeInRoundSeconds)
      : undefined,
  ].filter((value): value is string => Boolean(value));
  const label = [outcome, ...details].join(" · ");
  return result.official ? label : `Provisional · ${label}`;
}

export function resultBelongsToFighter(
  result: FightResult | undefined,
  fighterId: string,
) {
  return result?.winnerFighterId === fighterId;
}
