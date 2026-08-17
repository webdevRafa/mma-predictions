import { FieldValue } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

import { gradeFightPredictionsCore } from "../grading/grade-fight-predictions.js";
import { getAdminServices } from "../lib/firebase/admin.js";

export const processAdminJob = onDocumentCreated(
  { document: "adminJobs/{jobId}", retry: true, timeoutSeconds: 540 },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;
    const type: unknown = snapshot.get("type");
    const fightId: unknown = snapshot.get("fightId");
    if (type !== "regrade_fight" || typeof fightId !== "string") {
      await snapshot.ref.set(
        {
          status: "rejected",
          error: "Unsupported admin job",
          completedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return;
    }
    await snapshot.ref.set(
      { status: "processing", startedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    try {
      const result = await gradeFightPredictionsCore(
        getAdminServices().firestore,
        fightId,
        String(snapshot.get("reason") ?? "admin_result_correction"),
      );
      await snapshot.ref.set(
        {
          status: "complete",
          result,
          completedAt: FieldValue.serverTimestamp(),
          error: FieldValue.delete(),
        },
        { merge: true },
      );
    } catch (error) {
      await snapshot.ref.set(
        {
          status: "failed",
          error:
            error instanceof Error ? error.message : "Unknown admin job error",
          failedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      throw error;
    }
  },
);
