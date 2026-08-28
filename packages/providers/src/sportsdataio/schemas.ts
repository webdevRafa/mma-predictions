import { z } from "zod";

const nullableString = z.string().nullable().optional();
const nullableNumber = z.number().nullable().optional();
const nullableInteger = z.number().int().nullable().optional();
const nullableBoolean = z.boolean().nullable().optional();

export const sportsDataEventSchema = z
  .object({
    EventId: z.number().int(),
    LeagueId: z.number().int().optional(),
    Name: nullableString,
    ShortName: nullableString,
    Season: nullableInteger,
    Day: nullableString,
    DateTime: nullableString,
    Status: nullableString,
    Active: nullableBoolean,
  })
  .passthrough();

export const sportsDataFighterInfoSchema = z
  .object({
    FighterId: nullableInteger,
    FirstName: nullableString,
    LastName: nullableString,
    PreFightWins: nullableInteger,
    PreFightLosses: nullableInteger,
    PreFightDraws: nullableInteger,
    PreFightNoContests: nullableInteger,
    Winner: nullableBoolean,
    Active: nullableBoolean,
  })
  .passthrough();

export const sportsDataFightSchema = z
  .object({
    FightId: z.number().int(),
    Order: nullableInteger,
    Status: nullableString,
    WeightClass: nullableString,
    CardSegment: nullableString,
    Rounds: nullableInteger,
    ResultClock: nullableInteger,
    ResultRound: nullableInteger,
    ResultType: nullableString,
    WinnerId: nullableInteger,
    Fighters: z.array(sportsDataFighterInfoSchema).default([]),
    Active: nullableBoolean,
    IsClosed: z.boolean().optional().default(false),
  })
  .passthrough();

export const sportsDataEventDetailSchema = sportsDataEventSchema.extend({
  Fights: z.array(sportsDataFightSchema).default([]),
});

const sportsDataCareerStatsSchema = z
  .object({
    SigStrikesLandedPerMinute: nullableNumber,
    SigStrikeAccuracy: nullableNumber,
    TakedownAverage: nullableNumber,
    SubmissionAverage: nullableNumber,
  })
  .passthrough()
  .nullable()
  .optional();

export const sportsDataFighterSchema = z
  .object({
    FighterId: z.number().int(),
    FirstName: nullableString,
    LastName: nullableString,
    Nickname: nullableString,
    WeightClass: nullableString,
    BirthDate: nullableString,
    Height: nullableNumber,
    Reach: nullableNumber,
    Wins: nullableInteger,
    Losses: nullableInteger,
    Draws: nullableInteger,
    NoContests: nullableInteger,
    CareerStats: sportsDataCareerStatsSchema,
  })
  .passthrough();

export const sportsDataScheduleSchema = z.array(sportsDataEventSchema);

export type SportsDataEvent = z.infer<typeof sportsDataEventSchema>;
export type SportsDataEventDetail = z.infer<typeof sportsDataEventDetailSchema>;
export type SportsDataFighter = z.infer<typeof sportsDataFighterSchema>;
