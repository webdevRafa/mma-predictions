import type { ZodIssue } from "zod";

import { normalizedFixtureSchema } from "../schemas/fixture.ts";
import type { Event, EventCard, Fight, Fighter } from "../types/domain.ts";

export interface FixtureValidationIssue {
  path: string;
  message: string;
  code: string;
}

export type FixtureValidationResult =
  | { success: true; data: EventCard }
  | { success: false; issues: FixtureValidationIssue[] };

function issuePath(issue: ZodIssue): string {
  return issue.path.length === 0
    ? "$"
    : `$.${issue.path.map(String).join(".")}`;
}

export function validateAndNormalizeFixture(
  input: unknown,
): FixtureValidationResult {
  const parsed = normalizedFixtureSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issuePath(issue),
        message: issue.message,
        code: issue.code,
      })),
    };
  }

  const updatedAt = parsed.data.generatedAt;
  const fighters: Fighter[] = parsed.data.fighters.map((fighter) => ({
    ...fighter,
    updatedAt,
  }));
  const fighterMap = new Map(fighters.map((fighter) => [fighter.id, fighter]));
  const snapshot = (fighterId: string) => {
    const fighter = fighterMap.get(fighterId);
    if (!fighter)
      throw new Error(`Validated fixture lost fighter ${fighterId}`);
    return {
      id: fighter.id,
      slug: fighter.slug,
      name: fighter.name,
      record: fighter.record,
      ...(fighter.countryCode ? { countryCode: fighter.countryCode } : {}),
    };
  };

  const fights: Fight[] = parsed.data.fights.map((fight) => {
    const { result, ...fightWithoutResult } = fight;
    return {
      ...fightWithoutResult,
      fighterA: snapshot(fight.fighterAId),
      fighterB: snapshot(fight.fighterBId),
      chatRoomId: `fight_${fight.id}`,
      monetizationEligible:
        fight.dataQuality !== "blocked" &&
        fight.editorial.status === "published",
      ...(result ? { result: { ...result, updatedAt } } : {}),
      updatedAt,
    };
  });

  const segmentCount = (segment: Fight["cardSegment"]) =>
    fights.filter((fight) => fight.cardSegment === segment).length;
  const event: Event = {
    ...parsed.data.event,
    mainEventFightId: fights.find(
      (fight) => fight.cardSegment === "main_card" && fight.boutOrder === 1,
    )?.id,
    fightCount: fights.length,
    cardSegments: {
      earlyPrelims: segmentCount("early_prelims"),
      prelims: segmentCount("prelims"),
      mainCard: segmentCount("main_card"),
    },
    predictionSummary: {
      totalPredictions: fights.reduce(
        (total, fight) => total + fight.predictionSummary.total,
        0,
      ),
      uniquePredictors: Math.max(
        ...fights.map((fight) => fight.predictionSummary.total),
        0,
      ),
    },
    chatRoomId: `event_${parsed.data.event.id}`,
    monetizationEligible: parsed.data.event.editorial?.status === "published",
    dataQuality: fights.some((fight) => fight.dataQuality === "blocked")
      ? "blocked"
      : "complete",
    updatedAt,
  };

  return { success: true, data: { event, fights, fighters } };
}

export function parseFixture(input: unknown): EventCard {
  const result = validateAndNormalizeFixture(input);
  if (result.success) return result.data;
  const details = result.issues
    .map((issue) => `${issue.path}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid FightLobby fixture:\n${details}`);
}
