import { describe, expect, it } from "vitest";

import {
  scorePredictionV1,
  validatePredictionForFight,
  type FightResult,
  type PredictionPick,
} from "../src/index.ts";

const basePick: PredictionPick = {
  winnerFighterId: "ftr_winner",
  method: "ko_tko",
  detail: 2,
};

function result(overrides: Partial<FightResult> = {}): FightResult {
  return {
    winnerFighterId: "ftr_winner",
    method: "ko_tko",
    round: 2,
    resultVersion: 1,
    official: true,
    updatedAt: "2026-08-16T12:00:00.000Z",
    ...overrides,
  };
}

describe("scoring version 1", () => {
  it("awards five points for only the correct winner", () => {
    expect(
      scorePredictionV1(basePick, result({ method: "submission" })),
    ).toMatchObject({
      status: "graded",
      points: 5,
    });
  });

  it("awards eight points for winner and method", () => {
    expect(scorePredictionV1(basePick, result({ round: 1 }))).toMatchObject({
      status: "graded",
      points: 8,
    });
  });

  it("awards ten points for an exact finish", () => {
    expect(scorePredictionV1(basePick, result())).toMatchObject({
      status: "graded",
      points: 10,
    });
  });

  it("awards ten points for an exact decision subtype", () => {
    expect(
      scorePredictionV1(
        { ...basePick, method: "decision", detail: "split" },
        result({ method: "decision_split", round: undefined }),
      ),
    ).toMatchObject({ status: "graded", points: 10 });
  });

  it("awards zero when the winner is wrong", () => {
    expect(
      scorePredictionV1(
        { ...basePick, winnerFighterId: "ftr_other" },
        result(),
      ),
    ).toMatchObject({ status: "graded", points: 0 });
  });

  it.each(["draw", "no_contest", "overturned"] as const)(
    "voids a %s result",
    (method) =>
      expect(
        scorePredictionV1(
          basePick,
          result({ method, winnerFighterId: undefined }),
        ),
      ).toMatchObject({ status: "void", points: 0 }),
  );
});

describe("fight-aware prediction validation", () => {
  const fight = {
    fighterAId: "ftr_winner",
    fighterBId: "ftr_other",
    scheduledRounds: 3 as const,
  };

  it("accepts a valid matchup prediction", () => {
    expect(validatePredictionForFight(basePick, fight).success).toBe(true);
  });

  it("explains that a winner must be selected", () => {
    expect(
      validatePredictionForFight({ ...basePick, winnerFighterId: "" }, fight),
    ).toEqual({
      success: false,
      message: "Pick a winner before locking in your prediction",
    });
  });

  it("explains that a method must be selected", () => {
    expect(
      validatePredictionForFight({ ...basePick, method: "" }, fight),
    ).toEqual({
      success: false,
      message: "Choose a method before locking in your prediction",
    });
  });

  it("rejects a winner outside the matchup", () => {
    expect(
      validatePredictionForFight(
        { ...basePick, winnerFighterId: "ftr_intruder" },
        fight,
      ),
    ).toMatchObject({
      success: false,
      message: "Winner must be in this matchup",
    });
  });

  it("rejects a finish round beyond the scheduled distance", () => {
    expect(
      validatePredictionForFight({ ...basePick, detail: 4 }, fight),
    ).toMatchObject({ success: false });
  });

  it("rejects the removed other prediction method", () => {
    expect(
      validatePredictionForFight({ ...basePick, method: "other" }, fight),
    ).toMatchObject({
      success: false,
      message: "Choose a method before locking in your prediction",
    });
  });
});
