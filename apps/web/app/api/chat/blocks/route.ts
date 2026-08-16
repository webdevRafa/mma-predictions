import { z } from "zod";

import { apiErrorResponse, assertSameOrigin, parseJson } from "@/lib/auth/http";
import { getOptionalSession, requireMutationSession } from "@/lib/auth/session";
import { listBlockedUids, setBlockedUserCore } from "@/lib/chat/server";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { assertValidAppCheck } from "@/lib/firebase/app-check";

const inputSchema = z
  .object({
    targetUid: z.string().min(3).max(128),
    blocked: z.boolean(),
  })
  .strict();

export async function GET() {
  try {
    const session = await getOptionalSession();
    if (!session) return Response.json({ authenticated: false, blocked: [] });
    return Response.json({
      authenticated: true,
      blocked: await listBlockedUids(getFirebaseAdmin().firestore, session.uid),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await assertValidAppCheck(request);
    const session = await requireMutationSession();
    const input = await parseJson(request, inputSchema);
    return Response.json(
      await setBlockedUserCore(
        getFirebaseAdmin().firestore,
        session.uid,
        input.targetUid,
        input.blocked,
      ),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
