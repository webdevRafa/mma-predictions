import { describe, expect, it } from "vitest";

import {
  assertPredictionSubmissionOpen,
  predictionShardId,
  shouldRevealConsensus,
} from "../lib/predictions/firestore.ts";

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
  it("reveals consensus only after the viewer has made a prediction", () => {
    expect(shouldRevealConsensus(false)).toBe(false);
    expect(shouldRevealConsensus(true)).toBe(true);
  });
});
