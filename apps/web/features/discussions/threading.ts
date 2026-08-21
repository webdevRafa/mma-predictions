import type { DiscussionPost, DiscussionThread } from "@fightlobby/domain";

function mergePosts(
  current: DiscussionPost[],
  incoming: DiscussionPost[],
): DiscussionPost[] {
  const byId = new Map(current.map((post) => [post.id, post]));
  for (const post of incoming) byId.set(post.id, post);
  return [...byId.values()].sort((left, right) =>
    left.createdAt === right.createdAt
      ? left.id.localeCompare(right.id)
      : left.createdAt - right.createdAt,
  );
}

export function mergeDiscussionThreads(
  current: DiscussionThread[],
  incoming: DiscussionThread[],
) {
  const byRoot = new Map(current.map((thread) => [thread.post.id, thread]));
  for (const thread of incoming) {
    const existing = byRoot.get(thread.post.id);
    byRoot.set(
      thread.post.id,
      existing
        ? {
            post: {
              ...thread.post,
              replyCount: Math.max(
                existing.post.replyCount,
                thread.post.replyCount,
              ),
            },
            replies: mergePosts(existing.replies, thread.replies),
          }
        : { ...thread, replies: mergePosts([], thread.replies) },
    );
  }
  return [...byRoot.values()];
}

export function sortDiscussionThreads(
  threads: DiscussionThread[],
  order: "newest" | "oldest",
) {
  return [...threads].sort((left, right) => {
    const difference = left.post.createdAt - right.post.createdAt;
    return order === "oldest" ? difference : -difference;
  });
}
