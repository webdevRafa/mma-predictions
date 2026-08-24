import { describe, expect, it } from "vitest";

import { isNavigationPathActive } from "./navigation";

describe("isNavigationPathActive", () => {
  it("matches exact routes and their descendants", () => {
    expect(isNavigationPathActive("/events", ["/events"])).toBe(true);
    expect(isNavigationPathActive("/events/fight-night", ["/events"])).toBe(
      true,
    );
    expect(isNavigationPathActive("/events-old", ["/events"])).toBe(false);
  });

  it("keeps the home item exact", () => {
    expect(isNavigationPathActive("/", ["/"])).toBe(true);
    expect(isNavigationPathActive("/events", ["/"])).toBe(false);
  });

  it("supports related route families", () => {
    const eventPaths = ["/events", "/fights", "/fighters"];

    expect(isNavigationPathActive("/fights/umar-vs-song", eventPaths)).toBe(
      true,
    );
    expect(
      isNavigationPathActive("/fighters/umar-nurmagomedov", eventPaths),
    ).toBe(true);
  });
});
