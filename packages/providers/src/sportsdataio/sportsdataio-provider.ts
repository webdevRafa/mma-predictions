import { z, type ZodType } from "zod";

import type {
  MmaDataProvider,
  ProviderEventSummary,
  ProviderRawSnapshot,
} from "../core/provider.js";
import {
  normalizeSportsDataEventCard,
  normalizeSportsDataEventSummary,
  normalizeSportsDataFighter,
  normalizeSportsDataLiveEvent,
} from "./normalizer.js";
import {
  sportsDataEventDetailSchema,
  sportsDataFighterSchema,
  sportsDataScheduleSchema,
} from "./schemas.js";

export class ProviderHttpError extends Error {
  constructor(
    readonly providerKey: string,
    readonly status: number,
    readonly endpoint: string,
  ) {
    super(`${providerKey} returned HTTP ${status} for ${endpoint}`);
    this.name = "ProviderHttpError";
  }
}

export interface SportsDataIoProviderOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  now?: () => Date;
}

export class SportsDataIoMmaProvider implements MmaDataProvider {
  readonly providerKey = "sportsdataio";
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #fetch: typeof globalThis.fetch;
  readonly #now: () => Date;
  readonly #snapshots: ProviderRawSnapshot[] = [];

  constructor(options: SportsDataIoProviderOptions) {
    if (!options.apiKey.trim())
      throw new Error("SportsDataIO API key is required");
    this.#apiKey = options.apiKey;
    this.#baseUrl = (options.baseUrl ?? "https://api.sportsdata.io").replace(
      /\/$/,
      "",
    );
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#now = options.now ?? (() => new Date());
  }

  async #request<T>(
    endpoint: string,
    schema: ZodType<T>,
    entityType: ProviderRawSnapshot["entityType"],
    externalId: string,
  ): Promise<T> {
    const response = await this.#fetch(`${this.#baseUrl}${endpoint}`, {
      headers: { "Ocp-Apim-Subscription-Key": this.#apiKey },
      signal: AbortSignal.timeout(15_000),
    });
    const fetchedAt = this.#now().toISOString();
    const body: unknown = await response.json().catch(() => null);
    this.#snapshots.push({
      providerKey: this.providerKey,
      entityType,
      externalId,
      fetchedAt,
      httpStatus: response.status,
      schemaVersion: 1,
      body,
    });
    if (!response.ok)
      throw new ProviderHttpError(this.providerKey, response.status, endpoint);
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new z.ZodError(parsed.error.issues);
    return parsed.data;
  }

  async listEvents(input: {
    from: Date;
    to: Date;
  }): Promise<ProviderEventSummary[]> {
    const firstYear = input.from.getUTCFullYear();
    const lastYear = input.to.getUTCFullYear();
    const years = Array.from(
      { length: lastYear - firstYear + 1 },
      (_, index) => firstYear + index,
    );
    const schedules = await Promise.all(
      years.map((year) =>
        this.#request(
          `/v3/mma/scores/JSON/Schedule/UFC/${year}`,
          sportsDataScheduleSchema,
          "event",
          `ufc-${year}`,
        ),
      ),
    );
    const byExternalId = new Map<string, ProviderEventSummary>();
    for (const source of schedules.flat()) {
      const event = normalizeSportsDataEventSummary(source);
      const startsAt = new Date(event.startsAt).getTime();
      if (startsAt >= input.from.getTime() && startsAt <= input.to.getTime())
        byExternalId.set(event.externalId, event);
    }
    return [...byExternalId.values()].sort((left, right) =>
      left.startsAt.localeCompare(right.startsAt),
    );
  }

  async getEventCard(externalEventId: string) {
    const source = await this.#request(
      `/v3/mma/scores/JSON/Event/${encodeURIComponent(externalEventId)}`,
      sportsDataEventDetailSchema,
      "event",
      externalEventId,
    );
    return normalizeSportsDataEventCard(source, this.#now().toISOString());
  }

  async getFighter(externalFighterId: string) {
    const source = await this.#request(
      `/v3/mma/scores/JSON/Fighter/${encodeURIComponent(externalFighterId)}`,
      sportsDataFighterSchema,
      "fighter",
      externalFighterId,
    );
    return normalizeSportsDataFighter(source, this.#now().toISOString());
  }

  async getLiveEvent(externalEventId: string) {
    const card = await this.getEventCard(externalEventId);
    return normalizeSportsDataLiveEvent(card, this.#now().toISOString());
  }

  drainRawSnapshots() {
    return this.#snapshots.splice(0, this.#snapshots.length);
  }
}
