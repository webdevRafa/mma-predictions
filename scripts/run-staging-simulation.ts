import { readFile } from "node:fs/promises";
import path from "node:path";

import { deleteApp, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

import { runStagingEventSimulation } from "./staging-simulation.ts";

async function main() {
  const projectId = process.env.GCLOUD_PROJECT ?? "fightlobby-local";
  const databaseHost = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
  if (
    process.env.STAGING_SIMULATION !== "1" ||
    !projectId.startsWith("fightlobby-local") ||
    !process.env.FIRESTORE_EMULATOR_HOST ||
    !databaseHost
  )
    throw new Error(
      "Refusing to run the staging replay outside the isolated FightLobby emulator project",
    );
  const fixturePath = path.resolve("fixtures/events/ufc-fightlobby-demo.json");
  const fixture: unknown = JSON.parse(await readFile(fixturePath, "utf8"));
  const app = initializeApp(
    {
      projectId,
      databaseURL: `http://${databaseHost}?ns=${projectId}`,
      storageBucket: `${projectId}.appspot.com`,
    },
    `staging-simulation-${Date.now()}`,
  );
  try {
    const report = await runStagingEventSimulation({
      fixture,
      firestore: getFirestore(app),
      database: getDatabase(app),
      storage: getStorage(app),
    });
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await deleteApp(app);
  }
}

void main();
