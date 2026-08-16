export const LEADERBOARD_CALCULATION_VERSION = 1;
export const SEASON_ACCURACY_MINIMUM_PICKS = 20;

export interface RankingMetrics {
  uid: string;
  gradedPicks: number;
  correctWinners: number;
  totalPoints: number;
  exactPicks: number;
  currentStreak: number;
}

export interface RankedMetrics extends RankingMetrics {
  rank: number;
  rawAccuracy: number;
  wilsonScore?: number;
}

export function wilsonLowerBound(
  correct: number,
  total: number,
  z = 1.959963984540054,
) {
  if (total <= 0) return 0;
  const successes = Math.min(Math.max(correct, 0), total);
  const rate = successes / total;
  const zSquared = z * z;
  const denominator = 1 + zSquared / total;
  const center = rate + zSquared / (2 * total);
  const margin =
    z * Math.sqrt((rate * (1 - rate) + zSquared / (4 * total)) / total);
  return Math.max(0, (center - margin) / denominator);
}

function accuracy(entry: RankingMetrics) {
  return entry.gradedPicks > 0 ? entry.correctWinners / entry.gradedPicks : 0;
}

function ranked(
  entries: RankingMetrics[],
  compare: (left: RankingMetrics, right: RankingMetrics) => number,
) {
  return [...entries].sort(compare).map((entry, index) => ({
    ...entry,
    rank: index + 1,
    rawAccuracy: accuracy(entry),
  }));
}

export function rankPointsBoard(entries: RankingMetrics[]): RankedMetrics[] {
  return ranked(
    entries,
    (left, right) =>
      right.totalPoints - left.totalPoints ||
      right.exactPicks - left.exactPicks ||
      accuracy(right) - accuracy(left) ||
      right.gradedPicks - left.gradedPicks ||
      left.uid.localeCompare(right.uid),
  );
}

export function rankEventBoard(
  entries: RankingMetrics[],
  gradedFightCount: number,
) {
  const minimumPicks = Math.ceil(gradedFightCount * 0.7);
  return {
    minimumPicks,
    entries: rankPointsBoard(
      entries.filter((entry) => entry.gradedPicks >= minimumPicks),
    ),
  };
}

export function rankAccuracyBoard(
  entries: RankingMetrics[],
  minimumPicks = SEASON_ACCURACY_MINIMUM_PICKS,
): RankedMetrics[] {
  return ranked(
    entries.filter((entry) => entry.gradedPicks >= minimumPicks),
    (left, right) =>
      wilsonLowerBound(right.correctWinners, right.gradedPicks) -
        wilsonLowerBound(left.correctWinners, left.gradedPicks) ||
      accuracy(right) - accuracy(left) ||
      right.gradedPicks - left.gradedPicks ||
      left.uid.localeCompare(right.uid),
  ).map((entry) => ({
    ...entry,
    wilsonScore: wilsonLowerBound(entry.correctWinners, entry.gradedPicks),
  }));
}

export function rankStreakBoard(entries: RankingMetrics[]): RankedMetrics[] {
  return ranked(
    entries,
    (left, right) =>
      right.currentStreak - left.currentStreak ||
      right.totalPoints - left.totalPoints ||
      right.gradedPicks - left.gradedPicks ||
      left.uid.localeCompare(right.uid),
  );
}
