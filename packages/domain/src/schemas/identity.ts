import { z } from "zod";

import { handleSchema } from "../identity/handle.ts";
import { isoDateTimeSchema } from "./domain.ts";

export const accountStatusSchema = z.enum([
  "active",
  "muted",
  "suspended",
  "banned",
  "deleted",
]);

export const userRoleSchema = z.enum([
  "member",
  "trusted",
  "moderator",
  "admin",
]);

export const publicProfileStatsSchema = z
  .object({
    gradedPicks: z.number().int().nonnegative(),
    correctWinners: z.number().int().nonnegative(),
    winnerAccuracy: z.number().min(0).max(1),
    totalPoints: z.number().int().nonnegative(),
    exactPicks: z.number().int().nonnegative(),
    currentStreak: z.number().int().nonnegative(),
    longestStreak: z.number().int().nonnegative(),
    eventChampionships: z.number().int().nonnegative(),
  })
  .strict();

export const publicProfileSchema = z
  .object({
    uid: z.string().min(1),
    handle: handleSchema,
    handleNormalized: handleSchema,
    handleHistory: z.array(handleSchema).default([]),
    displayName: z.string().trim().min(1).max(50).optional(),
    avatar: z
      .object({
        storagePath: z.string().min(1).optional(),
        version: z.number().int().nonnegative(),
      })
      .strict()
      .optional(),
    joinedAt: isoDateTimeSchema,
    stats: publicProfileStatsSchema,
    rankSummary: z
      .object({
        seasonId: z.string().min(1),
        pointsRank: z.number().int().positive().optional(),
        accuracyRank: z.number().int().positive().optional(),
      })
      .strict()
      .optional(),
    badges: z.array(z.string().min(1)),
    profileVisibility: z.enum(["public", "limited"]),
    updatedAt: isoDateTimeSchema,
  })
  .strict();
