import { apiErrorResponse, assertSameOrigin, parseJson } from "@/lib/auth/http";
import { requireMutationSession } from "@/lib/auth/session";
import { createForumThreadCore } from "@/lib/forum/server";
import { forumThreadInputSchema } from "@/lib/forum/types";
import { assertValidAppCheck } from "@/lib/firebase/app-check";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await assertValidAppCheck(request);
    const session = await requireMutationSession();
    const input = await parseJson(request, forumThreadInputSchema);
    const result = await createForumThreadCore(
      getFirebaseAdmin().firestore,
      session,
      input,
    );
    return Response.json(result, {
      status: result.idempotent ? 200 : 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
