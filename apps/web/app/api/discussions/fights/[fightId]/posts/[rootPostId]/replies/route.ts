import {
  type DiscussionPost,
  type PublicPredictionBadge,
} from "@fightlobby/domain";

import { apiErrorResponse } from "@/lib/auth/http";
import { listFightDiscussionRepliesCore } from "@/lib/discussions/server";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { getPublicPredictionBadges } from "@/lib/predictions/public-badges";

type Context = {
  params: Promise<{ fightId: string; rootPostId: string }>;
};

function withPredictionBadge(
  post: DiscussionPost,
  badges: ReadonlyMap<string, PublicPredictionBadge>,
) {
  const predictionBadge = badges.get(post.uid);
  return predictionBadge
    ? { ...post, author: { ...post.author, predictionBadge } }
    : post;
}

export async function GET(_request: Request, { params }: Context) {
  try {
    const { fightId, rootPostId } = await params;
    const firestore = getFirebaseAdmin().firestore;
    const replies = await listFightDiscussionRepliesCore(
      firestore,
      fightId,
      rootPostId,
    );
    const badges = await getPublicPredictionBadges(
      firestore,
      fightId,
      replies.map((reply) => reply.uid),
    );
    return Response.json(
      {
        replies: replies.map((reply) => withPredictionBadge(reply, badges)),
      },
      { headers: { "Cache-Control": "private, max-age=15" } },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
