import { describe, expect, it } from "vitest";

import {
  calculateStreak,
  deriveBadges,
  rankAccuracyBoard,
  rankEventBoard,
  rankPointsBoard,
  wilsonLowerBound,
  type RankingMetrics,
} from "../src/index.ts";

const entries: RankingMetrics[] = [
  {
    uid: "steady",
    gradedPicks: 100,
    correctWinners: 70,
    totalPoints: 620,
    exactPicks: 18,
    currentStreak: 4,
  },
  {
    uid: "perfect_small",
    gradedPicks: 20,
    correctWinners: 20,
    totalPoints: 200,
    exactPicks: 20,
    currentStreak: 20,
  },
  {
    uid: "too_small",
    gradedPicks: 4,
    correctWinners: 4,
    totalPoints: 40,
    exactPicks: 4,
    currentStreak: 4,
  },
];

describe("leaderboard ranking", () => {
  it("uses the complete deterministic points tie-break order", () => {
    expect(rankPointsBoard(entries).map((entry) => entry.uid)).toEqual([
      "steady",
      "perfect_small",
      "too_small",
    ]);
  });

  it("filters the accuracy board and ranks by Wilson lower bound", () => {
    const board = rankAccuracyBoard(entries);
    expect(board.map((entry) => entry.uid)).toEqual([
      "perfect_small",
      "steady",
    ]);
    expect(board.every((entry) => entry.wilsonScore !== undefined)).toBe(true);
    expect(wilsonLowerBound(0, 0)).toBe(0);
  });

  it("requires picks for at least 70 percent of graded event fights", () => {
    const board = rankEventBoard(entries, 10);
    expect(board.minimumPicks).toBe(7);
    expect(board.entries.map((entry) => entry.uid)).not.toContain("too_small");
  });
});

describe("streak recalculation", () => {
  it("orders by event time, treats higher bout order as earlier, and ignores voids", () => {
    expect(
      calculateStreak([
        { sequenceAt: 1000, boutOrder: 3, winnerCorrect: true },
        { sequenceAt: 1000, boutOrder: 2, winnerCorrect: true },
        { sequenceAt: 1000, boutOrder: 1, winnerCorrect: false, void: true },
        { sequenceAt: 2000, boutOrder: 1, winnerCorrect: true },
      ]),
    ).toEqual({ current: 3, longest: 3 });
  });

  it("recomputes current and longest streaks after a correction", () => {
    expect(
      calculateStreak([
        { sequenceAt: 1000, boutOrder: 2, winnerCorrect: true },
        { sequenceAt: 1000, boutOrder: 1, winnerCorrect: false },
      ]),
    ).toEqual({ current: 0, longest: 1 });
  });
});

describe("badge derivation", () => {
  it("assigns version-one achievement badges from reconciled totals", () => {
    expect(
      deriveBadges({
        gradedPicks: 22,
        perfectReads: 2,
        longestStreak: 10,
        eventChampionships: 1,
        topSeasonPercentile: 1,
      }),
    ).toEqual([
      "First Pick",
      "Perfect Read",
      "Five-Fight Streak",
      "Ten-Fight Streak",
      "Event Champion",
      "Top 10% Season",
      "Top 1% Season",
    ]);
  });
});
