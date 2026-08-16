import { describe, expect, it } from "vitest";

import { validateAndNormalizeFixture } from "../src/index";

describe("fixture validation", () => {
  it("returns path-specific errors", () => {
    const result = validateAndNormalizeFixture({
      schemaVersion: 1,
      event: { promotion: "bellator" },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.issues.some((issue) => issue.path.startsWith("$.event")),
      ).toBe(true);
    }
  });
});
