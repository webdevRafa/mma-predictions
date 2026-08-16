import { z } from "zod";

import { isoDateTimeSchema } from "./domain.ts";

export const leaderboardTypeSchema = z.enum([
  "event",
  "season_points",
  "season_accuracy",
  "streak",
]);

export const leaderboardEntrySchema = z
  .object({
    uid: z.string().min(1),
    handle: z.string().min(3).max(20),
    avatarVersion: z.number().int().nonnegative(),
    rank: z.number().int().positive(),
    gradedPicks: z.number().int().nonnegative(),
    correctWinners: z.number().int().nonnegative(),
    rawAccuracy: z.number().min(0).max(1),
    wilsonScore: z.number().min(0).max(1).optional(),
    totalPoints: z.number().int().nonnegative(),
    exactPicks: z.number().int().nonnegative(),
    currentStreak: z.number().int().nonnegative(),
    badges: z.array(z.string().min(1)),
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export const leaderboardSchema = z
  .object({
    id: z.string().min(1),
    type: leaderboardTypeSchema,
    label: z.string().min(1).max(100),
    eventId: z.string().min(1).optional(),
    seasonId: z.string().min(1).optional(),
    championUid: z.string().min(1).nullable().optional(),
    startsAt: isoDateTimeSchema.optional(),
    endsAt: isoDateTimeSchema.optional(),
    minimumPicks: z.number().int().nonnegative(),
    calculationVersion: z.number().int().positive(),
    lastBuiltAt: isoDateTimeSchema.optional(),
    entries: z.array(leaderboardEntrySchema),
  })
  .strict();

const fixtureMetricsSchema = z
  .object({
    gradedPicks: z.number().int().nonnegative(),
    correctWinners: z.number().int().nonnegative(),
    totalPoints: z.number().int().nonnegative(),
    exactPicks: z.number().int().nonnegative(),
    currentStreak: z.number().int().nonnegative(),
  })
  .strict();

export const leaderboardFixtureSchema = z
  .object({
    generatedAt: isoDateTimeSchema,
    event: z
      .object({ id: z.string().min(1), label: z.string().min(1) })
      .strict(),
    season: z
      .object({ id: z.string().min(1), label: z.string().min(1) })
      .strict(),
    gradedEventFights: z.number().int().positive(),
    members: z
      .array(
        z
          .object({
            uid: z.string().min(1),
            handle: z.string().min(3).max(20),
            avatarVersion: z.number().int().nonnegative(),
            badges: z.array(z.string().min(1)),
            event: fixtureMetricsSchema,
            season: fixtureMetricsSchema,
          })
          .strict(),
      )
      .min(3),
  })
  .strict();

export type LeaderboardFixture = z.infer<typeof leaderboardFixtureSchema>;
