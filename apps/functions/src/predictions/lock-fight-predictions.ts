import { parseStoredPredictionPick } from "@fightlobby/domain";
import {
  FieldPath,
  Timestamp,
  type Firestore,
  type Query,
} from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";

import { requireRole } from "../auth/roles.js";
import { getAdminServices } from "../lib/firebase/admin.js";

const inputSchema = z.object({ fightId: z.string().min(3).max(120) }).strict();

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function fighterName(value: unknown) {
  const name = record(record(value).name);
  return typeof name.full === "string" ? name.full : "Unknown fighter";
}

export async function lockFightPredictionsCore(
  firestore: Firestore,
  fightId: string,
) {
  const fightRef = firestore.collection("fights").doc(fightId);
  const fightState = await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(fightRef);
    if (!snapshot.exists) throw new Error("Fight was not found");
    const value: unknown = snapshot.data();
    const fight = record(value);
    const state = fight.predictionStatus;
    if (!["open", "locked"].includes(String(state))) {
      throw new Error(`Fight predictions cannot lock from ${String(state)}`);
    }
    const lockedAt =
      fight.predictionsLockedAt instanceof Timestamp
        ? fight.predictionsLockedAt
        : Timestamp.now();
    if (state === "open") {
      transaction.set(
        fightRef,
        {
          predictionStatus: "locked",
          predictionsLockedAt: lockedAt,
          updatedAt: Timestamp.now(),
        },
        { merge: true },
      );
    }
    return { fight, lockedAt };
  });

  const fighterAId = fightState.fight.fighterAId;
  const fighterBId = fightState.fight.fighterBId;
  const eventId = fightState.fight.eventId;
  const fightSlug = fightState.fight.slug;
  if (
    typeof fighterAId !== "string" ||
    typeof fighterBId !== "string" ||
    typeof eventId !== "string" ||
    typeof fightSlug !== "string"
  ) {
    throw new Error("Fight identity data is incomplete");
  }
  const names = {
    [fighterAId]: fighterName(fightState.fight.fighterA),
    [fighterBId]: fighterName(fightState.fight.fighterB),
  };
  let cursor: string | undefined;
  let materialized = 0;
  let locked = 0;

  do {
    let query: Query = firestore
      .collection("predictions")
      .where("fightId", "==", fightId)
      .orderBy(FieldPath.documentId())
      .limit(200);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    if (snapshot.empty) break;
    const batch = firestore.batch();
    for (const document of snapshot.docs) {
      const value: unknown = document.data();
      const prediction = record(value);
      if (!["active", "locked"].includes(String(prediction.status))) continue;
      const parsedPick = parseStoredPredictionPick(prediction.pick);
      const uid = prediction.uid;
      if (!parsedPick || typeof uid !== "string") continue;
      if (prediction.status === "active") {
        batch.set(
          document.ref,
          { status: "locked", lockedAt: fightState.lockedAt },
          { merge: true },
        );
        locked += 1;
      }
      const selectedWinnerName = names[parsedPick.winnerFighterId];
      if (!selectedWinnerName) continue;
      batch.set(
        firestore
          .collection("profiles")
          .doc(uid)
          .collection("publicPicks")
          .doc(fightId),
        {
          fightId,
          eventId,
          fightSlug,
          fighterAName: names[fighterAId],
          fighterBName: names[fighterBId],
          selectedWinnerFighterId: parsedPick.winnerFighterId,
          selectedWinnerName,
          method: parsedPick.method,
          ...(parsedPick.detail !== undefined
            ? { detail: parsedPick.detail }
            : {}),
          status: "locked",
          lockedAt: fightState.lockedAt,
        },
        { merge: true },
      );
      materialized += 1;
    }
    await batch.commit();
    cursor = snapshot.docs.at(-1)?.id;
    if (snapshot.size < 200) break;
  } while (cursor);

  return {
    fightId,
    locked,
    materialized,
    lockedAt: fightState.lockedAt.toDate().toISOString(),
  };
}

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
