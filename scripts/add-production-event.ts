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
  type Firestore,
} from "firebase-admin/firestore";

const expectedProjectId = "mma-cortex";
const protectedLaunchEventId = "evt_ufc_fn_2026_08_22";
const chatRetentionMs = 30 * 24 * 60 * 60 * 1_000;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function roomDocument(input: {
  roomId: string;
  eventId: string;
  startsAt: string;
  fightId?: string;
}) {
  const startsAt = new Date(input.startsAt).getTime();
  const opensAt = Timestamp.fromMillis(startsAt - 7 * 24 * 60 * 60 * 1_000);
  const writableUntil = Timestamp.fromMillis(startsAt + 24 * 60 * 60 * 1_000);
  const now = Timestamp.now();

  return {
    id: input.roomId,
    type: input.fightId ? "fight_lobby" : "event_lobby",
    eventId: input.eventId,
    ...(input.fightId ? { fightId: input.fightId } : {}),
    status:
      now.toMillis() >= opensAt.toMillis() &&
      now.toMillis() < writableUntil.toMillis()
        ? "open"
        : "scheduled",
    opensAt,
    writableUntil,
    retentionExpiresAt: Timestamp.fromMillis(
      writableUntil.toMillis() + chatRetentionMs,
    ),
    slowModeSeconds: 7,
    messageCount: 0,
    moderationHealth: "normal",
    monetizationEligible: false,
    createdAt: now,
    updatedAt: now,
  };
}

async function countCollection(firestore: Firestore, collection: string) {
  const snapshot = await firestore.collection(collection).count().get();
  return snapshot.data().count;
}

async function countEventPredictions(firestore: Firestore, eventId: string) {
  const snapshot = await firestore
    .collection("predictions")
    .where("eventId", "==", eventId)
    .count()
    .get();
  return snapshot.data().count;
}

function assertFighterIdentity(
  existing: DocumentSnapshot,
  incoming: { id: string; slug: string; name: { normalized: string } },
) {
  if (!existing.exists) return;

  const data = record(existing.data());
  const name = record(data.name);
  if (
    text(data.slug) !== incoming.slug ||
    text(name.normalized) !== incoming.name.normalized
  )
    throw new Error(
      `Fighter identity conflict for ${incoming.id}; refusing to merge unrelated records.`,
    );
}

