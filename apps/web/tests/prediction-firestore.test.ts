import { describe, expect, it } from "vitest";

import {
  assertPredictionSubmissionOpen,
  predictionShardId,
} from "../lib/predictions/firestore.ts";
import { shouldRevealConsensus } from "../lib/predictions/consensus-visibility.ts";

describe("server prediction lock policy", () => {
  const openFight = {
    status: "scheduled",
    predictionStatus: "open",
    predictionsLockedAt: "2026-08-16T20:00:00.000Z",
    dataQuality: "complete",
  };

  it("allows server time before the lock", () => {
    expect(() =>
      assertPredictionSubmissionOpen(
        openFight,
        Date.parse("2026-08-16T19:59:59.000Z"),
      ),
    ).not.toThrow();
  });

  it("rejects server time at the lock", () => {
    expect(() =>
      assertPredictionSubmissionOpen(
        openFight,
        Date.parse("2026-08-16T20:00:00.000Z"),
      ),
    ).toThrow("Predictions are locked");
  });

  it.each(["walkouts", "intros", "in_progress", "completed"])(
    "rejects provider status %s",
    (status) =>
      expect(() =>
        assertPredictionSubmissionOpen(
          { ...openFight, status },
          Date.parse("2026-08-16T19:00:00.000Z"),
        ),
      ).toThrow("Predictions are locked"),
  );
});

describe("prediction counter shard selection", () => {
  it("is deterministic and stays within the configured shard range", () => {
    expect(predictionShardId("member_a")).toBe(predictionShardId("member_a"));
    expect(predictionShardId("member_a")).toMatch(/^shard_(0\d|1\d)$/);
  });
});

describe("community consensus privacy", () => {
  const scheduledFight = { status: "scheduled" as const, result: undefined };
  const completedFight = {
    status: "completed" as const,
    result: {
      winnerFighterId: "fighter_a",
      method: "decision_unanimous" as const,
      resultVersion: 1,
      official: true,
      updatedAt: "2026-08-23T03:00:00.000Z",
    },
  };

  it("keeps an open matchup private before the viewer predicts", () => {
    expect(
      shouldRevealConsensus({
        fight: scheduledFight,
        hasOwnPrediction: false,
      }),
    ).toBe(false);
  });

  it("reveals consensus after the viewer predicts", () => {
    expect(
      shouldRevealConsensus({
        fight: scheduledFight,
        hasOwnPrediction: true,
      }),
    ).toBe(true);
  });

  it("reveals consensus to non-voters after an official result is posted", () => {
    expect(
      shouldRevealConsensus({
        fight: completedFight,
        hasOwnPrediction: false,
      }),
    ).toBe(true);
  });

  it("does not reveal consensus for a provisional result", () => {
    expect(
      shouldRevealConsensus({
        fight: {
          ...completedFight,
          result: { ...completedFight.result, official: false },
        },
        hasOwnPrediction: false,
      }),
    ).toBe(false);
  });
});
