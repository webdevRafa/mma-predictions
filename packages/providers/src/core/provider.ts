import type { Event, EventCard, Fighter, FightStatus } from "@fightlobby/domain";

export interface ProviderEventSummary {
  id: string;
  externalId: string;
  name: string;
  startsAt: string;
  status: Event["status"];
}

export interface ProviderLiveEvent {
  eventId: string;
  eventStatus: Event["status"];
  fightStatuses: Array<{ fightId: string; status: FightStatus }>;
  fetchedAt: string;
}

export interface MmaDataProvider {
  readonly providerKey: string;
  listEvents(input: { from: Date; to: Date }): Promise<ProviderEventSummary[]>;
  getEventCard(externalEventId: string): Promise<EventCard>;
  getFighter(externalFighterId: string): Promise<Fighter>;
  getLiveEvent(externalEventId: string): Promise<ProviderLiveEvent>;
}
