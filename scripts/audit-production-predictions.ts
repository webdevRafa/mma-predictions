import {
  applicationDefault,
  deleteApp,
  initializeApp,
} from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const PRODUCTION_PROJECT_ID = "mma-cortex";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function timestampText(value: unknown) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : null;
}

async function main() {
  const eventSelector = process.argv[2];
  if (!eventSelector) {
    throw new Error("Usage: pnpm audit:production:predictions -- <eventId>");
  }

  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT ??
    process.env.GCLOUD_PROJECT ??
    PRODUCTION_PROJECT_ID;
  if (projectId !== PRODUCTION_PROJECT_ID) {
    throw new Error(
      `Refusing to audit unexpected project ${projectId}; expected ${PRODUCTION_PROJECT_ID}`,
    );
  }

  const app = initializeApp({
    credential: applicationDefault(),
    projectId: PRODUCTION_PROJECT_ID,
  });
  const firestore = getFirestore(app);

  try {
    const directEventSnapshot = await firestore
      .collection("events")
      .doc(eventSelector)
      .get();
    const slugMatches = directEventSnapshot.exists
      ? null
      : await firestore
          .collection("events")
          .where("slug", "==", eventSelector)
          .limit(2)
          .get();
    const eventSnapshot = directEventSnapshot.exists
      ? directEventSnapshot
      : slugMatches?.docs[0];
    if (!eventSnapshot?.exists) {
      throw new Error(
        `Event ${eventSelector} does not exist by ID or slug in ${projectId}`,
      );
    }
    if (slugMatches && slugMatches.size > 1) {
      throw new Error(`Event slug ${eventSelector} is not unique`);
    }
    const eventId = eventSnapshot.id;
    const event = record(eventSnapshot.data());
    const eventBoardRef = firestore
      .collection("leaderboards")
      .doc(`event_${eventId}`);
    const [
      fightsSnapshot,
      predictionsSnapshot,
      jobsSnapshot,
      eventBoardSnapshot,
      eventBoardEntriesSnapshot,
    ] = await Promise.all([
      firestore
        .collection("fights")
        .where("eventId", "==", eventId)
        .orderBy("boutOrder")
        .get(),
      firestore.collection("predictions").where("eventId", "==", eventId).get(),
      firestore.collection("adminJobs").get(),
      eventBoardRef.get(),
      eventBoardRef.collection("entries").get(),
    ]);
    const predictionSeasonIds = [
      ...new Set(
        predictionsSnapshot.docs.flatMap((prediction) => {
          const seasonId = record(prediction.data()).seasonId;
          return typeof seasonId === "string" ? [seasonId] : [];
        }),
      ),
    ];
    const seasonId =
      typeof event.seasonId === "string"
        ? event.seasonId
        : predictionSeasonIds.length === 1
          ? predictionSeasonIds[0]
          : undefined;
    const seasonAccuracyBoardRef = seasonId
      ? firestore.collection("leaderboards").doc(`season_${seasonId}_accuracy`)
      : undefined;
    const [seasonAccuracyBoardSnapshot, seasonAccuracyEntriesSnapshot] =
      await Promise.all([
        seasonAccuracyBoardRef?.get() ?? Promise.resolve(undefined),
        seasonAccuracyBoardRef?.collection("entries").get() ??
          Promise.resolve(undefined),
      ]);

    const fightIds = new Set(fightsSnapshot.docs.map((fight) => fight.id));
    const jobs = jobsSnapshot.docs.filter((job) => {
      const fightId = record(job.data()).fightId;
      return typeof fightId === "string" && fightIds.has(fightId);
    });
    const predictionsByFight = new Map<
      string,
      typeof predictionsSnapshot.docs
    >();
    const affectedUids = new Set<string>();
    for (const prediction of predictionsSnapshot.docs) {
      const predictionData = record(prediction.data());
      const fightId = predictionData.fightId;
      const uid = predictionData.uid;
      if (typeof fightId === "string") {
        const existing = predictionsByFight.get(fightId) ?? [];
        existing.push(prediction);
        predictionsByFight.set(fightId, existing);
      }
      if (typeof uid === "string") affectedUids.add(uid);
    }

    const profiles =
      affectedUids.size > 0
        ? await firestore.getAll(
            ...[...affectedUids].map((uid) =>
              firestore.collection("profiles").doc(uid),
            ),
          )
        : [];
    const [userPredictionSnapshots, publicPickSnapshots, gradingRunsSnapshot] =
      await Promise.all([
        Promise.all(
          [...affectedUids].map((uid) =>
            firestore.collection("predictions").where("uid", "==", uid).get(),
          ),
        ),
        Promise.all(
          [...affectedUids].map((uid) =>
            firestore
              .collection("profiles")
              .doc(uid)
              .collection("publicPicks")
              .where("eventId", "==", eventId)
              .get(),
          ),
        ),
        firestore
          .collection("gradingRuns")
          .where("eventId", "==", eventId)
          .get(),
      ]);
    const expectedProfileStats = new Map<
      string,
      { gradedPicks: number; totalPoints: number }
    >();
    for (const snapshot of userPredictionSnapshots) {
      for (const prediction of snapshot.docs) {
        const predictionData = record(prediction.data());
        const uid = predictionData.uid;
        if (typeof uid !== "string" || predictionData.status !== "graded")
          continue;
        const current = expectedProfileStats.get(uid) ?? {
          gradedPicks: 0,
          totalPoints: 0,
        };
        current.gradedPicks += 1;
        current.totalPoints += numberValue(record(predictionData.grade).points);
        expectedProfileStats.set(uid, current);
      }
    }

    const fightRows = await Promise.all(
      fightsSnapshot.docs.map(async (fightSnapshot) => {
        const fight = record(fightSnapshot.data());
        const summary = record(fight.predictionSummary);
        const result = record(fight.result);
        const predictions = predictionsByFight.get(fightSnapshot.id) ?? [];
        const shards = await fightSnapshot.ref
          .collection("predictionShards")
          .get();
        const shardTotal = shards.docs.reduce(
          (total, shard) => total + numberValue(shard.get("total")),
          0,
        );
        const statusCounts: Record<string, number> = {};
        let gradedForCurrentResult = 0;
        let awardedPoints = 0;
        for (const prediction of predictions) {
          const status = String(prediction.get("status") ?? "missing");
          statusCounts[status] = (statusCounts[status] ?? 0) + 1;
          const grade = record(prediction.get("grade"));
          if (
            grade.resultVersion === result.resultVersion &&
            grade.scoringVersion === 1
          ) {
            gradedForCurrentResult += 1;
            awardedPoints += numberValue(grade.points);
          }
        }
        const fightJobs = jobs.filter(
          (job) => job.get("fightId") === fightSnapshot.id,
        );
        return {
          boutOrder: numberValue(fight.boutOrder),
          fightId: fightSnapshot.id,
          matchup: `${String(record(record(fight.fighterA).name).full ?? fight.fighterAId)} vs ${String(record(record(fight.fighterB).name).full ?? fight.fighterBId)}`,
          fightStatus: fight.status ?? null,
          predictionStatus: fight.predictionStatus ?? null,
          result: {
            official: result.official === true,
            version: numberValue(result.resultVersion),
            winnerFighterIdPresent: typeof result.winnerFighterId === "string",
            method: result.method ?? null,
          },
          rawPredictions: predictions.length,
          statusCounts,
          gradedForCurrentResult,
          awardedPoints,
          displayedSummaryTotal: numberValue(summary.total),
          shardTotal,
          shardCount: shards.size,
          jobs: fightJobs.map((job) => {
            const jobData = record(job.data());
            return {
              id: job.id,
              status: jobData.status ?? null,
              resultVersion: numberValue(jobData.resultVersion),
              createdAt: timestampText(jobData.createdAt),
              error: jobData.error ?? null,
            };
          }),
        };
      }),
    );

    const profileSummary = profiles.reduce(
      (summary, profile) => {
        const stats = record(profile.get("stats"));
        const expected = expectedProfileStats.get(profile.id) ?? {
          gradedPicks: 0,
          totalPoints: 0,
        };
        const storedGradedPicks = numberValue(stats.gradedPicks);
        const storedPoints = numberValue(stats.totalPoints);
        summary.existingProfiles += profile.exists ? 1 : 0;
        summary.storedGradedPicksAllEvents += storedGradedPicks;
        summary.storedPointsAllEvents += storedPoints;
        summary.expectedGradedPicksAllEvents += expected.gradedPicks;
        summary.expectedPointsAllEvents += expected.totalPoints;
        if (storedGradedPicks === 0) summary.zeroGradedProfiles += 1;
        if (
          storedGradedPicks !== expected.gradedPicks ||
          storedPoints !== expected.totalPoints
        ) {
          summary.mismatchedProfiles += 1;
        }
        return summary;
      },
      {
        existingProfiles: 0,
        zeroGradedProfiles: 0,
        storedGradedPicksAllEvents: 0,
        storedPointsAllEvents: 0,
        expectedGradedPicksAllEvents: 0,
        expectedPointsAllEvents: 0,
        mismatchedProfiles: 0,
        eventPublicPicks: publicPickSnapshots.reduce(
          (total, snapshot) => total + snapshot.size,
          0,
        ),
      },
    );

    const eventSummary = record(event.predictionSummary);
    const eventBoard = record(eventBoardSnapshot.data());
    const report = {
      projectId,
      eventId,
      eventStatus: event.status ?? null,
      eventStoredPredictionTotal: numberValue(eventSummary.totalPredictions),
      rawEventPredictions: predictionsSnapshot.size,
      uniquePredictors: affectedUids.size,
      sumOfFightRawPredictions: fightRows.reduce(
        (total, fight) => total + fight.rawPredictions,
        0,
      ),
      sumOfDisplayedFightTotals: fightRows.reduce(
        (total, fight) => total + fight.displayedSummaryTotal,
        0,
      ),
      sumOfShardTotals: fightRows.reduce(
        (total, fight) => total + fight.shardTotal,
        0,
      ),
      queuedJobs: jobs.filter((job) => job.get("status") === "queued").length,
      failedJobs: jobs.filter((job) => job.get("status") === "failed").length,
      gradingRuns: {
        total: gradingRunsSnapshot.size,
        complete: gradingRunsSnapshot.docs.filter(
          (run) => run.get("status") === "complete",
        ).length,
        failed: gradingRunsSnapshot.docs.filter(
          (run) => run.get("status") === "failed",
        ).length,
      },
      eventLeaderboard: {
        exists: eventBoardSnapshot.exists,
        minimumPicks: numberValue(eventBoard.minimumPicks),
        entries: eventBoardEntriesSnapshot.size,
        gradedPicks: eventBoardEntriesSnapshot.docs.reduce(
          (total, entry) => total + numberValue(entry.get("gradedPicks")),
          0,
        ),
        points: eventBoardEntriesSnapshot.docs.reduce(
          (total, entry) => total + numberValue(entry.get("totalPoints")),
          0,
        ),
      },
      ...(seasonId
        ? {
            seasonAccuracyLeaderboard: {
              seasonId,
              exists: seasonAccuracyBoardSnapshot?.exists === true,
              minimumPicks: numberValue(
                seasonAccuracyBoardSnapshot?.get("minimumPicks"),
              ),
              entries: seasonAccuracyEntriesSnapshot?.size ?? 0,
            },
          }
        : {}),
      profileSummary,
      fights: fightRows,
    };

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await deleteApp(app);
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