async function main() {
  const fixtureFilename = process.argv[2];
  if (!fixtureFilename)
    throw new Error("Usage: pnpm add:production:event -- <fixture.json>");

  const fixtureValue = await readFile(path.resolve(fixtureFilename), "utf8");
  const rawFixture: unknown = JSON.parse(fixtureValue);
  const card = parseFixture(rawFixture);
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
    const fightReferences = card.fights.map((fight) =>
      firestore.collection("fights").doc(fight.id),
    );
    const roomIds = [
      card.event.chatRoomId,
      ...card.fights.map((fight) => fight.chatRoomId),
    ];
    const roomReferences = roomIds.map((roomId) =>
      firestore.collection("chatRooms").doc(roomId),
    );
    const fighterReferences = card.fighters.map((fighter) =>
      firestore.collection("fighters").doc(fighter.id),
    );

    const [
      eventSnapshot,
      eventSlugSnapshot,
      fightSnapshots,
      fightSlugSnapshots,
      roomSnapshots,
      fighterSnapshots,
      fighterSlugSnapshots,
      eventCountBefore,
      predictionCountBefore,
      protectedEventSnapshot,
      protectedPredictionCountBefore,
    ] = await Promise.all([
      eventReference.get(),
      firestore
        .collection("events")
        .where("slug", "==", card.event.slug)
        .limit(1)
        .get(),
      Promise.all(fightReferences.map((reference) => reference.get())),
      Promise.all(
        card.fights.map((fight) =>
          firestore
            .collection("fights")
            .where("slug", "==", fight.slug)
            .limit(1)
            .get(),
        ),
      ),
      Promise.all(roomReferences.map((reference) => reference.get())),
      Promise.all(fighterReferences.map((reference) => reference.get())),
      Promise.all(
        card.fighters.map((fighter) =>
          firestore
            .collection("fighters")
            .where("slug", "==", fighter.slug)
            .limit(1)
            .get(),
        ),
      ),
      countCollection(firestore, "events"),
      countCollection(firestore, "predictions"),
      firestore.collection("events").doc(protectedLaunchEventId).get(),
      countEventPredictions(firestore, protectedLaunchEventId),
    ]);

    if (eventSnapshot.exists || !eventSlugSnapshot.empty)
      throw new Error(
        `Event ${card.event.id} or slug ${card.event.slug} already exists; refusing to overwrite it.`,
      );
    const existingFight = fightSnapshots.find((snapshot) => snapshot.exists);
    const existingFightSlug = fightSlugSnapshots.find(
      (snapshot) => !snapshot.empty,
    );
    if (existingFight || existingFightSlug)
      throw new Error(
        `A reviewed fight ID or slug already exists; refusing to overwrite it.`,
      );
    const existingRoom = roomSnapshots.find((snapshot) => snapshot.exists);
    if (existingRoom)
      throw new Error(
        `Chat room ${existingRoom.id} already exists; refusing to overwrite it.`,
      );
    if (!protectedEventSnapshot.exists)
      throw new Error(
        `Protected launch event ${protectedLaunchEventId} is missing; no production data changed.`,
      );
    fighterSnapshots.forEach((snapshot, index) =>
      assertFighterIdentity(snapshot, card.fighters[index]!),
    );
    fighterSlugSnapshots.forEach((snapshot, index) => {
      if (!snapshot.empty && snapshot.docs[0]?.id !== card.fighters[index]?.id)
        throw new Error(
          `Fighter slug ${card.fighters[index]?.slug} belongs to another ID; refusing to merge it.`,
        );
    });

    const confirmation = `ADD ${card.event.id}`;
    console.log(
      JSON.stringify(
        {
          projectId: expectedProjectId,
          operation: "create_only",
          add: {
            eventId: card.event.id,
            event: card.event.name,
            startsAt: card.event.startsAt,
            fights: card.fights.length,
            fighters: card.fighters.length,
            existingFightersToMerge: fighterSnapshots.filter(
              (snapshot) => snapshot.exists,
            ).length,
            chatRooms: roomIds.length,
          },
          preservedBeforeWrite: {
            events: eventCountBefore,
            predictions: predictionCountBefore,
            protectedEventId: protectedLaunchEventId,
            protectedEventPredictions: protectedPredictionCountBefore,
          },
        },
        null,
        2,
      ),
    );

    if (process.env.FIGHTLOBBY_PRODUCTION_IMPORT_CONFIRM !== confirmation) {
      console.log("Dry run only. No production data changed.");
      console.log(
        `To execute, set FIGHTLOBBY_PRODUCTION_IMPORT_CONFIRM=${JSON.stringify(confirmation)}`,
      );
      return;
    }

    const importedAt = Timestamp.now();
    const batch = firestore.batch();
    batch.create(eventReference, card.event);
    card.fighters.forEach((fighter, index) => {
      const fighterReference = fighterReferences[index]!;
      batch.set(
        fighterReference,
        {
          ...fighter,
          upcomingEventIds: FieldValue.arrayUnion(card.event.id),
        },
        { merge: true },
      );
    });
    card.fights.forEach((fight, index) => {
      batch.create(fightReferences[index]!, fight);
      batch.create(
        firestore.collection("chatRooms").doc(fight.chatRoomId),
        roomDocument({
          roomId: fight.chatRoomId,
          eventId: card.event.id,
          startsAt: card.event.startsAt,
          fightId: fight.id,
        }),
      );
    });
    batch.create(
      firestore.collection("chatRooms").doc(card.event.chatRoomId),
      roomDocument({
        roomId: card.event.chatRoomId,
        eventId: card.event.id,
        startsAt: card.event.startsAt,
      }),
    );

    const importReference = firestore.collection("manualImports").doc();
    const auditReference = firestore.collection("auditLogs").doc();
    batch.create(importReference, {
      id: importReference.id,
      actorUid: "production-add-event-script",
      reason: `Add reviewed UFC event ${card.event.id} without replacing existing data`,
      eventId: card.event.id,
      fixture: rawFixture,
      status: "complete",
      createdAt: importedAt,
    });
    batch.create(auditReference, {
      id: auditReference.id,
      actorUid: "production-add-event-script",
      action: "add_event",
      targetType: "event",
      targetId: card.event.id,
      reason:
        "Add a reviewed upcoming UFC card through the create-only importer",
      before: null,
      after: {
        eventId: card.event.id,
        fightIds: card.fights.map((fight) => fight.id),
        fighterIds: card.fighters.map((fighter) => fighter.id),
        chatRoomIds: roomIds,
      },
      metadata: { importId: importReference.id },
      createdAt: importedAt,
    });
    await batch.commit();

    const [
      importedEvent,
      importedFights,
      eventCountAfter,
      predictionCountAfter,
      protectedEventAfter,
      protectedPredictionCountAfter,
    ] = await Promise.all([
      eventReference.get(),
      firestore
        .collection("fights")
        .where("eventId", "==", card.event.id)
        .get(),
      countCollection(firestore, "events"),
      countCollection(firestore, "predictions"),
      firestore.collection("events").doc(protectedLaunchEventId).get(),
      countEventPredictions(firestore, protectedLaunchEventId),
    ]);

    const verified =
      importedEvent.exists &&
      importedFights.size === card.fights.length &&
      eventCountAfter === eventCountBefore + 1 &&
      predictionCountAfter === predictionCountBefore &&
      protectedEventAfter.exists &&
      protectedPredictionCountAfter === protectedPredictionCountBefore;
    if (!verified)
      throw new Error(
        "The create-only write committed, but post-import preservation checks did not match. Inspect production before any further action.",
      );

    console.log(
      JSON.stringify(
        {
          status: "complete",
          importedEventId: card.event.id,
          importedFights: importedFights.size,
          eventsBefore: eventCountBefore,
          eventsAfter: eventCountAfter,
          predictionsBefore: predictionCountBefore,
          predictionsAfter: predictionCountAfter,
          protectedEventPreserved: protectedEventAfter.exists,
          protectedEventPredictionsBefore: protectedPredictionCountBefore,
          protectedEventPredictionsAfter: protectedPredictionCountAfter,
        },
        null,
        2,
      ),
    );
  } finally {
    await deleteApp(app);
  }
}

void main();
