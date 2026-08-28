import { accountStatusSchema, handleSchema } from "@fightlobby/domain";
import {
  FieldValue,
  Timestamp,
  type Firestore,
} from "firebase-admin/firestore";

import { ApiError } from "./http";
import { assertMutationAllowed } from "./policy";

const HANDLE_CHANGE_WAIT_MS = 30 * 24 * 60 * 60 * 1000;

export async function getHandleAvailability(
  firestore: Firestore,
  uid: string,
  requestedHandle: string,
) {
  const parsedHandle = handleSchema.safeParse(requestedHandle);
  if (!parsedHandle.success) {
    throw new ApiError(
      parsedHandle.error.issues[0]?.message ?? "That handle is invalid",
      400,
      "invalid_handle",
    );
  }

  const handle = parsedHandle.data;
  const reservation = await firestore.collection("handles").doc(handle).get();
  const existingOwner: unknown = reservation.get("uid");
  const redirectTo: unknown = reservation.get("redirectTo");
  const available =
    !reservation.exists ||
    (existingOwner === uid && typeof redirectTo !== "string");

  return { handle, available };
}

export async function reserveHandleTransaction(
  firestore: Firestore,
  uid: string,
  requestedHandle: string,
  acceptTerms = false,
) {
  const parsedHandle = handleSchema.safeParse(requestedHandle);
  if (!parsedHandle.success) {
    throw new ApiError(
      parsedHandle.error.issues[0]?.message ?? "That handle is invalid",
      400,
      "invalid_handle",
    );
  }
  const handle = parsedHandle.data;
  const userRef = firestore.collection("users").doc(uid);
  const profileRef = firestore.collection("profiles").doc(uid);
  const handleRef = firestore.collection("handles").doc(handle);

  return firestore.runTransaction(async (transaction) => {
    const [user, profile, reservation] = await Promise.all([
      transaction.get(userRef),
      transaction.get(profileRef),
      transaction.get(handleRef),
    ]);
    if (!user.exists || !profile.exists) {
      throw new ApiError(
        "Account setup is incomplete",
        409,
        "account_incomplete",
      );
    }
    const parsedStatus = accountStatusSchema.safeParse(
      user.get("accountStatus"),
    );
    if (!parsedStatus.success) {
      throw new ApiError(
        "This account cannot make changes",
        403,
        "account_invalid",
      );
    }
    assertMutationAllowed(parsedStatus.data);
    if (user.get("termsVersion") === "pending" && !acceptTerms) {
      throw new ApiError(
        "Accept the terms to finish account setup",
        400,
        "terms_required",
      );
    }
    const existingOwner: unknown = reservation.get("uid");
    if (reservation.exists && existingOwner !== uid) {
      throw new ApiError(
        "That handle is already taken",
        409,
        "handle_unavailable",
      );
    }

    const currentHandle: unknown = profile.get("handleNormalized");
    if (currentHandle === handle) return { handle, changed: false };
    const changedAt: unknown = profile.get("handleChangedAt");
    if (
      typeof currentHandle === "string" &&
      changedAt instanceof Timestamp &&
      Date.now() - changedAt.toMillis() < HANDLE_CHANGE_WAIT_MS
    ) {
      throw new ApiError(
        "Handles can be changed once every 30 days",
        429,
        "handle_change_limited",
      );
    }

    if (!reservation.exists) {
      transaction.create(handleRef, {
        uid,
        handle,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    if (typeof currentHandle === "string") {
      transaction.set(
        firestore.collection("handles").doc(currentHandle),
        {
          uid,
          handle: currentHandle,
          releasedAt: FieldValue.serverTimestamp(),
          redirectTo: handle,
        },
        { merge: true },
      );
    }
    transaction.set(
      profileRef,
      {
        handle,
        handleNormalized: handle,
        ...(typeof currentHandle === "string"
          ? { handleHistory: FieldValue.arrayUnion(currentHandle) }
          : { handleHistory: [] }),
        handleChangedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    transaction.set(
      userRef,
      {
        onboardingComplete: true,
        ...(acceptTerms
          ? {
              termsVersion: "2026-08-16",
              termsAcceptedAt: FieldValue.serverTimestamp(),
            }
          : {}),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return { handle, changed: true };
  });
}
