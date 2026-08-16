import type {
  Event,
  EventCard,
  Fighter,
  FightStatus,
} from "@fightlobby/domain";

export type ProviderEntityType = "event" | "fight" | "fighter";

export interface ProviderRawSnapshot {
  providerKey: string;
  entityType: ProviderEntityType;
  externalId: string;
  fetchedAt: string;
  httpStatus: number;
  schemaVersion: number;
  body: unknown;
}

export interface ProviderEntityReferences {
  event: string;
  fights: Record<string, string>;
  fighters: Record<string, string>;
}

/** Canonical data with short-lived provider references used only by ingestion. */
export interface ProviderEventCard extends EventCard {
  providerRefs: ProviderEntityReferences;
}

export interface ProviderFighter extends Fighter {
  providerExternalId: string;
}

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
  getEventCard(externalEventId: string): Promise<ProviderEventCard>;
  getFighter(externalFighterId: string): Promise<ProviderFighter>;
  getLiveEvent(externalEventId: string): Promise<ProviderLiveEvent>;
  drainRawSnapshots?(): ProviderRawSnapshot[];
}
