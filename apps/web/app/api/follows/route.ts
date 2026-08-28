import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  parseJson,
} from "@/lib/auth/http";
import { getOptionalSession, requireMutationSession } from "@/lib/auth/session";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

const uidSchema = z.string().regex(/^[a-zA-Z0-9_-]{3,128}$/);
const followSchema = z.object({ targetUid: uidSchema }).strict();

export async function GET(request: Request) {
  try {
    const session = await getOptionalSession();
    const target = new URL(request.url).searchParams.get("targetUid");
    if (!session)
      return Response.json({ authenticated: false, following: false });
    const { firestore } = getFirebaseAdmin();
    if (target) {
      const targetUid = uidSchema.parse(target);
      const following = (
        await firestore
          .collection("users")
          .doc(session.uid)
          .collection("follows")
          .doc(`user_${targetUid}`)
          .get()
      ).exists;
      return Response.json({
        authenticated: true,
        following,
        self: targetUid === session.uid,
      });
    }

    const follows = await firestore
      .collection("users")
      .doc(session.uid)
      .collection("follows")
      .where("targetType", "==", "user")
      .limit(250)
      .get();
    const targetUids = follows.docs.flatMap((document) => {
      const targetUid: unknown = document.get("targetUid");
      return typeof targetUid === "string" ? [targetUid] : [];
    });
    const profiles =
      targetUids.length > 0
        ? await firestore.getAll(
            ...targetUids.map((uid) =>
              firestore.collection("profiles").doc(uid),
            ),
          )
        : [];
    return Response.json({
      authenticated: true,
      follows: profiles.flatMap((profile) => {
        const handle: unknown = profile.get("handle");
        const displayName: unknown = profile.get("displayName");
        if (!profile.exists || typeof handle !== "string") return [];
        return [
          {
            uid: profile.id,
            handle,
            ...(typeof displayName === "string" ? { displayName } : {}),
          },
        ];
      }),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireMutationSession();
    if (!session.onboardingComplete)
      throw new ApiError(
        "Choose a handle before following members",
        409,
        "onboarding_required",
      );
    const { targetUid } = await parseJson(request, followSchema);
    if (targetUid === session.uid)
      throw new ApiError("You cannot follow yourself", 400, "self_follow");
    const { firestore } = getFirebaseAdmin();
    const [targetUser, targetProfile] = await Promise.all([
      firestore.collection("users").doc(targetUid).get(),
      firestore.collection("profiles").doc(targetUid).get(),
    ]);
    const handle: unknown = targetProfile.get("handle");
    if (
      !targetUser.exists ||
      targetUser.get("accountStatus") !== "active" ||
      targetUser.get("onboardingComplete") !== true ||
      !targetProfile.exists ||
      typeof handle !== "string"
    )
      throw new ApiError("Member was not found", 404, "target_not_found");
    await firestore
      .collection("users")
      .doc(session.uid)
      .collection("follows")
      .doc(`user_${targetUid}`)
      .set({
        targetType: "user",
        targetUid,
        handle,
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
    const { targetUid } = await parseJson(request, followSchema);
    await getFirebaseAdmin()
      .firestore.collection("users")
      .doc(session.uid)
      .collection("follows")
      .doc(`user_${targetUid}`)
      .delete();
    return Response.json({ following: false });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
