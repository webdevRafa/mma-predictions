import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";

import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  parseJson,
} from "@/lib/auth/http";
import { getOptionalSession, requireMutationSession } from "@/lib/auth/session";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

const followSchema = z
  .object({
    targetType: z.enum(["event", "fighter"]),
    targetId: z.string().min(1).max(120),
  })
  .strict();

export async function GET() {
  try {
    const session = await getOptionalSession();
    if (!session)
      throw new ApiError("Authentication is required", 401, "unauthenticated");
    const snapshot = await getFirebaseAdmin()
      .firestore.collection("users")
      .doc(session.uid)
      .collection("follows")
      .limit(250)
      .get();
    return Response.json({ follows: snapshot.docs.map((doc) => doc.data()) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireMutationSession();
    const input = await parseJson(request, followSchema);
    const { firestore } = getFirebaseAdmin();
    const collectionName = input.targetType === "event" ? "events" : "fighters";
    if (
      !(await firestore.collection(collectionName).doc(input.targetId).get())
        .exists
    ) {
      throw new ApiError(
        "Follow target was not found",
        404,
        "target_not_found",
      );
    }
    await firestore
      .collection("users")
      .doc(session.uid)
      .collection("follows")
      .doc(`${input.targetType}_${input.targetId}`)
      .set({
        ...input,
        createdAt: FieldValue.serverTimestamp(),
      });
    return Response.json({ following: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireMutationSession();
    const input = await parseJson(request, followSchema);
    await getFirebaseAdmin()
      .firestore.collection("users")
      .doc(session.uid)
      .collection("follows")
      .doc(`${input.targetType}_${input.targetId}`)
      .delete();
    return Response.json({ following: false });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
