import { apiErrorResponse } from "@/lib/auth/http";
import { requireSessionIdentity } from "@/lib/auth/session";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export async function GET() {
  try {
    const session = await requireSessionIdentity();
    const profile = await getFirebaseAdmin()
      .firestore.collection("profiles")
      .doc(session.uid)
      .get();
    const handle: unknown = profile.get("handle");
    return Response.json(
      { handle: typeof handle === "string" ? handle : null },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
