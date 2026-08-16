import { describe, expect, it } from "vitest";

import { FixturePublicRepository } from "../lib/repositories/fixture-public-repository";

describe("FixturePublicRepository", () => {
  it("resolves canonical and historical lookup contracts", async () => {
    const repository = new FixturePublicRepository();
    const events = await repository.listEvents();
    expect(events).toHaveLength(1);
    const event = events[0];
    expect(event).toBeDefined();
    if (!event) return;
    const card = await repository.getEventBySlug(event.slug);
    expect(card?.fights).toHaveLength(5);
    const firstFight = card?.fights[0];
    expect(
      firstFight ? await repository.getFightBySlug(firstFight.slug) : null,
    ).not.toBeNull();
  });
});
