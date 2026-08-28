import type { DiscussionPost, DiscussionThread } from "@fightlobby/domain";
import { describe, expect, it } from "vitest";

import {
  mergeDiscussionThreads,
  sortDiscussionThreads,
} from "../features/discussions/threading.ts";

function post(id: string, createdAt: number): DiscussionPost {
  return {
    id,
    fightId: "fight_123",
    uid: `user_${id}`,
    author: { handle: `member_${id}` },
    body: `Post ${id}`,
    bodyNormalizedHash: "a".repeat(64),
    rootPostId: id,
    replyCount: 0,
    createdAt,
    updatedAt: createdAt,
    clientNonce: "00000000-0000-4000-8000-000000000000",
    status: "published",
    moderationVersion: 1,
  };
}

describe("discussion threading", () => {
  it("merges roots and deduplicates replies without flattening threads", () => {
    const root = post("rootpost1", 10);
    const firstReply = { ...post("reply001", 20), rootPostId: root.id };
    const secondReply = { ...post("reply002", 30), rootPostId: root.id };
    const current: DiscussionThread[] = [
      { post: { ...root, replyCount: 1 }, replies: [firstReply] },
    ];
    const merged = mergeDiscussionThreads(current, [
      {
        post: { ...root, replyCount: 2 },
        replies: [secondReply, firstReply],
      },
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.post.replyCount).toBe(2);
    expect(merged[0]?.replies.map((reply) => reply.id)).toEqual([
      "reply001",
      "reply002",
    ]);
  });

  it("sorts only sibling roots and preserves reply order", () => {
    const older = post("rootpost1", 10);
    const newer = post("rootpost2", 30);
    const threads = [
      { post: older, replies: [post("reply001", 20)] },
      { post: newer, replies: [] },
    ];

    expect(sortDiscussionThreads(threads, "newest")[0]?.post.id).toBe(
      "rootpost2",
    );
    expect(sortDiscussionThreads(threads, "oldest")[0]?.post.id).toBe(
      "rootpost1",
    );
  });
});
