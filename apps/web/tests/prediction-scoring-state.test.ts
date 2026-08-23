import { describe, expect, it } from "vitest";

import { getMatchScoringPanelMode } from "@/lib/predictions/scoring-state";

describe("match scoring sidebar state", () => {
  it("shows a loading state before prediction state resolves", () => {
    expect(
      getMatchScoringPanelMode({
        lookupState: "loading",
        canSubmit: true,
        hasPrediction: false,
        hasResult: false,
        hasGrade: false,
      }),
    ).toBe("loading");
  });

  it("shows the rules when a new prediction can still be made", () => {
    expect(
      getMatchScoringPanelMode({
        lookupState: "ready",
        canSubmit: true,
        hasPrediction: false,
        hasResult: false,
        hasGrade: false,
      }),
    ).toBe("explainer");
  });

  it("hides the rules when predictions closed without a pick", () => {
    expect(
      getMatchScoringPanelMode({
        lookupState: "ready",
        canSubmit: false,
        hasPrediction: false,
        hasResult: false,
        hasGrade: false,
      }),
    ).toBe("hidden");
  });

  it("keeps the rules visible for a locked ungraded pick", () => {
    expect(
      getMatchScoringPanelMode({
        lookupState: "ready",
        canSubmit: false,
        hasPrediction: true,
        hasResult: false,
        hasGrade: false,
      }),
    ).toBe("explainer");
  });

  it("shows the earned score for a graded pick", () => {
    expect(
      getMatchScoringPanelMode({
        lookupState: "ready",
        canSubmit: false,
        hasPrediction: true,
        hasResult: true,
        hasGrade: true,
      }),
    ).toBe("earned");
  });

  it("shows a processing state if a result arrives before the grade", () => {
    expect(
      getMatchScoringPanelMode({
        lookupState: "ready",
        canSubmit: false,
        hasPrediction: true,
        hasResult: true,
        hasGrade: false,
      }),
    ).toBe("pending");
  });

  it("does not restore the rules after a closed-state lookup error", () => {
    expect(
      getMatchScoringPanelMode({
        lookupState: "error",
        canSubmit: false,
        hasPrediction: false,
        hasResult: true,
        hasGrade: false,
      }),
    ).toBe("hidden");
  });
});
