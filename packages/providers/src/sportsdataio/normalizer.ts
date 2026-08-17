import {
  canonicalSlug,
  normalizeSearchText,
  type CardSegment,
  type EventStatus,
  type Fighter,
  type Fight,
  type FightStatus,
  type ResultMethod,
} from "@fightlobby/domain";

import type {
  ProviderEventCard,
  ProviderFighter,
  ProviderLiveEvent,
} from "../core/provider.js";
import type {
  SportsDataEvent,
  SportsDataEventDetail,
  SportsDataFighter,
} from "./schemas.js";

const INCHES_TO_CM = 2.54;

function clean(value: string | null | undefined) {
  const result = value?.trim();
  return result ? result : undefined;
}

function temporaryId(prefix: "evt" | "fgt" | "ftr", externalId: string) {
  return `${prefix}_sportsdataio_${externalId.replace(/[^a-z0-9]/gi, "_").toLowerCase()}`;
}

function timezoneParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

/** SportsDataIO documents datetimes without offsets as US Eastern. */
export function parseSportsDataEasternDateTime(value: string | undefined) {
  if (!value) throw new Error("SportsDataIO event is missing DateTime");
  if (/[zZ]|[+-]\d\d:\d\d$/.test(value)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (!match) throw new Error(`Invalid SportsDataIO DateTime: ${value}`);
  const desired = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4] ?? 0),
    Number(match[5] ?? 0),
    Number(match[6] ?? 0),
  );
  let instant = desired;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const local = timezoneParts(new Date(instant));
    const represented = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
    );
    instant += desired - represented;
  }
  return new Date(instant).toISOString();
}

export function mapEventStatus(value: string | null | undefined): EventStatus {
  switch (value?.trim().toLowerCase()) {
    case "in progress":
      return "live";
    case "final":
      return "completed";
    case "canceled":
    case "cancelled":
      return "canceled";
    case "postponed":
    case "suspended":
      return "postponed";
    default:
      return "scheduled";
  }
}

export function mapFightStatus(value: string | null | undefined): FightStatus {
  switch (value?.trim().toLowerCase()) {
    case "pre-fight":
    case "prefight":
      return "prefight";
    case "walkouts":
      return "walkouts";
    case "intros":
      return "intros";
    case "in progress":
      return "in_progress";
    case "end of round":
      return "end_of_round";
    case "final":
      return "completed";
    case "canceled":
    case "cancelled":
      return "canceled";
    case "postponed":
      return "postponed";
    default:
      return "scheduled";
  }
}

function mapResultMethod(value: string | null | undefined): ResultMethod {
  switch (value?.trim().toLowerCase().replace(/\s+/g, " ")) {
    case "ko/tko":
      return "ko_tko";
    case "submission":
      return "submission";
    case "decision - unanimous":
      return "decision_unanimous";
    case "decision - split":
      return "decision_split";
    case "decision - majority":
      return "decision_majority";
    case "dq":
      return "dq";
    case "draw":
      return "draw";
    case "no contest":
      return "no_contest";
    default:
      return "other";
  }
}

function mapCardSegment(value: string | null | undefined): CardSegment {
  switch (value?.trim().toLowerCase()) {
    case "early prelims":
      return "early_prelims";
    case "prelims":
    case "preliminary card":
      return "prelims";
    default:
      return "main_card";
  }
}

function probability(value: number | null | undefined) {
  if (value === null || value === undefined || value < 0) return undefined;
  return value > 1 ? Math.min(value / 100, 1) : Math.min(value, 1);
}

function cm(value: number | null | undefined) {
  return value && value > 0
    ? Math.round(value * INCHES_TO_CM * 10) / 10
    : undefined;
}

function fullName(
  first: string | null | undefined,
  last: string | null | undefined,
) {
  return (
    [clean(first), clean(last)].filter(Boolean).join(" ") || "Unknown fighter"
  );
}

