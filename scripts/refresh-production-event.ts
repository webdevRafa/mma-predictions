import { readFile } from "node:fs/promises";
import path from "node:path";

import { parseFixture } from "@fightlobby/domain";
import {
  applicationDefault,
  deleteApp,
  initializeApp,
} from "firebase-admin/app";
import {
  FieldValue,
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
    const [eventSnapshot, fightSnapshot] = await Promise.all([
      eventReference.get(),
      firestore
        .collection("fights")
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

    console.log(
      JSON.stringify(
        {
          projectId: expectedProjectId,
          eventId: card.event.id,
          currentMainCardStartsAt: snapshotField(eventSnapshot, "startsAt"),
          nextPrelimsStartsAt: card.event.prelimsStartsAt,
          nextMainCardStartsAt: card.event.mainCardStartsAt,
          fightersToMerge: card.fighters.length,
          fightSnapshotsToRefresh: card.fights.length,
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
    batch.set(
      eventReference,
      {
        ...card.event,
        status: snapshotField(eventSnapshot, "status") ?? card.event.status,
        predictionSummary:
          snapshotField(eventSnapshot, "predictionSummary") ??
          card.event.predictionSummary,
        chatRoomId:
          snapshotField(eventSnapshot, "chatRoomId") ?? card.event.chatRoomId,
      },
      { merge: true },
    );
    card.fighters.forEach((fighter) => {
      batch.set(
        firestore.collection("fighters").doc(fighter.id),
        {
          ...fighter,
          upcomingEventIds: FieldValue.arrayUnion(card.event.id),
        },
        { merge: true },
      );
    });
    card.fights.forEach((fight) => {
      batch.set(
        firestore.collection("fights").doc(fight.id),
        {
          cardSegment: fight.cardSegment,
          boutOrder: fight.boutOrder,
          fighterA: fight.fighterA,
          fighterB: fight.fighterB,
          weightClass: fight.weightClass,
          dataQuality: fight.dataQuality,
          updatedAt: fight.updatedAt,
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
        "Add explicit broadcast times, official bout order, and verified UFC fighter statistics",
      eventId: card.event.id,
      fixture: rawFixture,
      status: "complete",
      createdAt: refreshedAt,
    });
    batch.create(auditReference, {
      id: auditReference.id,
      actorUid: "production-refresh-script",
      action: "refresh_event_schedule_and_fighters",
      targetType: "event",
      targetId: card.event.id,
      reason:
        "Use the official UFC schedule, bout order, and athlete profile statistics",
      before: {
        startsAt: snapshotField(eventSnapshot, "startsAt") ?? null,
        prelimsStartsAt:
          snapshotField(eventSnapshot, "prelimsStartsAt") ?? null,
        mainCardStartsAt:
          snapshotField(eventSnapshot, "mainCardStartsAt") ?? null,
      },
      after: {
        startsAt: card.event.startsAt,
        prelimsStartsAt: card.event.prelimsStartsAt,
        mainCardStartsAt: card.event.mainCardStartsAt,
        fighterIds: card.fighters.map(({ id }) => id),
      },
      createdAt: refreshedAt,
    });
    await batch.commit();
    console.log(
      `Refreshed ${card.event.name}: ${card.fighters.length} fighters and ${card.fights.length} fight snapshots.`,
    );
  } finally {
    await deleteApp(app);
  }
}

void main();
