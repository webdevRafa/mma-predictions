import { readFile } from "node:fs/promises";
import path from "node:path";

import { parseFixture } from "@fightlobby/domain";
import { initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { getFirestore } from "firebase-admin/firestore";

async function main(): Promise<void> {
  const projectId = process.env.GCLOUD_PROJECT ?? "fightlobby-local";
  if (
    !projectId.startsWith("fightlobby-local") ||
    !process.env.FIRESTORE_EMULATOR_HOST
  ) {
    throw new Error(
      "Refusing to seed without the FightLobby local Firestore emulator",
    );
  }
  const fixturePath = path.resolve("fixtures/events/ufc-fightlobby-demo.json");
  const fixture: unknown = JSON.parse(await readFile(fixturePath, "utf8"));
  const card = parseFixture(fixture);
  const app = initializeApp({
    projectId,
    databaseURL: `http://127.0.0.1:9000?ns=${projectId}`,
  });
  const firestore = getFirestore(app);
  const batch = firestore.batch();
  batch.set(firestore.collection("events").doc(card.event.id), card.event);
  card.fighters.forEach((fighter) =>
    batch.set(firestore.collection("fighters").doc(fighter.id), {
      ...fighter,
      upcomingEventIds: [card.event.id],
    }),
  );
  card.fights.forEach((fight) => {
    const fightRef = firestore.collection("fights").doc(fight.id);
    batch.set(fightRef, fight);
    batch.set(fightRef.collection("predictionShards").doc("baseline"), {
      shardId: "baseline",
      ...fight.predictionSummary,
      updatedAt: fight.updatedAt,
    });
    batch.set(firestore.collection("chatRooms").doc(fight.chatRoomId), {
      id: fight.chatRoomId,
      type: "fight_lobby",
      eventId: fight.eventId,
      fightId: fight.id,
      status: "scheduled",
      slowModeSeconds: 7,
      messageCount: 0,
      moderationHealth: "normal",
      monetizationEligible: false,
      createdAt: card.event.updatedAt,
      updatedAt: card.event.updatedAt,
    });
  });
  batch.set(firestore.collection("chatRooms").doc(card.event.chatRoomId), {
    id: card.event.chatRoomId,
    type: "event_lobby",
    eventId: card.event.id,
    status: "scheduled",
    slowModeSeconds: 7,
    messageCount: 0,
    moderationHealth: "normal",
    monetizationEligible: false,
    createdAt: card.event.updatedAt,
    updatedAt: card.event.updatedAt,
  });
  batch.set(firestore.collection("featureFlags").doc("current"), {
    siteReadOnly: false,
    authEnabled: true,
    predictionsEnabled: true,
    chatEnabled: true,
    chatPostingEnabled: true,
    providerSyncEnabled: false,
    liveSyncEnabled: false,
    adsEnabled: false,
    emailEnabled: false,
    socialCardsEnabled: true,
    updatedAt: card.event.updatedAt,
  });
  await batch.commit();
  await getDatabase(app).ref("chat/v1/rooms").set({});
  console.log(
    `Seeded ${card.event.name}: ${card.fighters.length} fighters, ${card.fights.length} fights`,
  );
}

void main();