export function normalizeSportsDataFighter(
  source: SportsDataFighter,
  now: string,
): ProviderFighter {
  const externalId = String(source.FighterId);
  const id = temporaryId("ftr", externalId);
  const name = fullName(source.FirstName, source.LastName);
  const stats = source.CareerStats;
  const significantStrikesLandedPerMinute =
    stats?.SigStrikesLandedPerMinute ?? undefined;
  const significantStrikeAccuracy = probability(stats?.SigStrikeAccuracy);
  const takedownsPer15 = stats?.TakedownAverage ?? undefined;
  const submissionsPer15 = stats?.SubmissionAverage ?? undefined;
  return {
    id,
    providerExternalId: externalId,
    slug: canonicalSlug(name, id),
    slugHistory: [],
    name: {
      full: name,
      normalized: normalizeSearchText(name),
      ...(clean(source.FirstName) ? { first: clean(source.FirstName) } : {}),
      ...(clean(source.LastName) ? { last: clean(source.LastName) } : {}),
      ...(clean(source.Nickname) ? { nickname: clean(source.Nickname) } : {}),
    },
    status: "active",
    ...(clean(source.BirthDate)?.slice(0, 10)
      ? { birthDate: clean(source.BirthDate)!.slice(0, 10) }
      : {}),
    ...(cm(source.Height) ? { heightCm: cm(source.Height) } : {}),
    ...(cm(source.Reach) ? { reachCm: cm(source.Reach) } : {}),
    ...(clean(source.WeightClass)
      ? { currentWeightClass: clean(source.WeightClass) }
      : {}),
    record: {
      wins: Math.max(0, source.Wins ?? 0),
      losses: Math.max(0, source.Losses ?? 0),
      draws: Math.max(0, source.Draws ?? 0),
      noContests: Math.max(0, source.NoContests ?? 0),
    },
    ...(significantStrikesLandedPerMinute !== undefined ||
    significantStrikeAccuracy !== undefined ||
    takedownsPer15 !== undefined ||
    submissionsPer15 !== undefined
      ? {
          careerStats: {
            ...(significantStrikesLandedPerMinute !== undefined
              ? { significantStrikesLandedPerMinute }
              : {}),
            ...(significantStrikeAccuracy !== undefined
              ? { significantStrikeAccuracy }
              : {}),
            ...(takedownsPer15 !== undefined ? { takedownsPer15 } : {}),
            ...(submissionsPer15 !== undefined ? { submissionsPer15 } : {}),
          },
        }
      : {}),
    dataQuality: "complete",
    updatedAt: now,
  };
}

function fighterFromCard(
  source: SportsDataEventDetail["Fights"][number]["Fighters"][number],
  now: string,
): Fighter {
  if (source.FighterId === null || source.FighterId === undefined)
    throw new Error("SportsDataIO fight contains a fighter without FighterId");
  const externalId = String(source.FighterId);
  const id = temporaryId("ftr", externalId);
  const name = fullName(source.FirstName, source.LastName);
  return {
    id,
    slug: canonicalSlug(name, id),
    slugHistory: [],
    name: {
      full: name,
      normalized: normalizeSearchText(name),
      ...(clean(source.FirstName) ? { first: clean(source.FirstName) } : {}),
      ...(clean(source.LastName) ? { last: clean(source.LastName) } : {}),
    },
    status: source.Active === false ? "inactive" : "active",
    record: {
      wins: Math.max(0, source.PreFightWins ?? 0),
      losses: Math.max(0, source.PreFightLosses ?? 0),
      draws: Math.max(0, source.PreFightDraws ?? 0),
      noContests: Math.max(0, source.PreFightNoContests ?? 0),
    },
    dataQuality: "partial",
    updatedAt: now,
  };
}

export function normalizeSportsDataEventSummary(source: SportsDataEvent) {
  const externalId = String(source.EventId);
  const id = temporaryId("evt", externalId);
  const name =
    clean(source.Name) ?? clean(source.ShortName) ?? `UFC Event ${externalId}`;
  return {
    id,
    externalId,
    name,
    startsAt: parseSportsDataEasternDateTime(
      clean(source.DateTime) ?? clean(source.Day),
    ),
    status: mapEventStatus(source.Status),
  };
}

