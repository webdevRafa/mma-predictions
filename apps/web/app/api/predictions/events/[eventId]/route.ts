import { apiErrorResponse, ApiError } from "@/lib/auth/http";
import { getOptionalSession } from "@/lib/auth/session";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { getEventPredictionsForUser } from "@/lib/predictions/firestore";

function validEventId(value: string) {
  if (!/^[a-z0-9_]{3,120}$/.test(value)) {
    throw new ApiError("Invalid event ID", 400, "invalid_event_id");
  }
  return value;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const session = await getOptionalSession();
    if (!session) {
      return Response.json({
        authenticated: false,
        onboardingComplete: false,
        predictions: [],
      });
    }
    const eventId = validEventId((await params).eventId);
    const predictions = await getEventPredictionsForUser(
      getFirebaseAdmin().firestore,
      eventId,
      session.uid,
    );
    return Response.json({
      authenticated: true,
      onboardingComplete: session.onboardingComplete,
      predictions,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
