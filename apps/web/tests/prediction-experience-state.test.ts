import { describe, expect, it } from "vitest";

import { getPredictionPanelMode } from "@/lib/predictions/experience-state";

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
