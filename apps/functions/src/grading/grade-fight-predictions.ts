import {
  SCORING_VERSION,
  predictionPickSchema,
  resultMethodSchema,
  scorePredictionV1,
  type FightResult,
  type PredictionPick,
} from "@fightlobby/domain";
import {
  FieldPath,
  Timestamp,
  type Firestore,
  type Query,
} from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";

import { requireRole } from "../auth/roles.js";
import { getAdminServices } from "../lib/firebase/admin.js";
import {
  rebuildEventLeaderboard,
  rebuildSeasonLeaderboards,
} from "./leaderboard-builders.js";
import { recomputeProfileAggregates } from "./profile-aggregates.js";

const inputSchema = z
  .object({
    fightId: z.string().min(3).max(120),
    reason: z.string().max(300).optional(),
  })
  .strict();

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function timestamp(value: unknown) {
  if (value instanceof Timestamp) return value;
  if (value instanceof Date) return Timestamp.fromDate(value);
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return Timestamp.fromDate(parsed);
  }
  return null;
}

function resultFromFight(fight: Record<string, unknown>): FightResult | null {
  const source = record(fight.result);
  const method = resultMethodSchema.safeParse(source.method);
  const resultVersion = source.resultVersion;
  if (
    !method.success ||
    typeof resultVersion !== "number" ||
    !Number.isInteger(resultVersion)
  )
    return null;
  const winner = source.winnerFighterId;
  const round = source.round;
  const time = source.timeInRoundSeconds;
  const updatedAt = timestamp(source.updatedAt) ?? Timestamp.now();
  return {
    method: method.data,
    resultVersion,
    official: source.official === true,
    updatedAt: updatedAt.toDate().toISOString(),
    ...(typeof winner === "string" ? { winnerFighterId: winner } : {}),
    ...(typeof source.methodDetail === "string"
      ? { methodDetail: source.methodDetail }
      : {}),
    ...(typeof round === "number" ? { round } : {}),
    ...(typeof time === "number" ? { timeInRoundSeconds: time } : {}),
  };
}

function resultCanBeGraded(result: FightResult | null) {
  return Boolean(
    result?.official &&
    result.winnerFighterId &&
    !["draw", "no_contest", "overturned"].includes(result.method),
  );
}

function publicPick(
  fight: Record<string, unknown>,
  fightId: string,
  pick: PredictionPick,
  status: "graded" | "void",
  points: number,
  gradedAt: Timestamp,
) {
  const fighterA = record(fight.fighterA);
  const fighterB = record(fight.fighterB);
  const fighterAName = record(fighterA.name).full;
  const fighterBName = record(fighterB.name).full;
  const selected =
    pick.winnerFighterId === fight.fighterAId ? fighterAName : fighterBName;
  return {
    fightId,
    eventId: fight.eventId,
    fightSlug: fight.slug,
    fighterAName:
      typeof fighterAName === "string" ? fighterAName : "Unknown fighter",
    fighterBName:
      typeof fighterBName === "string" ? fighterBName : "Unknown fighter",
    selectedWinnerFighterId: pick.winnerFighterId,
    selectedWinnerName:
      typeof selected === "string" ? selected : "Unknown fighter",
    method: pick.method,
    ...(pick.detail !== undefined ? { detail: pick.detail } : {}),
    status,
    points,
    gradedAt,
  };
}