export function normalizeSportsDataEventCard(
  source: SportsDataEventDetail,
  now: string,
): ProviderEventCard {
  const externalEventId = String(source.EventId);
  const eventId = temporaryId("evt", externalEventId);
  const eventName =
    clean(source.Name) ??
    clean(source.ShortName) ??
    `UFC Event ${externalEventId}`;
  const uniqueFighters = new Map<string, Fighter>();
  for (const sourceFight of source.Fights) {
    for (const sourceFighter of sourceFight.Fighters) {
      const fighter = fighterFromCard(sourceFighter, now);
      uniqueFighters.set(fighter.id, fighter);
    }
  }
  const fightersById = uniqueFighters;
  const fights = source.Fights.flatMap<Fight>((sourceFight, index) => {
    const participants = sourceFight.Fighters.flatMap((fighter) =>
      fighter.FighterId === null || fighter.FighterId === undefined
        ? []
        : [temporaryId("ftr", String(fighter.FighterId))],
    ).slice(0, 2);
    const fighterA = participants[0]
      ? fightersById.get(participants[0])
      : undefined;
    const fighterB = participants[1]
      ? fightersById.get(participants[1])
      : undefined;
    if (!fighterA || !fighterB) return [];
    const externalFightId = String(sourceFight.FightId);
    const id = temporaryId("fgt", externalFightId);
    const status = mapFightStatus(sourceFight.Status);
    const method = mapResultMethod(sourceFight.ResultType);
    const winnerExternalId = sourceFight.WinnerId
      ? String(sourceFight.WinnerId)
      : undefined;
    const winnerFighterId = winnerExternalId
      ? temporaryId("ftr", winnerExternalId)
      : undefined;
    const scheduledRounds = sourceFight.Rounds === 5 ? 5 : 3;
    return [
      {
        id,
        slug: canonicalSlug(
          `${fighterA.name.full} vs ${fighterB.name.full}`,
          id,
        ),
        slugHistory: [],
        eventId,
        cardSegment: mapCardSegment(sourceFight.CardSegment),
        boutOrder: Math.max(1, sourceFight.Order ?? index + 1),
        status,
        predictionStatus:
          status === "completed"
            ? "grading"
            : status === "canceled"
              ? "void"
              : status === "scheduled" || status === "prefight"
                ? "open"
                : "locked",
        fighterAId: fighterA.id,
        fighterBId: fighterB.id,
        fighterA: {
          id: fighterA.id,
          slug: fighterA.slug,
          name: fighterA.name,
          record: fighterA.record,
        },
        fighterB: {
          id: fighterB.id,
          slug: fighterB.slug,
          name: fighterB.name,
          record: fighterB.record,
        },
        weightClass: clean(sourceFight.WeightClass) ?? "Unknown weight class",
        isTitleFight: false,
        scheduledRounds,
        ...(status === "completed"
          ? {
              result: {
                ...(winnerFighterId ? { winnerFighterId } : {}),
                method,
                ...(clean(sourceFight.ResultType)
                  ? { methodDetail: clean(sourceFight.ResultType) }
                  : {}),
                ...(sourceFight.ResultRound
                  ? { round: Math.min(Math.max(sourceFight.ResultRound, 1), 5) }
                  : {}),
                ...(sourceFight.ResultClock !== null &&
                sourceFight.ResultClock !== undefined
                  ? {
                      timeInRoundSeconds: Math.min(
                        Math.max(sourceFight.ResultClock, 0),
                        300,
                      ),
                    }
                  : {}),
                resultVersion: 1,
                official: sourceFight.IsClosed,
                updatedAt: now,
              },
            }
          : {}),
        predictionSummary: {
          total: 0,
          fighterA: 0,
          fighterB: 0,
          methods: {},
          rounds: {},
        },
        chatRoomId: `fight_${id}`,
        editorial: { status: "missing" },
        monetizationEligible: true,
        dataQuality: "partial",
        updatedAt: now,
      },
    ];
  });
  const cardSegments = {
    earlyPrelims: fights.filter(
      (fight) => fight.cardSegment === "early_prelims",
    ).length,
    prelims: fights.filter((fight) => fight.cardSegment === "prelims").length,
    mainCard: fights.filter((fight) => fight.cardSegment === "main_card")
      .length,
  };
  const mainEvent = fights
    .filter((fight) => fight.cardSegment === "main_card")
    .sort((left, right) => left.boutOrder - right.boutOrder)[0];
  const eventNumber = eventName.match(/\bUFC\s+(\d+)\b/i)?.[1];
  return {
    event: {
      id: eventId,
      slug: canonicalSlug(eventName, eventId),
      slugHistory: [],
      promotion: "ufc",
      name: eventName,
      shortName: clean(source.ShortName) ?? eventName,
      ...(eventNumber ? { eventNumber: Number(eventNumber) } : {}),
      status: mapEventStatus(source.Status),
      startsAt: parseSportsDataEasternDateTime(
        clean(source.DateTime) ?? clean(source.Day),
      ),
      venueTimezone: "America/New_York",
      ...(mainEvent ? { mainEventFightId: mainEvent.id } : {}),
      fightCount: fights.length,
      cardSegments,
      predictionSummary: { totalPredictions: 0, uniquePredictors: 0 },
      chatRoomId: `event_${eventId}`,
      monetizationEligible: true,
      dataQuality: fights.length > 0 ? "complete" : "partial",
      updatedAt: now,
    },
    fights,
    fighters: [...uniqueFighters.values()],
    providerRefs: {
      event: externalEventId,
      fights: Object.fromEntries(
        source.Fights.map((fight) => [
          temporaryId("fgt", String(fight.FightId)),
          String(fight.FightId),
        ]),
      ),
      fighters: Object.fromEntries(
        [...uniqueFighters.keys()].map((id) => [
          id,
          id.replace("ftr_sportsdataio_", ""),
        ]),
      ),
    },
  };
}

export function normalizeSportsDataLiveEvent(
  card: ProviderEventCard,
  fetchedAt: string,
): ProviderLiveEvent {
  return {
    eventId: card.providerRefs.event,
    eventStatus: card.event.status,
    fightStatuses: card.fights.map((fight) => ({
      fightId: card.providerRefs.fights[fight.id] ?? fight.id,
      status: fight.status,
    })),
    fetchedAt,
  };
}
