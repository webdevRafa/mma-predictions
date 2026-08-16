import { deleteApp, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { lockFightPredictionsCore } from "../../apps/functions/src/predictions/lock-fight-predictions.ts";
import { submitPredictionTransaction } from "../../apps/web/lib/predictions/firestore.ts";

const emulatorDescribe =
  process.env.RULES_TEST === "1" ? describe : describe.skip;

emulatorDescribe("prediction submit, update, counters, and lock", () => {
  let app: App;
  let firestore: Firestore;

  beforeAll(() => {
    app = initializeApp(
      { projectId: "fightlobby-local" },
      `prediction-flow-${Date.now()}`,
    );
    firestore = getFirestore(app);
  });

  afterAll(async () => deleteApp(app));

  it("keeps one editable prediction accurate and rejects edits after lock", async () => {
    const suffix = Date.now().toString(36);
    const fightId = `fgt_prediction_${suffix}`;
    const uid = `member_prediction_${suffix}`;
    const fighterAId = `ftr_alpha_${suffix}`;
    const fighterBId = `ftr_bravo_${suffix}`;
    await firestore
      .collection("fights")
      .doc(fightId)
      .set({
        id: fightId,
        eventId: `evt_prediction_${suffix}`,
        slug: `alpha-vs-bravo-${suffix}`,
        status: "scheduled",
        predictionStatus: "open",
        fighterAId,
        fighterBId,
        fighterA: { id: fighterAId, name: { full: "Alpha Test" } },
        fighterB: { id: fighterBId, name: { full: "Bravo Test" } },
        scheduledRounds: 3,
        dataQuality: "complete",
        predictionSummary: {
          total: 0,
          fighterA: 0,
          fighterB: 0,
          methods: {},
          rounds: {},
        },
      });

    const created = await submitPredictionTransaction(firestore, {
      fightId,
      uid,
      requestId: "10000000-0000-4000-8000-000000000001",
      pick: {
        winnerFighterId: fighterAId,
        method: "ko_tko",
        detail: 1,
        confidence: 70,
      },
    });
    expect(created).toMatchObject({
      created: true,
      summary: { total: 1, fighterA: 1, fighterB: 0 },
      prediction: { predictionVersion: 1 },
    });

    const updated = await submitPredictionTransaction(firestore, {
      fightId,
      uid,
      requestId: "20000000-0000-4000-8000-000000000002",
      pick: {
        winnerFighterId: fighterBId,
        method: "decision",
        detail: "split",
        confidence: 82,
      },
    });
    expect(updated).toMatchObject({
      created: false,
      summary: { total: 1, fighterA: 0, fighterB: 1 },
      prediction: { predictionVersion: 2 },
    });
    expect(updated.summary.methods).toMatchObject({ decision: 1 });

    const idempotent = await submitPredictionTransaction(firestore, {
      fightId,
      uid,
      requestId: "20000000-0000-4000-8000-000000000002",
      pick: {
        winnerFighterId: fighterBId,
        method: "decision",
        detail: "split",
        confidence: 82,
      },
    });
    expect(idempotent).toMatchObject({
      idempotent: true,
      summary: { total: 1, fighterB: 1 },
    });

    const lock = await lockFightPredictionsCore(firestore, fightId);
    expect(lock).toMatchObject({ locked: 1, materialized: 1 });
    const predictionId = `${fightId}_${uid}`;
    expect(
      (await firestore.collection("predictions").doc(predictionId).get()).get(
        "status",
      ),
    ).toBe("locked");
    const publicPick = await firestore
      .collection("profiles")
      .doc(uid)
      .collection("publicPicks")
      .doc(fightId)
      .get();
    expect(publicPick.exists).toBe(true);
    expect(JSON.stringify(publicPick.data())).not.toContain("uid");
    expect(JSON.stringify(publicPick.data())).not.toContain("email");

    await expect(
      submitPredictionTransaction(firestore, {
        fightId,
        uid,
        requestId: "30000000-0000-4000-8000-000000000003",
        pick: {
          winnerFighterId: fighterAId,
          method: "submission",
          detail: 2,
          confidence: 60,
        },
      }),
    ).rejects.toMatchObject({ code: "predictions_locked", status: 409 });
  });
});
