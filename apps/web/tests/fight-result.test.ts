import type { FightResult } from "@fightlobby/domain";
import { describe, expect, it } from "vitest";

import { formatFightResult, resultBelongsToFighter } from "../lib/fight-result";

function result(overrides: Partial<FightResult> = {}): FightResult {
  return {
    winnerFighterId: "fighter-a",
    method: "ko_tko",
    resultVersion: 1,
    official: true,
    updatedAt: "2026-08-21T00:00:00.000Z",
    ...overrides,
  };
}

describe("public fight result display", () => {
  it("formats a stoppage with round and official clock time", () => {
    expect(
      formatFightResult(result({ round: 2, timeInRoundSeconds: 167 })),
    ).toBe("Wins by KO/TKO · Round 2 · 2:47");
  });

  it("formats decision and method detail clearly", () => {
    expect(
      formatFightResult(
        result({
          method: "decision_split",
          methodDetail: "29–28, 28–29, 29–28",
        }),
      ),
    ).toBe("Wins by split decision · 29–28, 28–29, 29–28");
  });

  it("does not repeat a provider method label as method detail", () => {
    expect(formatFightResult(result({ methodDetail: "TKO" }))).toBe(
      "Wins by KO/TKO",
    );
  });

  it("formats no-winner and provisional outcomes without assigning a fighter", () => {
    const noContest = result({
      winnerFighterId: undefined,
      method: "no_contest",
      official: false,
      round: 1,
      timeInRoundSeconds: 44,
    });
    expect(formatFightResult(noContest)).toBe(
      "Provisional · No contest · Round 1 · 0:44",
    );
    expect(resultBelongsToFighter(noContest, "fighter-a")).toBe(false);
  });

  it("matches the badge only to the recorded winner", () => {
    const winner = result();
    expect(resultBelongsToFighter(winner, "fighter-a")).toBe(true);
    expect(resultBelongsToFighter(winner, "fighter-b")).toBe(false);
  });
});
