import { describe, expect, it } from "vitest";

import {
  describeQuickResult,
  findQuickResultOption,
  quickResultGroups,
} from "../lib/admin/quick-results";

const fight = {
  fighterAId: "ftr_alpha",
  fighterAName: "Alpha Fighter",
  fighterBId: "ftr_bravo",
  fighterBName: "Bravo Fighter",
  scheduledRounds: 3,
};

describe("admin quick results", () => {
  it("builds every supported scoring outcome for both fighters", () => {
    const groups = quickResultGroups(fight);
    expect(groups.map((group) => group.label)).toEqual([
      "Alpha Fighter wins",
      "Bravo Fighter wins",
      "No winner",
    ]);
    expect(groups[0]?.options).toHaveLength(11);
    expect(groups[1]?.options).toHaveLength(11);
    expect(groups[2]?.options.map((option) => option.result.method)).toEqual([
      "draw",
      "no_contest",
      "overturned",
    ]);
  });

  it("encodes the selected winner, method, round, and official status", () => {
    expect(findQuickResultOption(fight, "ftr_bravo:submission:2")).toEqual({
      id: "ftr_bravo:submission:2",
      label: "Bravo Fighter — Submission, round 2",
      result: {
        winnerFighterId: "ftr_bravo",
        method: "submission",
        round: 2,
        official: true,
      },
    });
  });

  it("describes an existing result with the same operator-facing label", () => {
    expect(
      describeQuickResult(fight, {
        winnerFighterId: "ftr_alpha",
        method: "decision_split",
        official: true,
      }),
    ).toBe("Alpha Fighter — Split decision");
  });
});
