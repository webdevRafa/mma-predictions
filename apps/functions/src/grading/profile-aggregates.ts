import {
  calculateStreak,
  deriveBadges,
  type RankingMetrics,
  type StreakOutcome,
} from "@fightlobby/domain";
import { Timestamp, type Firestore } from "firebase-admin/firestore";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function sequenceValue(value: unknown) {
  if (value instanceof Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return numberValue(value);
}

export async function recomputeProfileAggregates(
  firestore: Firestore,
  uid: string,
): Promise<RankingMetrics> {
  const [predictions, championships, seasonRanks] = await Promise.all([
    firestore.collection("predictions").where("uid", "==", uid).get(),
    firestore
      .collection("achievements")
      .doc(uid)
      .collection("eventChampionships")
      .get(),
    firestore
      .collection("achievements")
      .doc(uid)
      .collection("seasonRanks")
      .get(),
  ]);
  let gradedPicks = 0;
  let correctWinners = 0;
  let totalPoints = 0;
  let exactPicks = 0;
  let perfectReads = 0;
  const outcomes: StreakOutcome[] = [];
  for (const document of predictions.docs) {
    const value: unknown = document.data();
    const prediction = record(value);
    if (prediction.status !== "graded") continue;
    const grade = record(prediction.grade);
    const winnerCorrect = grade.winnerCorrect === true;
    const detailCorrect = grade.detailCorrect === true;
    const points = numberValue(grade.points);
    gradedPicks += 1;
    correctWinners += winnerCorrect ? 1 : 0;
    totalPoints += points;
    exactPicks += detailCorrect ? 1 : 0;
    perfectReads += points === 10 ? 1 : 0;
    outcomes.push({
      sequenceAt: sequenceValue(grade.sequenceAt),
      boutOrder: numberValue(grade.boutOrder),
      winnerCorrect,
    });
  }
  const streak = calculateStreak(outcomes);
  const topSeasonPercentile = seasonRanks.docs.reduce<number | undefined>(
    (best, document) => {
      const value: unknown = document.data();
      const percentile = record(value).topPercentile;
      if (percentile !== 1 && percentile !== 10) return best;
      return best === undefined ? percentile : Math.min(best, percentile);
    },
    undefined,
  );
  const stats = {
    gradedPicks,
    correctWinners,
    winnerAccuracy: gradedPicks > 0 ? correctWinners / gradedPicks : 0,
    totalPoints,
    exactPicks,
    currentStreak: streak.current,
    longestStreak: streak.longest,
    eventChampionships: championships.size,
  };
  const badges = deriveBadges({
    gradedPicks,
    perfectReads,
    longestStreak: streak.longest,
    eventChampionships: championships.size,
    ...(topSeasonPercentile === 1 || topSeasonPercentile === 10
      ? { topSeasonPercentile }
      : {}),
  });
  await firestore
    .collection("profiles")
    .doc(uid)
    .set({ stats, badges, updatedAt: Timestamp.now() }, { merge: true });
  return {
    uid,
    gradedPicks,
    correctWinners,
    totalPoints,
    exactPicks,
    currentStreak: streak.current,
  };
}
