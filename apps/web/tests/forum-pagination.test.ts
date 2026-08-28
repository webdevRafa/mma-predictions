import { describe, expect, it } from "vitest";

import {
  clampForumPage,
  forumPageCount,
  forumPaginationItems,
  forumReplyPageNumber,
} from "../lib/forum/pagination.ts";
import { forumThreadPath } from "../lib/forum/path.ts";
import {
  forumReplyInputSchema,
  forumThreadInputSchema,
} from "../lib/forum/types.ts";

describe("forum pagination", () => {
  it("assigns replies to stable twenty-reply page buckets", () => {
    expect(forumReplyPageNumber(0)).toBe(1);
    expect(forumReplyPageNumber(19)).toBe(1);
    expect(forumReplyPageNumber(20)).toBe(2);
    expect(forumReplyPageNumber(40)).toBe(3);
  });

  it("clamps invalid and out-of-range requests", () => {
    expect(forumPageCount(0)).toBe(1);
    expect(forumPageCount(41)).toBe(3);
    expect(clampForumPage(-1, 41)).toBe(1);
    expect(clampForumPage(99, 41)).toBe(3);
  });

  it("keeps pagination compact around the active page", () => {
    expect(forumPaginationItems(5, 10)).toEqual([1, 4, 5, 6, 10]);
  });
});

describe("forum contracts", () => {
  it("validates bounded thread and reply payloads", () => {
    const clientNonce = "00000000-0000-4000-8000-000000000000";
    expect(
      forumThreadInputSchema.parse({
        title: "  Who wins this weekend?  ",
        body: "  Give me your read.  ",
        clientNonce,
      }),
    ).toMatchObject({
      title: "Who wins this weekend?",
      body: "Give me your read.",
    });
    expect(
      forumReplyInputSchema.safeParse({ body: "ok", clientNonce }).success,
    ).toBe(false);
  });

  it("keeps URLs independent from mutable author handles", () => {
    const thread = { id: "thread_immutable_123", slug: "china-fight-night" };
    expect(forumThreadPath(thread)).toBe(
      "/discussions/thread_immutable_123/china-fight-night",
    );
  });
});
