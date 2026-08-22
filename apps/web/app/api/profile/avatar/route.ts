import { FieldValue } from "firebase-admin/firestore";
import { getDownloadURL } from "firebase-admin/storage";

import {
  assertAvatarMetadata,
  avatarStoragePath,
  nextAvatarVersion,
} from "@/lib/auth/avatar";
import { ApiError, apiErrorResponse, assertSameOrigin } from "@/lib/auth/http";
import { requireMutationSession } from "@/lib/auth/session";
import { assertValidAppCheck } from "@/lib/firebase/app-check";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

function isNotFound(error: unknown) {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    Number(error.code) === 404,
  );
}

async function recordAvatarVersion(
  uid: string,
  storagePath: string | undefined,
) {
  const { firestore } = getFirebaseAdmin();
  const profile = firestore.collection("profiles").doc(uid);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(profile);
    if (!snapshot.exists) {
      throw new ApiError(
        "Account setup is incomplete",
        409,
        "account_incomplete",
      );
    }
    const version = nextAvatarVersion(snapshot.get("avatar"));
    transaction.set(
      profile,
      {
        avatar: {
          ...(storagePath
            ? { storagePath }
            : { storagePath: FieldValue.delete() }),
          version,
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return version;
  });
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await assertValidAppCheck(request);
    const session = await requireMutationSession();
    const admin = getFirebaseAdmin();
    const storagePath = avatarStoragePath(session.uid);
    const file = admin.storage.bucket().file(storagePath);
    const [exists] = await file.exists();
    if (!exists) {
      throw new ApiError(
        "Upload an avatar before saving it",
        400,
        "avatar_missing",
      );
    }
    const [metadata] = await file.getMetadata();
    assertAvatarMetadata(metadata);
    const downloadURL = await getDownloadURL(file);
    const version = await recordAvatarVersion(session.uid, storagePath);
    const photoURL = `${downloadURL}${downloadURL.includes("?") ? "&" : "?"}v=${version}`;
    await admin.auth.updateUser(session.uid, { photoURL });
    return Response.json(
      { photoURL, version },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    await assertValidAppCheck(request);
    const session = await requireMutationSession();
    const admin = getFirebaseAdmin();
    try {
      await admin.storage
        .bucket()
        .file(avatarStoragePath(session.uid))
        .delete();
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
    const version = await recordAvatarVersion(session.uid, undefined);
    await admin.auth.updateUser(session.uid, { photoURL: null });
    return Response.json(
      { photoURL: null, version },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
