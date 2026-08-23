import { describe, expect, it } from "vitest";

import {
  eventCountdownLabel,
  eventPhaseLabel,
  getEventTimingPhase,
  heroEventCountdownRows,
} from "../lib/events/timing";

const event = {
  status: "scheduled" as const,
  startsAt: "2026-08-23T00:00:00.000Z",
  prelimsStartsAt: "2026-08-22T21:00:00.000Z",
  mainCardStartsAt: "2026-08-23T00:00:00.000Z",
};

describe("event timing", () => {
  it("uses the prelim start for the upcoming-to-live transition", () => {
    const before = Date.parse("2026-08-22T20:59:59.000Z");
    const atPrelims = Date.parse("2026-08-22T21:00:00.000Z");

    expect(eventPhaseLabel(getEventTimingPhase(event, before))).toBe(
      "Next UFC event",
    );
    expect(eventPhaseLabel(getEventTimingPhase(event, atPrelims))).toBe(
      "Happening now",
    );
  });

  it("switches to a second-by-second clock inside 24 hours", () => {
    const now = Date.parse("2026-08-22T20:00:00.000Z");
    expect(eventCountdownLabel(event, now)).toBe("01:00:00 until prelims");
  });

  it("counts down to the main card while prelims are live", () => {
    const now = Date.parse("2026-08-22T22:15:00.000Z");
    expect(eventCountdownLabel(event, now)).toBe(
      "Prelims live · main card in 01:45:00",
    );
  });

  it("provides separate prelim and main-card countdown rows", () => {
    const now = Date.parse("2026-08-20T21:00:00.000Z");
    expect(heroEventCountdownRows(event, now)).toEqual([
      {
        label: "Prelims",
        value: "2d 0h until prelims",
        dateTime: event.prelimsStartsAt,
      },
      {
        label: "Main card",
        value: "2d 3h until main card",
        dateTime: event.mainCardStartsAt,
      },
    ]);
  });

  it("keeps both hero rows meaningful as the event progresses", () => {
    const duringPrelims = Date.parse("2026-08-22T22:15:00.000Z");
    expect(
      heroEventCountdownRows(event, duringPrelims).map((row) => row.value),
    ).toEqual(["Live now", "01:45:00 until main card"]);
  });

  it("lets terminal event states override clock-derived live state", () => {
    const now = Date.parse("2026-08-22T22:15:00.000Z");
    expect(eventCountdownLabel({ ...event, status: "completed" }, now)).toBe(
      "Official results posted",
    );
    expect(
      eventPhaseLabel(
        getEventTimingPhase({ ...event, status: "postponed" }, now),
      ),
    ).toBe("Event postponed");
  });
});
