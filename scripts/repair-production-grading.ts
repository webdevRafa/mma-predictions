import {
  applicationDefault,
  deleteApp,
  initializeApp,
} from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";

import { gradeFightPredictionsCore } from "../apps/functions/src/grading/grade-fight-predictions.ts";
import {
  rebuildEventLeaderboard,
  rebuildSeasonLeaderboards,
} from "../apps/functions/src/grading/leaderboard-builders.ts";
import { recomputeProfileAggregates } from "../apps/functions/src/grading/profile-aggregates.ts";
import { refreshPredictionAggregateCore } from "../apps/functions/src/predictions/refresh-prediction-aggregates.ts";

const PRODUCTION_PROJECT_ID = "mma-cortex";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

async function main() {
  const eventSelector = process.argv[2];
  if (!eventSelector) {
    throw new Error(
      "Usage: pnpm repair:production:grading -- <eventId-or-slug>",
    );
  }

  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT ??
    process.env.GCLOUD_PROJECT ??
    PRODUCTION_PROJECT_ID;
  if (projectId !== PRODUCTION_PROJECT_ID) {
    throw new Error(
      `Refusing to repair unexpected project ${projectId}; expected ${PRODUCTION_PROJECT_ID}`,
    );
  }

  const app = initializeApp({
    credential: applicationDefault(),
    projectId: PRODUCTION_PROJECT_ID,
  });
  const firestore = getFirestore(app);

  try {
    const directEvent = await firestore
      .collection("events")
      .doc(eventSelector)
      .get();
    const slugMatches = directEvent.exists
      ? null
      : await firestore
          .collection("events")
          .where("slug", "==", eventSelector)
          .limit(2)
          .get();
    const eventSnapshot = directEvent.exists
      ? directEvent
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
    const [fightsSnapshot, predictionsSnapshot, jobsSnapshot] =
      await Promise.all([
        firestore
          .collection("fights")
          .where("eventId", "==", eventId)
          .orderBy("boutOrder")
          .get(),
        firestore
          .collection("predictions")
          .where("eventId", "==", eventId)
          .get(),
        firestore.collection("adminJobs").get(),
      ]);
    const predictionSeasonIds = [
      ...new Set(
        predictionsSnapshot.docs.flatMap((prediction) => {
          const seasonId = record(prediction.data()).seasonId;
          return typeof seasonId === "string" ? [seasonId] : [];
        }),
      ),
    ];
    if (predictionSeasonIds.length > 1) {
      throw new Error(
        `Refusing to repair event ${eventId} with predictions from multiple seasons`,
      );
    }
    const seasonId =
      typeof event.seasonId === "string"
        ? event.seasonId
        : predictionSeasonIds[0];
    const fightIds = new Set(fightsSnapshot.docs.map((fight) => fight.id));
    const currentResultVersions = new Map(
      fightsSnapshot.docs.map((fight) => [
        fight.id,
        record(record(fight.data()).result).resultVersion,
      ]),
    );
    const recoverableJobs = jobsSnapshot.docs.filter((job) => {
      const value = record(job.data());
      const fightId = value.fightId;
      return (
        value.type === "regrade_fight" &&
        ["queued", "processing", "failed"].includes(String(value.status)) &&
        typeof fightId === "string" &&
        fightIds.has(fightId) &&
        value.resultVersion === currentResultVersions.get(fightId)
      );
    });
    const invalidResultFights = fightsSnapshot.docs.filter((fight) => {
      const value = record(fight.data());
      const result = record(value.result);
      const method = result.method;
      const isVoidMethod = ["draw", "no_contest", "overturned"].includes(
        String(method),
      );
      const hasValidWinner =
        typeof result.winnerFighterId === "string" &&
        [value.fighterAId, value.fighterBId].includes(result.winnerFighterId);
      return (
        value.status !== "completed" ||
        result.official !== true ||
        typeof result.resultVersion !== "number" ||
        typeof method !== "string" ||
        (isVoidMethod ? result.winnerFighterId !== undefined : !hasValidWinner)
      );
    });
    if (invalidResultFights.length > 0) {
      throw new Error(
        `Refusing to grade because ${invalidResultFights.length} fight(s) lack a valid official result`,
      );
    }

    const plan = {
      projectId,
      eventId,
      fights: fightsSnapshot.size,
      rawPredictions: predictionsSnapshot.size,
      uniquePredictors: new Set(
        predictionsSnapshot.docs
          .map((prediction) => record(prediction.data()).uid)
          .filter((uid): uid is string => typeof uid === "string"),
      ).size,
      recoverableGradingJobs: recoverableJobs.length,
    };
    console.log(JSON.stringify({ mode: "review", ...plan }, null, 2));

    if (process.env.FIGHTLOBBY_GRADING_REPAIR_CONFIRM !== eventId) {
      console.log(
        `No writes made. Set FIGHTLOBBY_GRADING_REPAIR_CONFIRM=${eventId} to apply this exact repair.`,
      );
      return;
    }
    const missingJobs = fightsSnapshot.docs.filter((fight) => {
      const value = record(fight.data());
      return (
        value.predictionStatus === "grading" &&
        !recoverableJobs.some((job) => record(job.data()).fightId === fight.id)
      );
    });
    if (missingJobs.length > 0) {
      throw new Error(
        `Refusing to repair because ${missingJobs.length} grading fight(s) have no recoverable current-version job`,
      );
    }

    for (const fight of fightsSnapshot.docs) {
      const aggregateJobRef = firestore
        .collection("predictionAggregateJobs")
        .doc(fight.id);
      await aggregateJobRef.set(
        {
          fightId: fight.id,
          requestedAt: Timestamp.now(),
          reason: "production_grading_recovery",
        },
        { merge: true },
      );
      await refreshPredictionAggregateCore(firestore, fight.id);
    }

    const completedJobs: Array<{
      fightId: string;
      gradedPredictions: number;
      awardedPoints: number;
    }> = [];
    for (const job of recoverableJobs) {
      const fightId = String(job.get("fightId"));
      await job.ref.set(
        {
          status: "processing",
          startedAt: FieldValue.serverTimestamp(),
          recovery: "production_grading_recovery",
        },
        { merge: true },
      );
      try {
        const result = await gradeFightPredictionsCore(
          firestore,
          fightId,
          String(job.get("reason") ?? "production_grading_recovery"),
        );
        await job.ref.set(
          {
            status: "complete",
            result,
            completedAt: FieldValue.serverTimestamp(),
            error: FieldValue.delete(),
          },
          { merge: true },
        );
        completedJobs.push({
          fightId,
          gradedPredictions:
            typeof result.gradedPredictions === "number"
              ? result.gradedPredictions
              : 0,
          awardedPoints:
            typeof result.awardedPoints === "number" ? result.awardedPoints : 0,
        });
      } catch (error) {
        await job.ref.set(
          {
            status: "failed",
            error:
              error instanceof Error ? error.message : "Unknown repair error",
            failedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        throw error;
      }
    }

    const uniquePredictors = new Set(
      predictionsSnapshot.docs
        .map((prediction) => record(prediction.data()).uid)
        .filter((uid): uid is string => typeof uid === "string"),
    ).size;
    await eventSnapshot.ref.set(
      {
        predictionSummary: {
          totalPredictions: predictionsSnapshot.size,
          uniquePredictors,
        },
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    );
    const eventBoard = await rebuildEventLeaderboard(firestore, eventId);
    const seasonBoards = seasonId
      ? await rebuildSeasonLeaderboards(firestore, seasonId)
      : undefined;
    await Promise.all(
      [
        ...new Set([
          ...eventBoard.achievementUids,
          ...(seasonBoards?.achievementUids ?? []),
        ]),
      ].map((uid) => recomputeProfileAggregates(firestore, uid)),
    );

    console.log(
      JSON.stringify(
        {
          mode: "applied",
          ...plan,
          completedJobs: completedJobs.length,
          gradedPredictions: completedJobs.reduce(
            (total, job) => total + job.gradedPredictions,
            0,
          ),
          awardedPoints: completedJobs.reduce(
            (total, job) => total + job.awardedPoints,
            0,
          ),
          eventLeaderboardEntries: eventBoard.ranking.length,
          ...(seasonId ? { seasonId } : {}),
          ...(seasonBoards
            ? {
                seasonPointsEntries: seasonBoards.points.length,
                seasonAccuracyEntries: seasonBoards.accuracy.length,
                seasonStreakEntries: seasonBoards.streak.length,
              }
            : {}),
        },
        null,
        2,
      ),
    );
  } finally {
    await deleteApp(app);
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
