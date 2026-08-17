import { chatPostInputSchema } from "@fightlobby/domain";

import { apiErrorResponse, assertSameOrigin, parseJson } from "@/lib/auth/http";
import { requireMutationSession } from "@/lib/auth/session";
import { postChatMessageCore } from "@/lib/chat/server";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { assertValidAppCheck } from "@/lib/firebase/app-check";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    assertSameOrigin(request);
    await assertValidAppCheck(request);
    const session = await requireMutationSession();
    const input = await parseJson(request, chatPostInputSchema);
    const { firestore, database } = getFirebaseAdmin();
    const result = await postChatMessageCore(firestore, database, session, {
      roomId: (await params).roomId,
      ...input,
    });
    return Response.json(result, { status: result.idempotent ? 200 : 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
