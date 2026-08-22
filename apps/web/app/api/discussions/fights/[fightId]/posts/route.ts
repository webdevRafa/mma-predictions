import {
  discussionPostInputSchema,
  type DiscussionPost,
  type DiscussionThread,
  type PublicPredictionBadge,
} from "@fightlobby/domain";

import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  parseJson,
} from "@/lib/auth/http";
import { requireMutationSession } from "@/lib/auth/session";
import {
  createDiscussionPostCore,
  listFightDiscussionCore,
} from "@/lib/discussions/server";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { assertValidAppCheck } from "@/lib/firebase/app-check";
import { getPublicPredictionBadges } from "@/lib/predictions/public-badges";

type Context = { params: Promise<{ fightId: string }> };

function withPredictionBadge(
  post: DiscussionPost,
  badges: ReadonlyMap<string, PublicPredictionBadge>,
): DiscussionPost {
  const predictionBadge = badges.get(post.uid);
  return predictionBadge
    ? { ...post, author: { ...post.author, predictionBadge } }
    : post;
}

async function enrichThreads(fightId: string, threads: DiscussionThread[]) {
  const firestore = getFirebaseAdmin().firestore;
  const badges = await getPublicPredictionBadges(
    firestore,
    fightId,
    threads.flatMap((thread) => [
      thread.post.uid,
      ...thread.replies.map((reply) => reply.uid),
    ]),
  );
  return threads.map((thread) => ({
    post: withPredictionBadge(thread.post, badges),
    replies: thread.replies.map((reply) => withPredictionBadge(reply, badges)),
  }));
}

export async function GET(request: Request, { params }: Context) {
  try {
    const url = new URL(request.url);
    const cursorValue = url.searchParams.get("cursor");
    const limitValue = url.searchParams.get("limit");
    const cursor = cursorValue === null ? undefined : Number(cursorValue);
    const limit = limitValue === null ? undefined : Number(limitValue);
    if (cursor !== undefined && (!Number.isInteger(cursor) || cursor < 0))
      throw new ApiError("Invalid discussion cursor", 400, "invalid_cursor");
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1))
      throw new ApiError("Invalid discussion limit", 400, "invalid_limit");
    const { fightId } = await params;
    const page = await listFightDiscussionCore(
      getFirebaseAdmin().firestore,
      fightId,
      {
        ...(cursor === undefined ? {} : { cursor }),
        ...(limit === undefined ? {} : { limit }),
      },
    );
    return Response.json(
      { ...page, threads: await enrichThreads(fightId, page.threads) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request);
    await assertValidAppCheck(request);
    const session = await requireMutationSession();
    const input = await parseJson(request, discussionPostInputSchema);
    const fightId = (await params).fightId;
    const result = await createDiscussionPostCore(
      getFirebaseAdmin().firestore,
      session,
      { fightId, ...input },
    );
    const badges = await getPublicPredictionBadges(
      getFirebaseAdmin().firestore,
      fightId,
      [result.post.uid],
    );
    return Response.json(
      { ...result, post: withPredictionBadge(result.post, badges) },
      { status: result.idempotent ? 200 : 201 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
