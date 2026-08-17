import { describe, expect, it } from "vitest";

import {
  formatEventDateCompact,
  formatEventDateWithZone,
} from "../lib/format";

describe("event date formatting", () => {
  it("renders an event instant in the venue timezone", () => {
    expect(
      formatEventDateWithZone(
        "2026-08-23T00:00:00.000Z",
        "America/Los_Angeles",
      ),
    ).toBe("Aug 22, 2026, 5:00 PM PDT");
  });

  it.each([
    ["America/New_York", "Sat, Aug 22, 5:00 PM EDT"],
    ["America/Chicago", "Sat, Aug 22, 4:00 PM CDT"],
    ["America/Denver", "Sat, Aug 22, 3:00 PM MDT"],
    ["America/Los_Angeles", "Sat, Aug 22, 2:00 PM PDT"],
    ["America/Anchorage", "Sat, Aug 22, 1:00 PM AKDT"],
    ["Pacific/Honolulu", "Sat, Aug 22, 11:00 AM HST"],
  ])("renders the prelim start in %s", (timeZone, expected) => {
    expect(
      formatEventDateCompact("2026-08-22T21:00:00.000Z", timeZone),
    ).toBe(expected);
  });
});
