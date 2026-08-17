import { describe, expect, it } from "vitest";

import {
  canonicalSlug,
  normalizeSearchText,
  parseStoredPredictionPick,
  predictionPickSchema,
} from "../src/index";

describe("domain normalization", () => {
  it("normalizes diacritics for search and keeps an immutable ID suffix", () => {
    expect(normalizeSearchText("José Álvarez")).toBe("jose alvarez");
    expect(canonicalSlug("José Álvarez", "ftr_ABC123")).toBe(
      "jose-alvarez-abc123",
    );
  });

  it("requires a method-specific finish detail", () => {
    const result = predictionPickSchema.safeParse({
      winnerFighterId: "ftr_1",
      method: "submission",
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0]?.path).toEqual(["detail"]);
  });

  it("rejects confidence in new input but tolerates it in legacy storage", () => {
    const legacy = {
      winnerFighterId: "ftr_1",
      method: "decision",
      detail: "split",
      confidence: 75,
    };
    expect(predictionPickSchema.safeParse(legacy).success).toBe(false);
    expect(parseStoredPredictionPick(legacy)).toEqual({
      winnerFighterId: "ftr_1",
      method: "decision",
      detail: "split",
    });
  });
});
