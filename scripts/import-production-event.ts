import { readFile } from "node:fs/promises";
import path from "node:path";

import { parseFixture } from "@fightlobby/domain";
import {
  applicationDefault,
  deleteApp,
  initializeApp,
} from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import {
  FieldValue,
  Timestamp,
  getFirestore,
  type DocumentReference,
} from "firebase-admin/firestore";

const expectedProjectId = "mma-cortex";
const expectedDatabaseUrl = "https://mma-cortex-default-rtdb.firebaseio.com/";
const demoFixturePath = path.resolve(
  "fixtures/events/ufc-fightlobby-demo.json",
);
const legacySeedEventId = "2026-06-27-ufc-fight-night-fiziev-vs-torres";
const legacySeedEventName = "UFC Fight Night: Fiziev vs. Torres";
const legacySeedFighterIds = [
  "abdul-rakhman-yakhyaev",
  "abus-magomedov",
  "andreas-gustafsson",
  "andrey-pulyaev",
  "asu-almabayev",
  "bekzat-almakhan",
  "brunno-ferreira",
  "charles-johnson",
  "daniil-donchenko",
  "eric-nolan",
  "farman-hasanov",
  "ikram-aliskerov",
  "ismail-naurdiev",
  "jean-matsumoto",
  "julius-walker",
  "manuel-torres",
  "marvin-vettori",
  "matheus-camilo",
  "michal-oleksiejczuk",
  "michel-pereira",
  "nazim-sadykhov",
  "nursulton-ruziboev",
  "rafael-fiziev",
  "rizvan-kuniev",
  "shara-magomedov",
  "tyrell-fortune",
].sort();

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
    slowModeSeconds: 7,
    messageCount: 0,
    moderationHealth: "normal",
    monetizationEligible: false,
    createdAt: now,
    updatedAt: now,
  };
}

function sortedIds(documents: ReadonlyArray<{ id: string }>) {
  return documents.map((document) => document.id).sort();
}

function assertSameIds(label: string, actual: string[], expected: string[]) {
  if (JSON.stringify(actual.sort()) !== JSON.stringify(expected.sort()))
    throw new Error(
      `${label} no longer matches the reviewed demo fixture. Expected ${expected.join(", ")}; found ${actual.join(", ")}`,
    );
}

async function recursiveDeleteAll(references: DocumentReference[]) {
  for (const reference of references)
    await reference.firestore.recursiveDelete(reference);
}

