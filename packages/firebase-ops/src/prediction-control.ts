import { parseStoredPredictionPick } from "@fightlobby/domain";
import {
  FieldPath,
  FieldValue,
  Timestamp,
  type Firestore,
  type Query,
} from "firebase-admin/firestore";

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
    const fight = record(snapshot.data());
    const state = fight.predictionStatus;
    if (!["open", "locked"].includes(String(state)))
      throw new Error(`Fight predictions cannot lock from ${String(state)}`);
    const lockedAt =
      fight.predictionsLockedAt instanceof Timestamp
        ? fight.predictionsLockedAt
        : Timestamp.now();
    if (state === "open")
      transaction.set(
        fightRef,
        {
          predictionStatus: "locked",
          predictionsLockedAt: lockedAt,
          updatedAt: Timestamp.now(),
        },
        { merge: true },
      );
    return { fight, lockedAt, changed: state === "open" };
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
  )
    throw new Error("Fight identity data is incomplete");
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
      const prediction = record(document.data());
      if (!["active", "locked"].includes(String(prediction.status))) continue;
      const pick = parseStoredPredictionPick(prediction.pick);
      const uid = prediction.uid;
      if (!pick || typeof uid !== "string") continue;
      if (prediction.status === "active") {
        batch.set(
          document.ref,
          { status: "locked", lockedAt: fightState.lockedAt },
          { merge: true },
        );
        locked += 1;
      }
      const selectedWinnerName = names[pick.winnerFighterId];
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
          selectedWinnerFighterId: pick.winnerFighterId,
          selectedWinnerName,
          method: pick.method,
          ...(pick.detail !== undefined ? { detail: pick.detail } : {}),
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
    changed: fightState.changed,
    locked,
    materialized,
    lockedAt: fightState.lockedAt.toDate().toISOString(),
  };
}

export async function reopenFightPredictionsCore(
  firestore: Firestore,
  fightId: string,
) {
  const fightRef = firestore.collection("fights").doc(fightId);
  const initial = await fightRef.get();
  if (!initial.exists) throw new Error("Fight was not found");
  const initialState: unknown = initial.get("predictionStatus");
  if (initialState === "open")
    return { fightId, changed: false, hiddenPublicPicks: 0 };
  if (initialState !== "locked")
    throw new Error(
      `Fight predictions cannot reopen from ${String(initialState)}`,
    );

  let cursor: string | undefined;
  let hiddenPublicPicks = 0;
  do {
    let query: Query = firestore
      .collection("predictions")
      .where("fightId", "==", fightId)
      .orderBy(FieldPath.documentId())
      .limit(200);
    if (cursor) query = query.startAfter(cursor);
    const predictions = await query.get();
    if (predictions.empty) break;
    const batch = firestore.batch();
    for (const prediction of predictions.docs) {
      const uid: unknown = prediction.get("uid");
      if (typeof uid !== "string") continue;
      batch.delete(
        firestore
          .collection("profiles")
          .doc(uid)
          .collection("publicPicks")
          .doc(fightId),
      );
      hiddenPublicPicks += 1;
    }
    await batch.commit();
    cursor = predictions.docs.at(-1)?.id;
    if (predictions.size < 200) break;
  } while (cursor);

  await firestore.runTransaction(async (transaction) => {
    const current = await transaction.get(fightRef);
    if (!current.exists) throw new Error("Fight was not found");
    if (current.get("predictionStatus") !== "locked")
      throw new Error("Fight prediction state changed while reopening");
    transaction.set(
      fightRef,
      {
        predictionStatus: "open",
        predictionsLockedAt: FieldValue.delete(),
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    );
  });
  return { fightId, changed: true, hiddenPublicPicks };
}
