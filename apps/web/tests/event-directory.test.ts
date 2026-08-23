import { describe, expect, it } from "vitest";

import { sortEventsNewestFirst } from "../lib/events/directory";

describe("event directory ordering", () => {
  it("lists the furthest future event first without mutating the source", () => {
    const events = [
      { id: "older", startsAt: "2026-08-01T00:00:00.000Z" },
      { id: "future", startsAt: "2026-09-01T00:00:00.000Z" },
      { id: "recent", startsAt: "2026-08-23T00:00:00.000Z" },
    ];

    expect(sortEventsNewestFirst(events).map((event) => event.id)).toEqual([
      "future",
      "recent",
      "older",
    ]);
    expect(events.map((event) => event.id)).toEqual([
      "older",
      "future",
      "recent",
    ]);
  });
});
