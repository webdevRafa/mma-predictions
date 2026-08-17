import { z } from "zod";

import { reserveHandleTransaction } from "@/lib/auth/handles";
import { apiErrorResponse, assertSameOrigin, parseJson } from "@/lib/auth/http";
import { requireMutationSession } from "@/lib/auth/session";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

const requestSchema = z.object({
  handle: z.string().min(1).max(40),
  acceptedTerms: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireMutationSession();
    const input = await parseJson(request, requestSchema);
    const result = await reserveHandleTransaction(
      getFirebaseAdmin().firestore,
      session.uid,
      input.handle,
      input.acceptedTerms,
    );
    return Response.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
