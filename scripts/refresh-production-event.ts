import { readFile } from "node:fs/promises";
import path from "node:path";

import { parseFixture } from "@fightlobby/domain";
import {
  applicationDefault,
  deleteApp,
  initializeApp,
} from "firebase-admin/app";
import {
  Timestamp,
  getFirestore,
  type DocumentSnapshot,
} from "firebase-admin/firestore";

const expectedProjectId = "mma-cortex";
const expectedEventId = "evt_ufc_fn_2026_08_22";
const expectedEventName = "UFC Fight Night: Hernandez vs Rodrigues";
const requiredConfirmation = "REFRESH_AUGUST_22_CARD";

function sorted(values: string[]) {
  return [...values].sort();
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function snapshotField(snapshot: DocumentSnapshot, field: string): unknown {
  const data: unknown = snapshot.data();
  if (!data || typeof data !== "object") return undefined;
  return Reflect.get(data, field) as unknown;
}

async function main() {
  const fixtureFilename = process.argv[2];
  if (!fixtureFilename)
    throw new Error("Usage: pnpm refresh:production:event -- <fixture.json>");

  const rawFixture: unknown = JSON.parse(
    await readFile(path.resolve(fixtureFilename), "utf8"),
  );
  const card = parseFixture(rawFixture);
  if (
    card.event.id !== expectedEventId ||
    card.event.name !== expectedEventName
  )
    throw new Error(
      `This guarded refresh only supports ${expectedEventName} (${expectedEventId})`,
    );
  if (!card.event.prelimsStartsAt || !card.event.mainCardStartsAt)
    throw new Error("The reviewed fixture must include both broadcast starts");
  if (process.env.FIGHTLOBBY_PRODUCTION_PROJECT_ID !== expectedProjectId)
    throw new Error(
      `Set FIGHTLOBBY_PRODUCTION_PROJECT_ID=${expectedProjectId} before inspecting or changing production`,
    );

  const app = initializeApp({
    credential: applicationDefault(),
    projectId: expectedProjectId,
  });
  try {
    const firestore = getFirestore(app);
    const eventReference = firestore.collection("events").doc(card.event.id);
    const [eventSnapshot, fightSnapshot, predictionSnapshot] =
      await Promise.all([
        eventReference.get(),
        firestore
          .collection("fights")
          .where("eventId", "==", card.event.id)
          .get(),
        firestore
          .collection("predictions")
          .where("eventId", "==", card.event.id)
          .get(),
      ]);
    if (!eventSnapshot.exists)
      throw new Error(`Production event ${card.event.id} was not found`);
    if (snapshotField(eventSnapshot, "name") !== expectedEventName)
      throw new Error("Production event identity does not match the fixture");

    const currentFightIds = sorted(fightSnapshot.docs.map(({ id }) => id));
    const fixtureFightIds = sorted(card.fights.map(({ id }) => id));
    if (JSON.stringify(currentFightIds) !== JSON.stringify(fixtureFightIds))
      throw new Error(
        "The live card changed. Reconcile the official UFC card before refreshing metadata.",
      );

    const fixtureFightById = new Map(
      card.fights.map((fight) => [fight.id, fight]),
    );
    const currentFightById = new Map(
      fightSnapshot.docs.map((fight) => [fight.id, fight]),
    );
    for (const fightSnapshot of currentFightById.values()) {
      const fixtureFight = fixtureFightById.get(fightSnapshot.id);
      const currentParticipants = sorted(
        [
          snapshotField(fightSnapshot, "fighterAId"),
          snapshotField(fightSnapshot, "fighterBId"),
        ].filter((value): value is string => typeof value === "string"),
      );
      const fixtureParticipants = fixtureFight
        ? sorted([fixtureFight.fighterAId, fixtureFight.fighterBId])
        : [];
      if (
        currentParticipants.length !== 2 ||
        JSON.stringify(currentParticipants) !==
          JSON.stringify(fixtureParticipants)
      )
        throw new Error(
          `Fight identity changed for ${fightSnapshot.id}. Refusing to move prediction-linked data.`,
        );
    }

    for (const prediction of predictionSnapshot.docs) {
      const data = record(prediction.data());
      const fightId = data.fightId;
      const winnerFighterId = record(data.pick).winnerFighterId;
      const fixtureFight =
        typeof fightId === "string" ? fixtureFightById.get(fightId) : undefined;
      if (
        !fixtureFight ||
        typeof winnerFighterId !== "string" ||
        ![fixtureFight.fighterAId, fixtureFight.fighterBId].includes(
          winnerFighterId,
        )
      )
        throw new Error(
          `Prediction identity check failed for ${prediction.id}. No production data changed.`,
        );
    }

    const cardChanges = card.fights.flatMap((fight) => {
      const current = currentFightById.get(fight.id);
      if (!current)
        throw new Error(`Production fight ${fight.id} was not found`);
      const before = {
        cardSegment: snapshotField(current, "cardSegment"),
        boutOrder: snapshotField(current, "boutOrder"),
      };
      const after = {
        cardSegment: fight.cardSegment,
        boutOrder: fight.boutOrder,
      };
      return JSON.stringify(before) === JSON.stringify(after)
        ? []
        : [{ fightId: fight.id, before, after }];
    });

    console.log(
      JSON.stringify(
        {
          projectId: expectedProjectId,
          eventId: card.event.id,
          currentMainCardStartsAt: snapshotField(eventSnapshot, "startsAt"),
          nextPrelimsStartsAt: card.event.prelimsStartsAt,
          nextMainCardStartsAt: card.event.mainCardStartsAt,
          fightDocumentsToUpdate: cardChanges.length,
          predictionsVerified: predictionSnapshot.size,
          cardChanges,
        },
        null,
        2,
      ),
    );
    if (
      process.env.FIGHTLOBBY_PRODUCTION_REFRESH_CONFIRM !== requiredConfirmation
    ) {
      console.log("Dry run only. No production data changed.");
      console.log(
        `To execute, set FIGHTLOBBY_PRODUCTION_REFRESH_CONFIRM=${requiredConfirmation}`,
      );
      return;
    }

    const refreshedAt = Timestamp.now();
    const batch = firestore.batch();
    cardChanges.forEach(({ fightId, after }) => {
      batch.set(
        firestore.collection("fights").doc(fightId),
        {
          ...after,
          updatedAt: refreshedAt,
        },
        { merge: true },
      );
    });

    const importReference = firestore.collection("manualImports").doc();
    const auditReference = firestore.collection("auditLogs").doc();
    batch.create(importReference, {
      id: importReference.id,
      actorUid: "production-refresh-script",
      reason:
        "Apply the reviewed official card order without changing fight or fighter identities",
      eventId: card.event.id,
      fixture: rawFixture,
      status: "complete",
      createdAt: refreshedAt,
    });
    batch.create(auditReference, {
      id: auditReference.id,
      actorUid: "production-refresh-script",
      action: "refresh_event_card_order",
      targetType: "event",
      targetId: card.event.id,
      reason:
        "Use the reviewed official UFC card order while preserving prediction-linked identities",
      before: {
        card: cardChanges.map(({ fightId, before }) => ({
          fightId,
          ...before,
        })),
      },
      after: {
        card: cardChanges.map(({ fightId, after }) => ({
          fightId,
          ...after,
        })),
      },
      createdAt: refreshedAt,
    });
    await batch.commit();
    console.log(
      `Refreshed ${card.event.name}: ${cardChanges.length} fight-order documents updated and ${predictionSnapshot.size} predictions preserved.`,
    );
  } finally {
    await deleteApp(app);
  }
}

void main();
