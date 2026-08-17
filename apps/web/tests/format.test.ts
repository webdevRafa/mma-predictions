import { describe, expect, it } from "vitest";

import { formatEventDateWithZone } from "../lib/format";

describe("event date formatting", () => {
  it("renders an event instant in the venue timezone", () => {
    expect(
      formatEventDateWithZone(
        "2026-08-23T00:00:00.000Z",
        "America/Los_Angeles",
      ),
    ).toBe("Aug 22, 2026, 5:00 PM PDT");
  });
});
