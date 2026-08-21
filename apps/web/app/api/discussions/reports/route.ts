import { discussionReportInputSchema } from "@fightlobby/domain";

import { apiErrorResponse, assertSameOrigin, parseJson } from "@/lib/auth/http";
import { requireMutationSession } from "@/lib/auth/session";
import { reportDiscussionPostCore } from "@/lib/discussions/server";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { assertValidAppCheck } from "@/lib/firebase/app-check";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await assertValidAppCheck(request);
    const session = await requireMutationSession();
    const input = await parseJson(request, discussionReportInputSchema);
    return Response.json(
      await reportDiscussionPostCore(
        getFirebaseAdmin().firestore,
        session.uid,
        input,
      ),
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
