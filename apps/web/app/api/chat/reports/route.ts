import { chatReportInputSchema } from "@fightlobby/domain";

import { apiErrorResponse, assertSameOrigin, parseJson } from "@/lib/auth/http";
import { requireMutationSession } from "@/lib/auth/session";
import { reportChatMessageCore } from "@/lib/chat/server";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { assertValidAppCheck } from "@/lib/firebase/app-check";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await assertValidAppCheck(request);
    const session = await requireMutationSession();
    const input = await parseJson(request, chatReportInputSchema);
    const { firestore, database } = getFirebaseAdmin();
    return Response.json(
      await reportChatMessageCore(firestore, database, session.uid, input),
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
