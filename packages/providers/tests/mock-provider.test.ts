import { describe, expect, it } from "vitest";

import { MockMmaProvider } from "../src/index";

const fixture = {
  schemaVersion: 1,
  generatedAt: "2026-08-16T12:00:00.000Z",
  source: { provider: "mock", externalEventId: "demo" },
  event: {
    id: "evt_test_001",
    promotion: "ufc",
    name: "UFC Test",
    shortName: "UFC Test",
    slug: "ufc-test-test-a-vs-test-b-001",
    slugHistory: [],
    status: "scheduled",
    startsAt: "2026-09-01T23:00:00.000Z",
    venueTimezone: "America/New_York",
  },
  fighters: [
    {
      id: "ftr_test_a",
      slug: "test-a-testa",
      slugHistory: [],
      name: { full: "Test A", normalized: "test a" },
      record: { wins: 1, losses: 0, draws: 0, noContests: 0 },
    },
    {
      id: "ftr_test_b",
      slug: "test-b-testb",
      slugHistory: [],
      name: { full: "Test B", normalized: "test b" },
      record: { wins: 1, losses: 0, draws: 0, noContests: 0 },
    },
  ],
  fights: [
    {
      id: "fgt_test_001",
      slug: "test-a-vs-test-b-001",
      slugHistory: [],
      eventId: "evt_test_001",
      fighterAId: "ftr_test_a",
      fighterBId: "ftr_test_b",
      cardSegment: "main_card",
      boutOrder: 1,
      status: "scheduled",
      predictionStatus: "open",
      weightClass: "Lightweight",
      isTitleFight: false,
      scheduledRounds: 3,
      predictionSummary: {
        total: 0,
        fighterA: 0,
        fighterB: 0,
        methods: {},
        rounds: {},
      },
      editorial: { status: "missing" },
    },
  ],
};

describe("MockMmaProvider", () => {
  it("returns deterministic normalized DTOs without sharing mutable state", async () => {
    const provider = new MockMmaProvider([fixture], {
      now: () => new Date("2026-08-16T12:00:00.000Z"),
    });
    const first = await provider.getEventCard("evt_test_001");
    const second = await provider.getEventCard("evt_test_001");
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect((await provider.getLiveEvent("evt_test_001")).fetchedAt).toBe(
      "2026-08-16T12:00:00.000Z",
    );
  });
});
