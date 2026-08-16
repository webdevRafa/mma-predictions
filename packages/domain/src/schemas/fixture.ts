import { z } from "zod";

import { cardSegmentSchema, careerStatsSchema, dataQualitySchema, eventStatusSchema, fighterNameSchema, fighterRecordSchema, fightStatusSchema, isoDateSchema, isoDateTimeSchema, predictionStatusSchema, resultMethodSchema } from "./domain";

const idSchema = z.string().regex(/^[a-z]{3}_[a-z0-9_]+$/, "Use a stable prefixed ID such as evt_demo_001");
const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a lowercase, hyphen-separated slug");

export const fixtureFighterSchema = z.object({
  id: idSchema,
  slug: slugSchema,
  slugHistory: z.array(slugSchema).default([]),
  name: fighterNameSchema,
  status: z.enum(["active", "inactive", "unknown"]).default("active"),
  countryCode: z.string().regex(/^[A-Z]{2}$/).optional(),
  birthDate: isoDateSchema.optional(),
  stance: z.enum(["orthodox", "southpaw", "switch", "open", "unknown"]).optional(),
  heightCm: z.number().positive().max(250).optional(),
  reachCm: z.number().positive().max(300).optional(),
  currentWeightClass: z.string().trim().min(1).optional(),
  record: fighterRecordSchema,
  careerStats: careerStatsSchema.optional(),
  dataQuality: dataQualitySchema.default("complete"),
}).strict();

export const fixtureEventSchema = z.object({
  id: idSchema,
  promotion: z.literal("ufc"),
  name: z.string().trim().min(1).max(140),
  shortName: z.string().trim().min(1).max(80),
  eventNumber: z.number().int().positive().optional(),
  slug: slugSchema,
  slugHistory: z.array(slugSchema).default([]),
  status: eventStatusSchema,
  startsAt: isoDateTimeSchema,
  venueTimezone: z.string().trim().min(1),
  venue: z.object({
    name: z.string().trim().min(1).optional(),
    city: z.string().trim().min(1).optional(),
    region: z.string().trim().min(1).optional(),
    countryCode: z.string().regex(/^[A-Z]{2}$/).optional(),
  }).strict().optional(),
  editorial: z.object({
    summary: z.string().trim().min(40).max(800).optional(),
    status: z.enum(["missing", "draft", "reviewed", "published"]),
  }).strict().optional(),
}).strict();

const predictionSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  fighterA: z.number().int().nonnegative(),
  fighterB: z.number().int().nonnegative(),
  methods: z.record(z.string(), z.number().int().nonnegative()),
  rounds: z.record(z.string(), z.number().int().nonnegative()),
}).strict().superRefine((summary, context) => {
  if (summary.fighterA + summary.fighterB !== summary.total) {
    context.addIssue({ code: "custom", path: ["total"], message: "total must equal fighterA + fighterB" });
  }
});

const resultSchema = z.object({
  winnerFighterId: idSchema.optional(),
  method: resultMethodSchema,
  methodDetail: z.string().trim().min(1).optional(),
  round: z.number().int().min(1).max(5).optional(),
  timeInRoundSeconds: z.number().int().min(0).max(300).optional(),
  resultVersion: z.number().int().positive(),
  official: z.boolean(),
}).strict();

const editorialSchema = z.object({
  biggestQuestion: z.string().trim().min(20).max(300).optional(),
  styleContrast: z.string().trim().min(20).max(500).optional(),
  keysForFighterA: z.array(z.string().trim().min(5).max(140)).max(5).optional(),
  keysForFighterB: z.array(z.string().trim().min(5).max(140)).max(5).optional(),
  fightLobbyTake: z.string().trim().min(30).max(800).optional(),
  status: z.enum(["missing", "draft", "reviewed", "published"]),
}).strict();

export const fixtureFightSchema = z.object({
  id: idSchema,
  slug: slugSchema,
  slugHistory: z.array(slugSchema).default([]),
  eventId: idSchema,
  fighterAId: idSchema,
  fighterBId: idSchema,
  cardSegment: cardSegmentSchema,
  boutOrder: z.number().int().positive(),
  status: fightStatusSchema,
  predictionStatus: predictionStatusSchema,
  weightClass: z.string().trim().min(1),
  isTitleFight: z.boolean(),
  titleType: z.enum(["undisputed", "interim", "bmf", "other"]).optional(),
  scheduledRounds: z.union([z.literal(3), z.literal(5)]),
  estimatedStartsAt: isoDateTimeSchema.optional(),
  predictionsLockedAt: isoDateTimeSchema.optional(),
  result: resultSchema.optional(),
  replacedByFightId: idSchema.optional(),
  predictionSummary: predictionSummarySchema,
  editorial: editorialSchema,
  dataQuality: dataQualitySchema.default("complete"),
}).strict();

export const normalizedFixtureSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: isoDateTimeSchema,
  source: z.object({ provider: z.literal("mock"), externalEventId: z.string().trim().min(1) }).strict(),
  event: fixtureEventSchema,
  fighters: z.array(fixtureFighterSchema).min(2),
  fights: z.array(fixtureFightSchema).min(1),
}).strict().superRefine((fixture, context) => {
  const fighterIds = new Set<string>();
  fixture.fighters.forEach((fighter, index) => {
    if (fighterIds.has(fighter.id)) context.addIssue({ code: "custom", path: ["fighters", index, "id"], message: "Duplicate fighter ID" });
    fighterIds.add(fighter.id);
  });

  const fightIds = new Set<string>();
  fixture.fights.forEach((fight, index) => {
    if (fightIds.has(fight.id)) context.addIssue({ code: "custom", path: ["fights", index, "id"], message: "Duplicate fight ID" });
    fightIds.add(fight.id);
    if (fight.eventId !== fixture.event.id) context.addIssue({ code: "custom", path: ["fights", index, "eventId"], message: "Fight eventId must match fixture event ID" });
    if (!fighterIds.has(fight.fighterAId)) context.addIssue({ code: "custom", path: ["fights", index, "fighterAId"], message: "Unknown fighter ID" });
    if (!fighterIds.has(fight.fighterBId)) context.addIssue({ code: "custom", path: ["fights", index, "fighterBId"], message: "Unknown fighter ID" });
    if (fight.fighterAId === fight.fighterBId) context.addIssue({ code: "custom", path: ["fights", index, "fighterBId"], message: "A fighter cannot face themselves" });
    if (fight.isTitleFight && fight.scheduledRounds !== 5) context.addIssue({ code: "custom", path: ["fights", index, "scheduledRounds"], message: "Title fights must be scheduled for five rounds" });
    if (fight.status === "completed" && !fight.result) context.addIssue({ code: "custom", path: ["fights", index, "result"], message: "Completed fights require a result" });
    if (fight.result?.winnerFighterId && ![fight.fighterAId, fight.fighterBId].includes(fight.result.winnerFighterId)) context.addIssue({ code: "custom", path: ["fights", index, "result", "winnerFighterId"], message: "Winner must be a fighter in the matchup" });
  });

  fixture.fights.forEach((fight, index) => {
    if (fight.replacedByFightId && !fightIds.has(fight.replacedByFightId)) context.addIssue({ code: "custom", path: ["fights", index, "replacedByFightId"], message: "Replacement fight ID does not exist" });
  });
});

export type NormalizedFixture = z.infer<typeof normalizedFixtureSchema>;
