import { parseFixture } from "@fightlobby/domain";
import type { EventCard, Fighter } from "@fightlobby/domain";

import type {
  MmaDataProvider,
  ProviderEventSummary,
  ProviderEventCard,
  ProviderFighter,
  ProviderLiveEvent,
} from "../core/provider.js";

export class MockMmaProvider implements MmaDataProvider {
  readonly providerKey = "mock";
  readonly #cards: ReadonlyMap<string, EventCard>;
  readonly #fighters: ReadonlyMap<string, Fighter>;
  readonly #now: () => Date;

  constructor(fixtures: unknown[], options: { now?: () => Date } = {}) {
    const cards = fixtures.map(parseFixture);
    this.#cards = new Map(cards.map((card) => [card.event.id, card]));
    this.#fighters = new Map(
      cards.flatMap((card) =>
        card.fighters.map((fighter) => [fighter.id, fighter] as const),
      ),
    );
    this.#now = options.now ?? (() => new Date());
  }

  listEvents({
    from,
    to,
  }: {
    from: Date;
    to: Date;
  }): Promise<ProviderEventSummary[]> {
    return Promise.resolve(
      [...this.#cards.values()]
        .filter(({ event }) => {
          const start = new Date(event.startsAt).getTime();
          return start >= from.getTime() && start <= to.getTime();
        })
        .sort((left, right) =>
          left.event.startsAt.localeCompare(right.event.startsAt),
        )
        .map(({ event }) => ({
          id: event.id,
          externalId: event.id,
          name: event.name,
          startsAt: event.startsAt,
          status: event.status,
        })),
    );
  }

  getEventCard(externalEventId: string): Promise<ProviderEventCard> {
    const card = this.#cards.get(externalEventId);
    if (!card) throw new Error(`Mock event not found: ${externalEventId}`);
    return Promise.resolve({
      ...structuredClone(card),
      providerRefs: {
        event: card.event.id,
        fights: Object.fromEntries(
          card.fights.map((fight) => [fight.id, fight.id]),
        ),
        fighters: Object.fromEntries(
          card.fighters.map((fighter) => [fighter.id, fighter.id]),
        ),
      },
    });
  }

  getFighter(externalFighterId: string): Promise<ProviderFighter> {
    const fighter = this.#fighters.get(externalFighterId);
    if (!fighter)
      throw new Error(`Mock fighter not found: ${externalFighterId}`);
    return Promise.resolve({
      ...structuredClone(fighter),
      providerExternalId: externalFighterId,
    });
  }

  async getLiveEvent(externalEventId: string): Promise<ProviderLiveEvent> {
    const card = await this.getEventCard(externalEventId);
    return {
      eventId: card.event.id,
      eventStatus: card.event.status,
      fightStatuses: card.fights.map((fight) => ({
        fightId: fight.id,
        status: fight.status,
      })),
      fetchedAt: this.#now().toISOString(),
    };
  }
}