async function main(): Promise<void> {
  const fixtureFilename = process.argv[2];
  const replacedEventId = process.argv[3];
  if (!fixtureFilename || !replacedEventId)
    throw new Error(
      "Usage: pnpm import:production:event -- <fixture.json> <event-id-to-replace>",
    );

  const [fixtureValue, demoFixtureValue] = await Promise.all([
    readFile(path.resolve(fixtureFilename), "utf8"),
    readFile(demoFixturePath, "utf8"),
  ]);
  const rawFixture: unknown = JSON.parse(fixtureValue);
  const card = parseFixture(rawFixture);
  const reviewedDemo = parseFixture(JSON.parse(demoFixtureValue) as unknown);
  if (replacedEventId !== legacySeedEventId)
    throw new Error(
      `This migration can only replace the reviewed legacy seed ${legacySeedEventId}`,
    );
  if (card.event.id === replacedEventId)
    throw new Error("The replacement event must use a new stable event ID");

  const configuredProjectId =
    process.env.FIGHTLOBBY_PRODUCTION_PROJECT_ID ?? "";
  if (configuredProjectId !== expectedProjectId)
    throw new Error(
      `Set FIGHTLOBBY_PRODUCTION_PROJECT_ID=${expectedProjectId} before inspecting or changing production`,
    );

  const app = initializeApp({
    credential: applicationDefault(),
    projectId: expectedProjectId,
    databaseURL: expectedDatabaseUrl,
  });
  try {
    const firestore = getFirestore(app);
    const database = getDatabase(app);
    const [
      legacyEvent,
      fixtureEvent,
      newEvent,
      legacyFights,
      fixtureFights,
      legacyRooms,
      fixtureRooms,
      legacyPredictions,
      fixturePredictions,
    ] = await Promise.all([
      firestore.collection("events").doc(replacedEventId).get(),
      firestore.collection("events").doc(reviewedDemo.event.id).get(),
      firestore.collection("events").doc(card.event.id).get(),
      firestore
        .collection("fights")
        .where("eventId", "==", replacedEventId)
        .get(),
      firestore
        .collection("fights")
        .where("eventId", "==", reviewedDemo.event.id)
        .get(),
      firestore
        .collection("chatRooms")
        .where("eventId", "==", replacedEventId)
        .get(),
      firestore
        .collection("chatRooms")
        .where("eventId", "==", reviewedDemo.event.id)
        .get(),
      firestore
        .collection("predictions")
        .where("eventId", "==", replacedEventId)
        .get(),
      firestore
        .collection("predictions")
        .where("eventId", "==", reviewedDemo.event.id)
        .get(),
    ]);
    if (!legacyEvent.exists)
      throw new Error(`Production seed ${replacedEventId} was not found`);
    if (legacyEvent.get("name") !== legacySeedEventName)
      throw new Error(
        `Refusing to replace ${replacedEventId}: expected ${legacySeedEventName}`,
      );
    if (newEvent.exists)
      throw new Error(
        `Replacement event ${card.event.id} already exists; refusing to overwrite it`,
      );
    if (!legacyFights.empty || !legacyRooms.empty)
      throw new Error(
        "The incomplete legacy seed unexpectedly gained fight or chat-room children",
      );

    const reviewedFightIds = reviewedDemo.fights
      .map((fight) => fight.id)
      .sort();
    const reviewedRoomIds = [
      reviewedDemo.event.chatRoomId,
      ...reviewedDemo.fights.map((fight) => fight.chatRoomId),
    ].sort();
    const unexpectedFixtureFights = sortedIds(fixtureFights.docs).filter(
      (fightId) => !reviewedFightIds.includes(fightId),
    );
    if (unexpectedFixtureFights.length > 0)
      throw new Error(
        `Unexpected fixture fights found: ${unexpectedFixtureFights.join(", ")}`,
      );
    assertSameIds(
      "Chat-room targets",
      sortedIds(fixtureRooms.docs),
      reviewedRoomIds,
    );

    const legacyFighterDocuments = await Promise.all(
      legacySeedFighterIds.map((fighterId) =>
        firestore.collection("fighters").doc(fighterId).get(),
      ),
    );
    assertSameIds(
      "Legacy fighter targets",
      legacyFighterDocuments
        .filter((document) => document.exists)
        .map((document) => document.id),
      legacySeedFighterIds,
    );
    const demoFighterDocuments = (
      await Promise.all(
        reviewedDemo.fighters.map((fighter) =>
          firestore.collection("fighters").doc(fighter.id).get(),
        ),
      )
    ).filter((document) => document.exists);
    const targetFights = [...legacyFights.docs, ...fixtureFights.docs];
    const targetRooms = [...legacyRooms.docs, ...fixtureRooms.docs];
    const targetPredictions = [
      ...legacyPredictions.docs,
      ...fixturePredictions.docs,
    ];

    const plan = {
      projectId: expectedProjectId,
      replace: {
        eventIds: [replacedEventId, reviewedDemo.event.id],
        fights: targetFights.length,
        fighters: legacyFighterDocuments.length + demoFighterDocuments.length,
        chatRooms: targetRooms.length,
        userPredictions: targetPredictions.length,
      },
      import: {
        eventId: card.event.id,
        event: card.event.name,
        fights: card.fights.length,
        fighters: card.fighters.length,
        chatRooms: card.fights.length + 1,
      },
    };
    console.log(JSON.stringify(plan, null, 2));

    const requiredConfirmation = `REPLACE ${replacedEventId} WITH ${card.event.id}`;
    if (
      process.env.FIGHTLOBBY_PRODUCTION_IMPORT_CONFIRM !== requiredConfirmation
    ) {
      console.log("Dry run only. No production data changed.");
      console.log(
        `To execute, set FIGHTLOBBY_PRODUCTION_IMPORT_CONFIRM=${JSON.stringify(requiredConfirmation)}`,
      );
      return;
    }

    const importedAt = Timestamp.now();
    const importReference = firestore.collection("manualImports").doc();
    const auditReference = firestore.collection("auditLogs").doc();
    const importBatch = firestore.batch();
    importBatch.set(
      firestore.collection("events").doc(card.event.id),
      card.event,
    );
    card.fighters.forEach((fighter) =>
      importBatch.set(
        firestore.collection("fighters").doc(fighter.id),
        {
          ...fighter,
          upcomingEventIds: FieldValue.arrayUnion(card.event.id),
        },
        { merge: true },
      ),
    );
    card.fights.forEach((fight) => {
      importBatch.set(firestore.collection("fights").doc(fight.id), fight);
      importBatch.set(
        firestore.collection("chatRooms").doc(fight.chatRoomId),
        roomDocument({
          roomId: fight.chatRoomId,
          eventId: card.event.id,
          startsAt: card.event.startsAt,
          fightId: fight.id,
        }),
      );
    });
    importBatch.set(
      firestore.collection("chatRooms").doc(card.event.chatRoomId),
      roomDocument({
        roomId: card.event.chatRoomId,
        eventId: card.event.id,
        startsAt: card.event.startsAt,
      }),
    );
    importBatch.create(importReference, {
      id: importReference.id,
      actorUid: "production-import-script",
      reason: `Replace fictional launch card with reviewed UFC event ${card.event.id}`,
      eventId: card.event.id,
      fixture: rawFixture,
      status: "complete",
      createdAt: importedAt,
    });
    importBatch.create(auditReference, {
      id: auditReference.id,
      actorUid: "production-import-script",
      action: "replace_demo_event",
      targetType: "event",
      targetId: replacedEventId,
      reason: "Replace fictional launch data with the first reviewed UFC card",
      before: {
        eventIds: [replacedEventId, reviewedDemo.event.id],
        fightIds: targetFights.map((document) => document.id),
        fighterIds: [...legacyFighterDocuments, ...demoFighterDocuments].map(
          (document) => document.id,
        ),
        chatRoomIds: targetRooms.map((document) => document.id),
        predictionCount: targetPredictions.length,
      },
      after: {
        eventId: card.event.id,
        fightIds: card.fights.map((fight) => fight.id),
        fighterIds: card.fighters.map((fighter) => fighter.id),
      },
      createdAt: importedAt,
    });
    await importBatch.commit();

    const removableFightIds = [
      ...new Set([
        ...reviewedFightIds,
        ...targetFights.map((document) => document.id),
      ]),
    ];
    const relatedPublicPicks = await Promise.all(
      removableFightIds.map((fightId) =>
        firestore.collection("publicPicks").doc(fightId).get(),
      ),
    );
    await recursiveDeleteAll([
      ...targetPredictions.map((document) => document.ref),
      ...relatedPublicPicks
        .filter((document) => document.exists)
        .map((document) => document.ref),
      ...targetFights.map((document) => document.ref),
      firestore.collection("leaderboards").doc(`event_${replacedEventId}`),
      firestore
        .collection("leaderboards")
        .doc(`event_${reviewedDemo.event.id}`),
      firestore.collection("eventChampionships").doc(replacedEventId),
      firestore.collection("eventChampionships").doc(reviewedDemo.event.id),
      ...(fixtureEvent.exists ? [fixtureEvent.ref] : []),
      legacyEvent.ref,
    ]);

    const cleanupBatch = firestore.batch();
    targetRooms.forEach((document) => cleanupBatch.delete(document.ref));
    [...legacyFighterDocuments, ...demoFighterDocuments].forEach((document) => {
      const upcomingEventIds = Array.isArray(document.get("upcomingEventIds"))
        ? (document.get("upcomingEventIds") as unknown[]).filter(
            (value): value is string => typeof value === "string",
          )
        : [];
      const otherEventIds = upcomingEventIds.filter(
        (eventId) =>
          eventId !== replacedEventId && eventId !== reviewedDemo.event.id,
      );
      if (otherEventIds.length === 0) cleanupBatch.delete(document.ref);
      else
        cleanupBatch.update(document.ref, {
          upcomingEventIds: FieldValue.arrayRemove(
            replacedEventId,
            reviewedDemo.event.id,
          ),
        });
    });
    await cleanupBatch.commit();

    await database
      .ref("chat/v1/rooms")
      .update(
        Object.fromEntries(
          [
            ...new Set([
              ...reviewedRoomIds,
              ...targetRooms.map((document) => document.id),
            ]),
          ].map((roomId) => [roomId, null]),
        ),
      );
    console.log(
      `Imported ${card.event.name} and removed the legacy seed plus ${reviewedDemo.event.name}.`,
    );
  } finally {
    await deleteApp(app);
  }
}

void main();
