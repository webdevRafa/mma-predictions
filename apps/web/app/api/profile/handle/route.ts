import { z } from "zod";

import {
  getHandleAvailability,
  reserveHandleTransaction,
} from "@/lib/auth/handles";
import { apiErrorResponse, assertSameOrigin, parseJson } from "@/lib/auth/http";
import {
  requireMutationSession,
  requireSessionIdentity,
} from "@/lib/auth/session";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

const requestSchema = z.object({
  handle: z.string().min(1).max(40),
  acceptedTerms: z.boolean().default(false),
});

const availabilityQuerySchema = z.object({
  handle: z.string().min(1).max(40),
});

export async function GET(request: Request) {
  try {
    const session = await requireSessionIdentity();
    const query = availabilityQuerySchema.parse({
      handle: new URL(request.url).searchParams.get("handle"),
    });
    const result = await getHandleAvailability(
      getFirebaseAdmin().firestore,
      session.uid,
      query.handle,
    );
    return Response.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          error: {
            code: "invalid_handle",
            message: error.issues[0]?.message ?? "That handle is invalid",
          },
        },
        { status: 400 },
      );
    }
    return apiErrorResponse(error);
  }
}

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
