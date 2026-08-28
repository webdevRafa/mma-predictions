import { deleteApp, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { syncEventCardCore } from "../../apps/functions/src/ingestion/sync-event-card.ts";
import { MockMmaProvider } from "../../packages/providers/src/mock/mock-provider.ts";

const emulatorDescribe =
  process.env.RULES_TEST === "1" ? describe : describe.skip;

function fixture(
  suffix: string,
  options: { name: string; fightId: string; fightSlug: string },
) {
  const eventId = `evt_ingest_${suffix}`;
  const fighterAId = `ftr_ingest_a_${suffix}`;
  const fighterBId = `ftr_ingest_b_${suffix}`;
  return {
    schemaVersion: 1,
    generatedAt: "2026-08-16T12:00:00.000Z",
    source: { provider: "mock", externalEventId: eventId },
    event: {
      id: eventId,
      promotion: "ufc",
      name: options.name,
      shortName: "UFC Ingestion",
      slug: `ufc-ingestion-${suffix}`,
      slugHistory: [],
      status: "scheduled",
      startsAt: "2026-09-01T23:00:00.000Z",
      venueTimezone: "America/New_York",
    },
    fighters: [
      {
        id: fighterAId,
        slug: `ingest-alpha-${suffix}`,
        slugHistory: [],
        name: { full: "Ingest Alpha", normalized: "ingest alpha" },
        record: { wins: 10, losses: 1, draws: 0, noContests: 0 },
      },
      {
        id: fighterBId,
        slug: `ingest-beta-${suffix}`,
        slugHistory: [],
        name: { full: "Ingest Beta", normalized: "ingest beta" },
        record: { wins: 9, losses: 2, draws: 0, noContests: 0 },
      },
    ],
    fights: [
      {
        id: options.fightId,
        slug: options.fightSlug,
        slugHistory: [],
        eventId,
        fighterAId,
        fighterBId,
        cardSegment: "main_card",
        boutOrder: 1,
        status: "scheduled",
        predictionStatus: "open",
        weightClass: "Lightweight",
        isTitleFight: false,
        scheduledRounds: 3,
        predictionSummary: {
          total: 0,
          fighterA: 0,
          fighterB: 0,
          methods: {},
          rounds: {},
        },
        editorial: { status: "missing" },
      },
    ],
  };
}

emulatorDescribe("provider ingestion", () => {
  let app: App;
  let firestore: Firestore;
  let storage: Storage;

  beforeAll(() => {
    app = initializeApp(
      {
        projectId: "fightlobby-local",
        storageBucket: "fightlobby-local.appspot.com",
      },
      `ingestion-flow-${Date.now()}`,
    );
    firestore = getFirestore(app);
    storage = getStorage(app);
  });

  afterAll(async () => deleteApp(app));

  it("dry-runs, reapplies private overrides, detects replacements, and retries safely", async () => {
    const suffix = Date.now().toString(36);
    const externalEventId = `evt_ingest_${suffix}`;
    const originalFightId = `fgt_ingest_${suffix}`;
    const replacementFightId = `fgt_replace_${suffix}`;
    const original = fixture(suffix, {
      name: "UFC Provider Original",
      fightId: originalFightId,
      fightSlug: `ingest-alpha-vs-beta-${suffix}`,
    });
    const dryRun = await syncEventCardCore({
      provider: new MockMmaProvider([original]),
      firestore,
      storage,
      externalEventId,
      dryRun: true,
      archiveEnabled: false,
      revalidate: false,
    });
    expect(dryRun.status).toBe("dry_run");
    expect(dryRun.changes.some((change) => change.operation === "create")).toBe(
      true,
    );

    const first = await syncEventCardCore({
      provider: new MockMmaProvider([original]),
      firestore,
      storage,
      externalEventId,
      archiveEnabled: false,
      revalidate: false,
    });
    expect(first.status).toBe("complete");
    if (first.status !== "complete") throw new Error("Expected initial sync");
    const eventStateRef = firestore
      .collection("providerEntityState")
      .doc(`event_${first.eventId}`);
    await eventStateRef.set(
      { manualOverrides: { name: "FightLobby Editor Name" } },
      { merge: true },
    );

    const replacement = fixture(suffix, {
      name: "UFC Provider Renamed",
      fightId: replacementFightId,
      fightSlug: `ingest-alpha-vs-replacement-${suffix}`,
    });
    const second = await syncEventCardCore({
      provider: new MockMmaProvider([replacement]),
      firestore,
      storage,
      externalEventId,
      archiveEnabled: false,
      revalidate: false,
    });
    expect(second.status).toBe("complete");

    const eventDocument = await firestore
      .collection("events")
      .doc(first.eventId)
      .get();
    expect(eventDocument.get("name")).toBe("FightLobby Editor Name");
    expect(eventDocument.get("providerData")).toBeUndefined();
    expect(eventDocument.get("provider")).toBeUndefined();
    expect(eventDocument.get("manualOverrides")).toBeUndefined();

    const oldFightMapping = await firestore
      .collection("providerMappings")
      .where("providerKey", "==", "mock")
      .where("entityType", "==", "fight")
      .where("externalId", "==", originalFightId)
      .limit(1)
      .get();
    const newFightMapping = await firestore
      .collection("providerMappings")
      .where("providerKey", "==", "mock")
      .where("entityType", "==", "fight")
      .where("externalId", "==", replacementFightId)
      .limit(1)
      .get();
    const oldCanonicalId = oldFightMapping.docs[0]?.get("internalId") as string;
    const newCanonicalId = newFightMapping.docs[0]?.get("internalId") as string;
    const oldFight = await firestore
      .collection("fights")
      .doc(oldCanonicalId)
      .get();
    expect(oldFight.get("status")).toBe("canceled");
    expect(oldFight.get("replacedByFightId")).toBe(newCanonicalId);

    const retry = await syncEventCardCore({
      provider: new MockMmaProvider([replacement]),
      firestore,
      storage,
      externalEventId,
      archiveEnabled: false,
      revalidate: false,
    });
    expect(retry.status).toBe("unchanged");
  });
});
