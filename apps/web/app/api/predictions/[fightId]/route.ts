import { z } from "zod";

import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  parseJson,
} from "@/lib/auth/http";
import { getOptionalSession, requireMutationSession } from "@/lib/auth/session";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { assertValidAppCheck } from "@/lib/firebase/app-check";
import {
  getPredictionExperience,
  submitPredictionTransaction,
} from "@/lib/predictions/firestore";

const inputSchema = z
  .object({
    requestId: z.uuid(),
    pick: z.unknown(),
  })
  .strict();

function validFightId(value: string) {
  if (!/^[a-z0-9_]{3,120}$/.test(value)) {
    throw new ApiError("Invalid fight ID", 400, "invalid_fight_id");
  }
  return value;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fightId: string }> },
) {
  try {
    const session = await getOptionalSession();
    if (!session)
      return Response.json({ authenticated: false, prediction: null });
    const fightId = validFightId((await params).fightId);
    const experience = await getPredictionExperience(
      getFirebaseAdmin().firestore,
      fightId,
      session.uid,
    );
    return Response.json({ authenticated: true, ...experience });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ fightId: string }> },
) {
  try {
    assertSameOrigin(request);
    await assertValidAppCheck(request);
    const session = await requireMutationSession();
    if (!session.onboardingComplete) {
      return Response.json(
        {
          error: {
            code: "onboarding_required",
            message: "Choose a handle first",
          },
        },
        { status: 409 },
      );
    }
    const fightId = validFightId((await params).fightId);
    const input = await parseJson(request, inputSchema);
    const result = await submitPredictionTransaction(
      getFirebaseAdmin().firestore,
      {
        fightId,
        uid: session.uid,
        pick: input.pick,
        requestId: input.requestId,
      },
    );
    return Response.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
