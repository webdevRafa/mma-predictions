import { apiErrorResponse } from "@/lib/auth/http";
import { requireSessionIdentity } from "@/lib/auth/session";
import { getPrivatePredictionHistory } from "@/lib/data/prediction-history";

export async function GET() {
  try {
    const session = await requireSessionIdentity();
    return Response.json(await getPrivatePredictionHistory(session.uid), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
