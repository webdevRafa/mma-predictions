import { lockFightPredictionsCore } from "@fightlobby/firebase-ops";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";

import { requireRole } from "../auth/roles.js";
import { getAdminServices } from "../lib/firebase/admin.js";

const inputSchema = z.object({ fightId: z.string().min(3).max(120) }).strict();

export { lockFightPredictionsCore } from "@fightlobby/firebase-ops";

export const lockFightPredictions = onCall(
  { enforceAppCheck: true },
  async (request) => {
    requireRole(request.auth?.token, ["admin"]);
    const input = inputSchema.safeParse(request.data);
    if (!input.success)
      throw new HttpsError("invalid-argument", "A valid fightId is required");
    try {
      return await lockFightPredictionsCore(
        getAdminServices().firestore,
        input.data.fightId,
      );
    } catch (error) {
      throw new HttpsError(
        "failed-precondition",
        error instanceof Error ? error.message : "Fight could not be locked",
      );
    }
  },
);
