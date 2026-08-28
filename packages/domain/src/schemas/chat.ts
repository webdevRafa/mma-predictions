import { z } from "zod";

import { publicPredictionBadgeSchema } from "./domain.ts";

export const chatRoomStatusSchema = z.enum([
  "scheduled",
  "open",
  "slow_mode",
  "read_only",
  "closed",
]);

export const chatRoleBadgeSchema = z.enum(["trusted", "moderator", "admin"]);

export const chatReplySchema = z
  .object({
    messageId: z.string().min(8).max(120),
    uid: z.string().min(1).max(128),
    handle: z.string().min(3).max(20),
    excerpt: z.string().min(1).max(80),
  })
  .strict();

export const chatMessageSchema = z
  .object({
    id: z.string().min(8).max(120),
    roomId: z.string().min(3).max(160),
    uid: z.string().min(1).max(128),
    author: z
      .object({
        handle: z.string().min(3).max(20),
        avatarVersion: z.number().int().nonnegative(),
        roleBadge: chatRoleBadgeSchema.optional(),
        predictionBadge: publicPredictionBadgeSchema.optional(),
      })
      .strict(),
    body: z.string().min(1).max(240),
    bodyNormalizedHash: z.string().length(64),
    replyTo: chatReplySchema.optional(),
    createdAt: z.number().int().nonnegative(),
    clientNonce: z.uuid(),
    status: z.enum(["published", "removed"]),
    moderationVersion: z.number().int().positive(),
  })
  .strict();

export const chatPostInputSchema = z
  .object({
    body: z.string().max(2_000),
    clientNonce: z.uuid(),
    replyToMessageId: z.string().min(8).max(120).optional(),
  })
  .strict();

export const chatReportInputSchema = z
  .object({
    roomId: z.string().min(3).max(160),
    messageId: z.string().min(8).max(120),
    reason: z.enum([
      "harassment",
      "hate",
      "threat",
      "spam",
      "doxxing",
      "sexual_content",
      "other",
    ]),
    note: z.string().trim().max(300).optional(),
  })
  .strict();
