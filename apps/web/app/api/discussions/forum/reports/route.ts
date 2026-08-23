import { apiErrorResponse, assertSameOrigin, parseJson } from "@/lib/auth/http";
import { requireMutationSession } from "@/lib/auth/session";
import { reportForumPostCore } from "@/lib/forum/server";
import { forumReportInputSchema } from "@/lib/forum/types";
import { assertValidAppCheck } from "@/lib/firebase/app-check";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await assertValidAppCheck(request);
    const session = await requireMutationSession();
    const input = await parseJson(request, forumReportInputSchema);
    const result = await reportForumPostCore(
      getFirebaseAdmin().firestore,
      session.uid,
      input,
    );
    return Response.json(result, {
      status: result.duplicate ? 200 : 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
