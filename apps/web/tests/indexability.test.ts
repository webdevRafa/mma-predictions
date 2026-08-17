import { parseFixture } from "@fightlobby/domain";
import { describe, expect, it } from "vitest";

import fixture from "../../../fixtures/events/ufc-fightlobby-demo.json";
import {
  isEventIndexable,
  isFightIndexable,
  isFighterIndexable,
} from "../lib/seo/indexability";

describe("public page indexability", () => {
  const card = parseFixture(fixture);

  it("indexes only complete canonical event pages", () => {
    expect(isEventIndexable(card.event, card.fights)).toBe(true);
    expect(
      isEventIndexable(
        { ...card.event, editorial: { status: "draft" } },
        card.fights,
      ),
    ).toBe(false);
    expect(isEventIndexable(card.event, [])).toBe(false);
  });

  it("indexes complete reviewed matchups and excludes thin drafts", () => {
    const mainEvent = card.fights.find(
      (fight) => fight.id === "fgt_fl_demo_001",
    );
    const draftFight = card.fights.find(
      (fight) => fight.id === "fgt_fl_demo_004",
    );
    expect(mainEvent).toBeDefined();
    expect(draftFight).toBeDefined();
    if (!mainEvent || !draftFight) return;

    const fightersFor = (fight: typeof mainEvent) =>
      card.fighters.filter(
        (fighter) =>
          fighter.id === fight.fighterAId || fighter.id === fight.fighterBId,
      );

    expect(isFightIndexable(mainEvent, fightersFor(mainEvent))).toBe(true);
    expect(isFightIndexable(draftFight, fightersFor(draftFight))).toBe(false);
  });

  it("requires a meaningful fighter record and division", () => {
    const fighter = card.fighters[0];
    expect(fighter).toBeDefined();
    if (!fighter) return;
    expect(isFighterIndexable(fighter)).toBe(true);
    expect(
      isFighterIndexable({
        ...fighter,
        currentWeightClass: undefined,
        record: { wins: 0, losses: 0, draws: 0, noContests: 0 },
      }),
    ).toBe(false);
  });
});
