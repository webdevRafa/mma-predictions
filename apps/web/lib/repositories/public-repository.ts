import type { Event, EventCard, Fight, Fighter } from "@fightlobby/domain";

export interface PublicRepository {
  listEvents(): Promise<Event[]>;
  getEventBySlug(slug: string): Promise<EventCard | null>;
  getFightBySlug(
    slug: string,
  ): Promise<{ fight: Fight; event: Event; fighters: Fighter[] } | null>;
  getFighterBySlug(
    slug: string,
  ): Promise<{ fighter: Fighter; fights: Fight[] } | null>;
}
