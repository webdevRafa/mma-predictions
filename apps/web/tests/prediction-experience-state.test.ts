import { describe, expect, it } from "vitest";

import {
  getPredictionPanelMode,
  isPredictionSubmissionDisabled,
} from "@/lib/predictions/experience-state";

describe("prediction experience panel state", () => {
  it("shows the saved receipt after the fight locks", () => {
    expect(getPredictionPanelMode(true, false)).toBe("saved");
  });

  it("shows the compact locked notice when no pick was saved", () => {
    expect(getPredictionPanelMode(false, false)).toBe("locked");
  });

  it("shows the prediction form while a new pick is allowed", () => {
    expect(getPredictionPanelMode(false, true)).toBe("form");
  });

  it("always gives an existing saved prediction precedence", () => {
    expect(getPredictionPanelMode(true, true)).toBe("saved");
  });
});

describe("prediction submission state", () => {
  it("stays disabled until a winner is selected", () => {
    expect(
      isPredictionSubmissionDisabled({
        busy: false,
        canSubmit: true,
        winnerFighterId: "",
      }),
    ).toBe(true);
  });

  it("enables after a winner is selected for an open fight", () => {
    expect(
      isPredictionSubmissionDisabled({
        busy: false,
        canSubmit: true,
        winnerFighterId: "fighter-1",
      }),
    ).toBe(false);
  });

  it("remains disabled while saving or after predictions close", () => {
    expect(
      isPredictionSubmissionDisabled({
        busy: true,
        canSubmit: true,
        winnerFighterId: "fighter-1",
      }),
    ).toBe(true);
    expect(
      isPredictionSubmissionDisabled({
        busy: false,
        canSubmit: false,
        winnerFighterId: "fighter-1",
      }),
    ).toBe(true);
  });
});
