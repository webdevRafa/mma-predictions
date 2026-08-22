import { describe, expect, it } from "vitest";

import { validateAndNormalizeFixture } from "../src/index";

const fighter = (suffix: string) => ({
  id: `ftr_order_${suffix}`,
  slug: `fixture-fighter-${suffix}`,
  name: {
    full: `Fixture Fighter ${suffix.toUpperCase()}`,
    normalized: `fixture fighter ${suffix}`,
  },
  record: { wins: 1, losses: 0, draws: 0, noContests: 0 },
});

const fight = (
  suffix: string,
  fighterAId: string,
  fighterBId: string,
  cardSegment: "main_card" | "prelims" | "early_prelims",
  boutOrder: number,
) => ({
  id: `fgt_order_${suffix}`,
  slug: `fixture-fight-${suffix}`,
  eventId: "evt_fixture_order",
  fighterAId,
  fighterBId,
  cardSegment,
  boutOrder,
  status: "scheduled" as const,
  predictionStatus: "open" as const,
  weightClass: "Lightweight",
  isTitleFight: false,
  scheduledRounds: 3 as const,
  predictionSummary: {
    total: 0,
    fighterA: 0,
    fighterB: 0,
    methods: {},
    rounds: {},
  },
  editorial: { status: "missing" as const },
});

const orderedFixture = {
  schemaVersion: 1,
  generatedAt: "2026-08-22T12:00:00.000Z",
  source: { provider: "mock", externalEventId: "fixture-order" },
  event: {
    id: "evt_fixture_order",
    promotion: "ufc",
    name: "UFC Fixture: Card Order",
    shortName: "Card Order Fixture",
    slug: "ufc-fixture-card-order",
    status: "scheduled",
    startsAt: "2026-08-23T00:00:00.000Z",
    venueTimezone: "UTC",
  },
  fighters: ["a", "b", "c", "d", "e", "f"].map(fighter),
  fights: [
    fight("one", "ftr_order_a", "ftr_order_b", "main_card", 1),
    fight("two", "ftr_order_c", "ftr_order_d", "prelims", 2),
    fight("three", "ftr_order_e", "ftr_order_f", "early_prelims", 3),
  ],
};

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

  it("accepts contiguous top-to-bottom card order", () => {
    expect(validateAndNormalizeFixture(orderedFixture).success).toBe(true);
  });

  it("rejects noncontiguous or out-of-sequence active fights", () => {
    const result = validateAndNormalizeFixture({
      ...orderedFixture,
      fights: [
        orderedFixture.fights[0],
        { ...orderedFixture.fights[1], boutOrder: 3 },
        {
          ...orderedFixture.fights[2],
          cardSegment: "main_card",
          boutOrder: 2,
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.issues.some(
          (issue) =>
            issue.path === "$.fights.1.boutOrder" &&
            issue.message.includes("top-to-bottom"),
        ),
      ).toBe(true);
      expect(
        result.issues.some(
          (issue) =>
            issue.path === "$.fights.2.cardSegment" &&
            issue.message.includes("Card segments"),
        ),
      ).toBe(true);
    }
  });
});
