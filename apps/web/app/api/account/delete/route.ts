import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";

import { apiErrorResponse, assertSameOrigin, parseJson } from "@/lib/auth/http";
import {
  requireMutationSession,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

const deleteSchema = z.object({ confirmation: z.literal("DELETE") });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireMutationSession();
    await parseJson(request, deleteSchema);
    const { auth, firestore } = getFirebaseAdmin();
    await firestore.runTransaction(async (transaction) => {
      const userRef = firestore.collection("users").doc(session.uid);
      const profileRef = firestore.collection("profiles").doc(session.uid);
      const profile = await transaction.get(profileRef);
      const handle: unknown = profile.get("handleNormalized");
      transaction.set(
        userRef,
        {
          accountStatus: "deleted",
          onboardingComplete: false,
          deletionRequestedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      transaction.set(
        profileRef,
        {
          displayName: "Deleted member",
          profileVisibility: "limited",
          deletedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      if (typeof handle === "string") {
        transaction.set(
          firestore.collection("handles").doc(handle),
          { releasedAt: FieldValue.serverTimestamp(), quarantined: true },
          { merge: true },
        );
      }
    });
    await auth.revokeRefreshTokens(session.uid);
    const response = Response.json({ deleted: true });
    response.headers.append(
      "Set-Cookie",
      `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
    );
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
