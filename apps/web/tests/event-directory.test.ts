import { describe, expect, it } from "vitest";

import { filterEvents, sortEventsNewestFirst } from "../lib/events/directory";

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

describe("event directory search", () => {
  const events = [
    {
      name: "UFC Fight Night: Hernandez vs Rodrigues",
      shortName: "Hernandez vs Rodrigues",
      status: "completed" as const,
      venue: {
        name: "Golden 1 Center",
        city: "Sacramento",
        region: "CA",
        countryCode: "US",
      },
    },
    {
      name: "UFC 331: Lopes vs Silva",
      shortName: "Lopes vs Silva",
      status: "scheduled" as const,
      venue: { name: "T-Mobile Arena", city: "Las Vegas", region: "NV" },
    },
  ];

  it("matches event names and venues without changing their order", () => {
    expect(filterEvents(events, "HERNANDEZ")).toEqual([events[0]]);
    expect(filterEvents(events, "las vegas")).toEqual([events[1]]);
    expect(filterEvents(events, "")).toEqual(events);
  });

  it("requires every search term to match the same event", () => {
    expect(filterEvents(events, "ufc sacramento")).toEqual([events[0]]);
    expect(filterEvents(events, "hernandez vegas")).toEqual([]);
  });
});
