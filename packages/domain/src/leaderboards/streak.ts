export interface StreakOutcome {
  sequenceAt: string | number;
  boutOrder: number;
  winnerCorrect: boolean;
  void?: boolean;
}

function sequenceNumber(value: string | number) {
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function calculateStreak(outcomes: StreakOutcome[]) {
  const ordered = outcomes
    .filter((outcome) => !outcome.void)
    .sort(
      (left, right) =>
        sequenceNumber(left.sequenceAt) - sequenceNumber(right.sequenceAt) ||
        right.boutOrder - left.boutOrder,
    );
  let current = 0;
  let longest = 0;
  for (const outcome of ordered) {
    current = outcome.winnerCorrect ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return { current, longest };
}
