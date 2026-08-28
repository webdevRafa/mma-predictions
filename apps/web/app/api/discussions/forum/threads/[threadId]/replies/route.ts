import { apiErrorResponse, assertSameOrigin, parseJson } from "@/lib/auth/http";
import { requireMutationSession } from "@/lib/auth/session";
import { createForumReplyCore } from "@/lib/forum/server";
import { forumReplyInputSchema } from "@/lib/forum/types";
import { assertValidAppCheck } from "@/lib/firebase/app-check";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

type Context = { params: Promise<{ threadId: string }> };

export async function POST(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request);
    await assertValidAppCheck(request);
    const session = await requireMutationSession();
    const input = await parseJson(request, forumReplyInputSchema);
    const { threadId } = await params;
    const result = await createForumReplyCore(
      getFirebaseAdmin().firestore,
      session,
      { threadId, ...input },
    );
    return Response.json(result, {
      status: result.idempotent ? 200 : 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
