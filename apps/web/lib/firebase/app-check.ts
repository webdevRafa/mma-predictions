import "server-only";

import { ApiError } from "@/lib/auth/http";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export async function assertValidAppCheck(request: Request) {
  const enforced = process.env.FIREBASE_APP_CHECK_ENFORCED === "true";
  const token = request.headers.get("X-Firebase-AppCheck");
  if (!token) {
    if (enforced)
      throw new ApiError(
        "App verification is required",
        401,
        "app_check_required",
      );
    return;
  }
  try {
    await getFirebaseAdmin().appCheck.verifyToken(token);
  } catch {
    throw new ApiError("App verification failed", 401, "app_check_invalid");
  }
}
