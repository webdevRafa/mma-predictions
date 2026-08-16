import { parseFixture } from "@fightlobby/domain";

import fixture from "../../../../fixtures/events/ufc-fightlobby-demo.json";
import type { PublicRepository } from "./public-repository";

const card = parseFixture(fixture);

export class FixturePublicRepository implements PublicRepository {
  listEvents() {
    return Promise.resolve([structuredClone(card.event)]);
  }

  getEventBySlug(slug: string) {
    const matches =
      card.event.slug === slug || card.event.slugHistory.includes(slug);
    return Promise.resolve(matches ? structuredClone(card) : null);
  }

  getFightBySlug(slug: string) {
    const fight = card.fights.find(
      (candidate) =>
        candidate.slug === slug || candidate.slugHistory.includes(slug),
    );
    if (!fight) return Promise.resolve(null);
    const fighters = card.fighters.filter(
      (fighter) =>
        fighter.id === fight.fighterAId || fighter.id === fight.fighterBId,
    );
    return Promise.resolve({
      fight: structuredClone(fight),
      event: structuredClone(card.event),
      fighters: structuredClone(fighters),
    });
  }

  getFighterBySlug(slug: string) {
    const fighter = card.fighters.find(
      (candidate) =>
        candidate.slug === slug || candidate.slugHistory.includes(slug),
    );
    if (!fighter) return Promise.resolve(null);
    const fights = card.fights.filter(
      (fight) =>
        fight.fighterAId === fighter.id || fight.fighterBId === fighter.id,
    );
    return Promise.resolve({
      fighter: structuredClone(fighter),
      fights: structuredClone(fights),
    });
  }
}
