import type { Event } from "@fightlobby/domain";
import { describe, expect, it } from "vitest";

import { selectFeaturedEvent } from "../lib/events/featured-event";

function event(id: string, status: Event["status"], startsAt: string): Event {
  return { id, status, startsAt } as Event;
}

describe("selectFeaturedEvent", () => {
  const renderedAt = Date.parse("2026-08-23T12:00:00.000Z");

  it("selects the nearest future card even when events arrive newest first", () => {
    const events = [
      event("far", "scheduled", "2026-09-12T10:00:00.000Z"),
      event("next", "scheduled", "2026-08-29T10:00:00.000Z"),
      event("last", "completed", "2026-08-23T00:00:00.000Z"),
    ];

    expect(selectFeaturedEvent(events, renderedAt)?.id).toBe("next");
  });

  it("prioritizes a live card over future cards", () => {
    const events = [
      event("next", "scheduled", "2026-08-29T10:00:00.000Z"),
      event("live", "live", "2026-08-23T11:00:00.000Z"),
    ];

    expect(selectFeaturedEvent(events, renderedAt)?.id).toBe("live");
  });

  it("falls back to the newest completed card when nothing is active", () => {
    const events = [
      event("older", "completed", "2026-08-15T10:00:00.000Z"),
      event("newer", "completed", "2026-08-22T10:00:00.000Z"),
    ];

    expect(selectFeaturedEvent(events, renderedAt)?.id).toBe("newer");
  });
});
