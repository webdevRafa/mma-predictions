import { describe, expect, it } from "vitest";

import {
  formatEventDateCompact,
  formatEventDateWithZone,
  formatHeightMeasurement,
  formatReachMeasurement,
} from "../lib/format";

describe("fighter measurement formatting", () => {
  it("formats height in feet, inches, and centimeters", () => {
    expect(formatHeightMeasurement(180.34)).toBe("5′11″ · 180 cm");
  });

  it("formats reach in inches and centimeters", () => {
    expect(formatReachMeasurement(198.12)).toBe("78 in · 198 cm");
  });

  it("preserves official half-inch reach measurements", () => {
    expect(formatReachMeasurement(196.85)).toBe("77.5 in · 197 cm");
  });

  it("does not estimate missing measurements", () => {
    expect(formatHeightMeasurement(undefined)).toBe("—");
    expect(formatReachMeasurement(undefined)).toBe("—");
  });
});

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
    expect(formatEventDateCompact("2026-08-22T21:00:00.000Z", timeZone)).toBe(
      expected,
    );
  });
});
