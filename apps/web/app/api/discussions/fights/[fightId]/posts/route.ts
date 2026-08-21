import { discussionPostInputSchema } from "@fightlobby/domain";

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

type Context = { params: Promise<{ fightId: string }> };

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
    return Response.json(
      await listFightDiscussionCore(getFirebaseAdmin().firestore, fightId, {
        ...(cursor === undefined ? {} : { cursor }),
        ...(limit === undefined ? {} : { limit }),
      }),
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
    const result = await createDiscussionPostCore(
      getFirebaseAdmin().firestore,
      session,
      { fightId: (await params).fightId, ...input },
    );
    return Response.json(result, { status: result.idempotent ? 200 : 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
