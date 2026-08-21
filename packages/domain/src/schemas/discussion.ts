import { z } from "zod";

import { chatRoleBadgeSchema } from "./chat.ts";

const discussionAuthorSchema = z
  .object({
    handle: z.string().min(3).max(20),
    roleBadge: chatRoleBadgeSchema.optional(),
  })
  .strict();

export const discussionReplySnapshotSchema = z
  .object({
    postId: z.string().min(8).max(120),
    uid: z.string().min(1).max(128),
    handle: z.string().min(3).max(20),
    excerpt: z.string().min(1).max(120),
  })
  .strict();

export const discussionPostSchema = z
  .object({
    id: z.string().min(8).max(120),
    fightId: z.string().min(3).max(160),
    uid: z.string().min(1).max(128),
    author: discussionAuthorSchema,
    body: z.string().min(1).max(1_000),
    bodyNormalizedHash: z.string().length(64),
    rootPostId: z.string().min(8).max(120),
    parentPostId: z.string().min(8).max(120).optional(),
    replyTo: discussionReplySnapshotSchema.optional(),
    replyCount: z.number().int().nonnegative(),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
    clientNonce: z.uuid(),
    status: z.enum(["published", "removed"]),
    moderationVersion: z.number().int().positive(),
  })
  .strict();

export const discussionThreadSchema = z
  .object({
    post: discussionPostSchema,
    replies: z.array(discussionPostSchema),
  })
  .strict();

export const discussionPageSchema = z
  .object({
    threads: z.array(discussionThreadSchema),
    nextCursor: z.number().int().nonnegative().nullable(),
  })
  .strict();

export const discussionPostInputSchema = z
  .object({
    body: z.string().max(2_000),
    clientNonce: z.uuid(),
    rootPostId: z.string().min(8).max(120).optional(),
    parentPostId: z.string().min(8).max(120).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (Boolean(value.rootPostId) === Boolean(value.parentPostId)) return;
    context.addIssue({
      code: "custom",
      message: "Replies require both a thread and parent post",
      path: [value.rootPostId ? "parentPostId" : "rootPostId"],
    });
  });

export const discussionReportInputSchema = z
  .object({
    fightId: z.string().min(3).max(160),
    postId: z.string().min(8).max(120),
    rootPostId: z.string().min(8).max(120),
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
