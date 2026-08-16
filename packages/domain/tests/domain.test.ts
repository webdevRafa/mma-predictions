import { describe, expect, it } from "vitest";

import {
  canonicalSlug,
  normalizeSearchText,
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
      confidence: 70,
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0]?.path).toEqual(["detail"]);
  });
});