export async function gradeFightPredictionsCore(
  firestore: Firestore,
  fightId: string,
  reason = "official_result",
) {
  const fightRef = firestore.collection("fights").doc(fightId);
  const fightSnapshot = await fightRef.get();
  if (!fightSnapshot.exists) throw new Error("Fight was not found");
  const fightValue: unknown = fightSnapshot.data();
  const fight = record(fightValue);
  const eventId = fight.eventId;
  if (typeof eventId !== "string") throw new Error("Fight eventId is missing");
  const eventSnapshot = await firestore.collection("events").doc(eventId).get();
  const eventValue: unknown = eventSnapshot.data();
  const event = record(eventValue);
  const eventStartsAt =
    timestamp(event.startsAt) ??
    timestamp(fight.estimatedStartsAt) ??
    Timestamp.now();
  const seasonId = String(eventStartsAt.toDate().getUTCFullYear());
  const result = resultFromFight(fight);
  const resultVersion =
    result?.resultVersion ?? numberValue(record(fight.result).resultVersion);
  const runId = `${fightId}_r${resultVersion}_s${SCORING_VERSION}`;
  const runRef = firestore.collection("gradingRuns").doc(runId);
  const existingRun = await runRef.get();
  if (existingRun.get("status") === "complete") {
    const value: unknown = existingRun.data();
    return record(value);
  }
  await runRef.set(
    {
      id: runId,
      fightId,
      eventId,
      seasonId,
      resultVersion,
      scoringVersion: SCORING_VERSION,
      reason,
      status: "processing",
      startedAt: Timestamp.now(),
    },
    { merge: true },
  );

  const affectedUids = new Set<string>();
  let cursor: string | undefined;
  let gradedPredictions = 0;
  let voidPredictions = 0;
  let correctWinners = 0;
  let exactPicks = 0;
  let awardedPoints = 0;

  do {
    let query: Query = firestore
      .collection("predictions")
      .where("fightId", "==", fightId)
      .orderBy(FieldPath.documentId())
      .limit(140);
    if (cursor) query = query.startAfter(cursor);
    const predictions = await query.get();
    if (predictions.empty) break;
    const batch = firestore.batch();
    for (const document of predictions.docs) {
      const raw: unknown = document.data();
      const prediction = record(raw);
      const uid = prediction.uid;
      const parsedPick = predictionPickSchema.safeParse(prediction.pick);
      if (typeof uid !== "string" || !parsedPick.success) continue;
      affectedUids.add(uid);
      const oldGrade = record(prediction.grade);
      if (oldGrade.gradeKey === runId) {
        if (prediction.status === "graded") {
          gradedPredictions += 1;
          correctWinners += oldGrade.winnerCorrect === true ? 1 : 0;
          exactPicks += oldGrade.detailCorrect === true ? 1 : 0;
          awardedPoints += numberValue(oldGrade.points);
        } else if (prediction.status === "void") voidPredictions += 1;
        continue;
      }
      if (typeof oldGrade.gradeKey === "string") {
        batch.set(
          document.ref.collection("gradeHistory").doc(oldGrade.gradeKey),
          {
            ...oldGrade,
            previousStatus: prediction.status,
            reversedAt: Timestamp.now(),
            reversedByRunId: runId,
          },
          { merge: true },
        );
      }
      const score = result
        ? scorePredictionV1(parsedPick.data, result)
        : {
            status: "void" as const,
            reason: "invalid_result",
            points: 0 as const,
          };
      const gradedAt = Timestamp.now();
      const gradeBase = {
        gradeKey: runId,
        resultVersion,
        scoringVersion: SCORING_VERSION,
        gradeVersion: SCORING_VERSION,
        gradedAt,
        sequenceAt: eventStartsAt,
        boutOrder: numberValue(fight.boutOrder),
      };
      if (score.status === "graded") {
        const grade = { ...gradeBase, ...score };
        batch.set(
          document.ref,
          { status: "graded", grade, seasonId, voidReason: null },
          { merge: true },
        );
        batch.set(
          firestore
            .collection("profiles")
            .doc(uid)
            .collection("publicPicks")
            .doc(fightId),
          publicPick(
            fight,
            fightId,
            parsedPick.data,
            "graded",
            score.points,
            gradedAt,
          ),
          { merge: true },
        );
        gradedPredictions += 1;
        correctWinners += score.winnerCorrect ? 1 : 0;
        exactPicks += score.detailCorrect ? 1 : 0;
        awardedPoints += score.points;
      } else {
        const grade = { ...gradeBase, ...score };
        batch.set(
          document.ref,
          { status: "void", grade, seasonId, voidReason: score.reason },
          { merge: true },
        );
        batch.set(
          firestore
            .collection("profiles")
            .doc(uid)
            .collection("publicPicks")
            .doc(fightId),
          publicPick(fight, fightId, parsedPick.data, "void", 0, gradedAt),
          { merge: true },
        );
        voidPredictions += 1;
      }
    }
    await batch.commit();
    cursor = predictions.docs.at(-1)?.id;
    if (predictions.size < 140) break;
  } while (cursor);

  const summary = {
    gradedPredictions,
    voidPredictions,
    correctWinners,
    exactPicks,
    awardedPoints,
  };
  await fightRef.set(
    {
      predictionStatus: resultCanBeGraded(result) ? "graded" : "void",
      gradingSummary: summary,
      updatedAt: Timestamp.now(),
    },
    { merge: true },
  );

  await Promise.all(
    [...affectedUids].map((uid) => recomputeProfileAggregates(firestore, uid)),
  );
  const [eventBoard, seasonBoards] = await Promise.all([
    rebuildEventLeaderboard(firestore, eventId),
    rebuildSeasonLeaderboards(firestore, seasonId),
  ]);
  const achievementUids = new Set([
    ...eventBoard.achievementUids,
    ...seasonBoards.achievementUids,
  ]);
  await Promise.all(
    [...achievementUids].map((uid) =>
      recomputeProfileAggregates(firestore, uid),
    ),
  );
  await Promise.all([
    rebuildEventLeaderboard(firestore, eventId),
    rebuildSeasonLeaderboards(firestore, seasonId),
  ]);

  const completedAt = Timestamp.now();
  await Promise.all([
    runRef.set(
      { status: "complete", ...summary, completedAt },
      { merge: true },
    ),
    firestore.collection("auditLogs").doc(`grading_${runId}`).set(
      {
        type: "prediction_grading",
        runId,
        fightId,
        eventId,
        resultVersion,
        scoringVersion: SCORING_VERSION,
        reason,
        affectedUsers: affectedUids.size,
        summary,
        createdAt: completedAt,
      },
      { merge: true },
    ),
  ]);
  return { id: runId, status: "complete", ...summary };
}

function callable(name: "grade" | "regrade") {
  return onCall(
    { enforceAppCheck: true, timeoutSeconds: 540 },
    async (request) => {
      requireRole(request.auth?.token, ["admin"]);
      const input = inputSchema.safeParse(request.data);
      if (!input.success)
        throw new HttpsError("invalid-argument", "A valid fightId is required");
      try {
        return await gradeFightPredictionsCore(
          getAdminServices().firestore,
          input.data.fightId,
          input.data.reason ??
            (name === "regrade" ? "result_correction" : "official_result"),
        );
      } catch (error) {
        throw new HttpsError(
          "failed-precondition",
          error instanceof Error
            ? error.message
            : "Predictions could not be graded",
        );
      }
    },
  );
}

export const gradeFightPredictions = callable("grade");
export const regradeFightPredictions = callable("regrade");
