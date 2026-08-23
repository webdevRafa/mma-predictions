import { z } from "zod";

export const FORUM_DIRECTORY_LIMIT = 40;
export const FORUM_REPLY_PAGE_SIZE = 20;
export const FORUM_TITLE_MAX_LENGTH = 120;
export const FORUM_POST_MAX_LENGTH = 1_000;

export const forumThreadInputSchema = z
  .object({
    title: z.string().trim().min(5).max(FORUM_TITLE_MAX_LENGTH),
    body: z.string().trim().min(3).max(FORUM_POST_MAX_LENGTH),
    clientNonce: z.uuid(),
  })
  .strict();

export const forumReplyInputSchema = z
  .object({
    body: z.string().trim().min(3).max(FORUM_POST_MAX_LENGTH),
    clientNonce: z.uuid(),
  })
  .strict();

export const forumReportInputSchema = z
  .object({
    threadId: z.string().regex(/^[a-z0-9_-]{3,160}$/i),
    postId: z.string().regex(/^[a-z0-9_-]{3,160}$/i),
    postType: z.enum(["thread", "reply"]),
    reason: z.enum([
      "spam",
      "harassment",
      "hate",
      "threat",
      "doxxing",
      "other",
    ]),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export interface ForumAuthor {
  handle: string;
  roleBadge?: "trusted" | "moderator" | "admin";
}

export interface ForumActivity {
  uid: string;
  author: ForumAuthor;
  createdAt: number;
}

export interface ForumThread {
  id: string;
  slug: string;
  uid: string;
  author: ForumAuthor;
  title: string;
  body: string;
  bodyNormalizedHash: string;
  replyCount: number;
  createdAt: number;
  updatedAt: number;
  lastActivityAt: number;
  lastReply?: ForumActivity;
  clientNonce: string;
  status: "published" | "removed";
  moderationVersion: number;
}

export interface ForumReply {
  id: string;
  threadId: string;
  uid: string;
  author: ForumAuthor;
  body: string;
  bodyNormalizedHash: string;
  pageNumber: number;
  createdAt: number;
  updatedAt: number;
  clientNonce: string;
  status: "published" | "removed";
  moderationVersion: number;
}

export interface ForumThreadView extends ForumThread {
  authorPhotoURL: string | null;
  lastReplyPhotoURL: string | null;
}

export interface ForumReplyView extends ForumReply {
  authorPhotoURL: string | null;
}
