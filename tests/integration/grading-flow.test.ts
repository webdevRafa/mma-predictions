import { deleteApp, initializeApp, type App } from "firebase-admin/app";
import {
  getFirestore,
  Timestamp,
  type Firestore,
} from "firebase-admin/firestore";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { gradeFightPredictionsCore } from "../../apps/functions/src/grading/grade-fight-predictions.ts";

const emulatorDescribe =
  process.env.RULES_TEST === "1" ? describe : describe.skip;

emulatorDescribe("grading, corrections, and reconciled leaderboards", () => {
  let app: App;
  let firestore: Firestore;

  beforeAll(() => {
    app = initializeApp(
      { projectId: "fightlobby-local" },
      `grading-flow-${Date.now()}`,
    );
    firestore = getFirestore(app);
  });

  afterAll(async () => deleteApp(app));

  it("grades once, reverses a correction, and removes voided totals", async () => {
    const suffix = Date.now().toString(36);
    const eventId = `evt_grading_${suffix}`;
    const fightId = `fgt_grading_${suffix}`;
    const fighterAId = `ftr_alpha_${suffix}`;
    const fighterBId = `ftr_bravo_${suffix}`;
    const alphaUid = `member_alpha_${suffix}`;
    const bravoUid = `member_bravo_${suffix}`;
    const startsAt = Timestamp.fromDate(new Date("2026-08-15T23:00:00.000Z"));

    await Promise.all([
      firestore.collection("events").doc(eventId).set({
        id: eventId,
        shortName: "UFC Test Card",
        status: "completed",
        startsAt,
      }),
      firestore
        .collection("profiles")
        .doc(alphaUid)
        .set({
          uid: alphaUid,
          handle: `alpha_${suffix}`.slice(0, 20),
          avatar: { version: 0 },
          stats: {},
          badges: [],
        }),
      firestore
        .collection("profiles")
        .doc(bravoUid)
        .set({
          uid: bravoUid,
          handle: `bravo_${suffix}`.slice(0, 20),
          avatar: { version: 0 },
          stats: {},
          badges: [],
        }),
    ]);
    await firestore
      .collection("fights")
      .doc(fightId)
      .set({
        id: fightId,
        eventId,
        slug: `alpha-vs-bravo-${suffix}`,
        status: "completed",
        predictionStatus: "grading",
        boutOrder: 1,
        fighterAId,
        fighterBId,
        fighterA: { id: fighterAId, name: { full: "Alpha Test" } },
        fighterB: { id: fighterBId, name: { full: "Bravo Test" } },
        result: {
          winnerFighterId: fighterAId,
          method: "decision_unanimous",
          resultVersion: 1,
          official: true,
          updatedAt: Timestamp.now(),
        },
      });
    await Promise.all([
      firestore
        .collection("predictions")
        .doc(`${fightId}_${alphaUid}`)
        .set({
          fightId,
          eventId,
          uid: alphaUid,
          status: "locked",
          pick: {
            winnerFighterId: fighterAId,
            method: "decision",
            detail: "unanimous",
            confidence: 80,
          },
        }),
      firestore
        .collection("predictions")
        .doc(`${fightId}_${bravoUid}`)
        .set({
          fightId,
          eventId,
          uid: bravoUid,
          status: "locked",
          pick: {
            winnerFighterId: fighterBId,
            method: "ko_tko",
            detail: 2,
            confidence: 75,
          },
        }),
    ]);

    const first = await gradeFightPredictionsCore(firestore, fightId);
    expect(first).toMatchObject({
      status: "complete",
      gradedPredictions: 2,
      correctWinners: 1,
      exactPicks: 1,
      awardedPoints: 10,
    });
    expect(
      (await firestore.collection("profiles").doc(alphaUid).get()).get(
        "stats.totalPoints",
      ),
    ).toBe(10);
    expect(
      (
        await firestore.collection("leaderboards").doc(`event_${eventId}`).get()
      ).get("championUid"),
    ).toBe(alphaUid);

    const repeated = await gradeFightPredictionsCore(firestore, fightId);
    expect(repeated).toMatchObject({ awardedPoints: 10, status: "complete" });
    expect(
      (await firestore.collection("profiles").doc(alphaUid).get()).get(
        "stats.totalPoints",
      ),
    ).toBe(10);

    await firestore
      .collection("fights")
      .doc(fightId)
      .set(
        {
          predictionStatus: "grading",
          result: {
            winnerFighterId: fighterBId,
            method: "ko_tko",
            round: 2,
            resultVersion: 2,
            official: true,
            updatedAt: Timestamp.now(),
          },
        },
        { merge: true },
      );
    const corrected = await gradeFightPredictionsCore(
      firestore,
      fightId,
      "result_correction",
    );
    expect(corrected).toMatchObject({
      gradedPredictions: 2,
      correctWinners: 1,
      exactPicks: 1,
      awardedPoints: 10,
    });
    expect(
      (await firestore.collection("profiles").doc(alphaUid).get()).get(
        "stats.totalPoints",
      ),
    ).toBe(0);
    expect(
      (await firestore.collection("profiles").doc(bravoUid).get()).get(
        "stats.totalPoints",
      ),
    ).toBe(10);
    expect(
      (
        await firestore.collection("leaderboards").doc(`event_${eventId}`).get()
      ).get("championUid"),
    ).toBe(bravoUid);
    expect(
      (
        await firestore
          .collection("predictions")
          .doc(`${fightId}_${alphaUid}`)
          .collection("gradeHistory")
          .doc(`${fightId}_r1_s1`)
          .get()
      ).exists,
    ).toBe(true);

    await firestore
      .collection("fights")
      .doc(fightId)
      .set(
        {
          predictionStatus: "grading",
          result: {
            method: "no_contest",
            resultVersion: 3,
            official: true,
            updatedAt: Timestamp.now(),
          },
        },
        { merge: true },
      );
    const voided = await gradeFightPredictionsCore(
      firestore,
      fightId,
      "result_correction",
    );
    expect(voided).toMatchObject({
      gradedPredictions: 0,
      voidPredictions: 2,
      awardedPoints: 0,
    });
    expect(
      (await firestore.collection("profiles").doc(bravoUid).get()).get(
        "stats.gradedPicks",
      ),
    ).toBe(0);
    expect(
      (
        await firestore.collection("leaderboards").doc(`event_${eventId}`).get()
      ).get("championUid"),
    ).toBeNull();
    expect(
      (await firestore.collection("fights").doc(fightId).get()).get(
        "predictionStatus",
      ),
    ).toBe("void");
  });
});
