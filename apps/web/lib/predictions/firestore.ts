import {
  fightStatusSchema,
  parseStoredPredictionPick,
  predictionStatusSchema,
  validatePredictionForFight,
  type FightStatus,
  type PredictionGrade,
  type PredictionPick,
  type PredictionSummary,
} from "@fightlobby/domain";
import {
  FieldValue,
  Timestamp,
  type DocumentSnapshot,
  type Firestore,
} from "firebase-admin/firestore";

import { ApiError } from "../auth/http";

const PREDICTION_SHARD_COUNT = 20;
const SUBMISSION_OPEN_FIGHT_STATUSES: FightStatus[] = ["scheduled", "prefight"];

export interface SafePredictionView {
  pick: PredictionPick;
  status: "active" | "locked" | "graded" | "void";
  predictionVersion: number;
  submittedAt: string;
  updatedAt: string;
  lockedAt?: string;
  grade?: PredictionGrade;
}

export interface SubmissionResult {
  prediction: SafePredictionView;
  summary: PredictionSummary;
  created: boolean;
  idempotent: boolean;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function timestampMillis(value: unknown): number | null {
  if (value instanceof Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function timestampIso(value: unknown): string | null {
  const milliseconds = timestampMillis(value);
  return milliseconds === null ? null : new Date(milliseconds).toISOString();
}

function predictionStatus(value: unknown): SafePredictionView["status"] | null {
  return ["active", "locked", "graded", "void"].includes(String(value))
    ? (value as SafePredictionView["status"])
    : null;
}

export function predictionShardId(uid: string) {
  let hash = 2_166_136_261;
  for (const character of uid) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return `shard_${String((hash >>> 0) % PREDICTION_SHARD_COUNT).padStart(2, "0")}`;
}

export function assertPredictionSubmissionOpen(
  fight: Record<string, unknown>,
  nowMilliseconds: number,
) {
  const parsedFightStatus = fightStatusSchema.safeParse(fight.status);
  const parsedPredictionStatus = predictionStatusSchema.safeParse(
    fight.predictionStatus,
  );
  if (
    !parsedFightStatus.success ||
    !parsedPredictionStatus.success ||
    parsedPredictionStatus.data !== "open" ||
    !SUBMISSION_OPEN_FIGHT_STATUSES.includes(parsedFightStatus.data)
  ) {
    throw new ApiError(
      "Predictions are locked for this fight",
      409,
      "predictions_locked",
    );
  }
  const lockedAt = timestampMillis(fight.predictionsLockedAt);
  if (lockedAt !== null && nowMilliseconds >= lockedAt) {
    throw new ApiError(
      "Predictions are locked for this fight",
      409,
      "predictions_locked",
    );
  }
  if (fight.dataQuality === "blocked") {
    throw new ApiError(
      "Predictions are unavailable while this matchup is reviewed",
      409,
      "prediction_unavailable",
    );
  }
  return {
    fightStatus: parsedFightStatus.data,
    predictionStatus: parsedPredictionStatus.data,
  };
}

function safePrediction(snapshot: DocumentSnapshot): SafePredictionView {
  const value: unknown = snapshot.data();
  const data = record(value);
  const pick = parseStoredPredictionPick(data.pick);
  const status = predictionStatus(data.status);
  const submittedAt = timestampIso(data.submittedAt);
  const updatedAt = timestampIso(data.updatedAt);
  const version = data.predictionVersion;
  if (
    !pick ||
    !status ||
    !submittedAt ||
    !updatedAt ||
    typeof version !== "number" ||
    !Number.isInteger(version)
  ) {
    throw new ApiError(
      "The saved prediction could not be read",
      409,
      "prediction_invalid",
    );
  }
  const lockedAt = timestampIso(data.lockedAt);
  const rawGrade = record(data.grade);
  const gradedAt = timestampIso(rawGrade.gradedAt);
  const grade =
    typeof rawGrade.resultVersion === "number" &&
    typeof rawGrade.winnerCorrect === "boolean" &&
    typeof rawGrade.methodCorrect === "boolean" &&
    typeof rawGrade.detailCorrect === "boolean" &&
    typeof rawGrade.points === "number" &&
    typeof rawGrade.gradeVersion === "number" &&
    gradedAt
      ? {
          resultVersion: rawGrade.resultVersion,
          winnerCorrect: rawGrade.winnerCorrect,
          methodCorrect: rawGrade.methodCorrect,
          detailCorrect: rawGrade.detailCorrect,
          points: rawGrade.points,
          gradedAt,
          gradeVersion: rawGrade.gradeVersion,
        }
      : undefined;
  return {
    pick,
    status,
    predictionVersion: version,
    submittedAt,
    updatedAt,
    ...(lockedAt ? { lockedAt } : {}),
    ...(grade ? { grade } : {}),
  };
}

function pickForStorage(pick: PredictionPick) {
  return {
    winnerFighterId: pick.winnerFighterId,
    method: pick.method,
    ...(pick.detail !== undefined ? { detail: pick.detail } : {}),
  };
}

function detailBucket(pick: PredictionPick) {
  if (typeof pick.detail === "number") return String(pick.detail);
  if (typeof pick.detail === "string") return `decision_${pick.detail}`;
  return null;
}

interface CounterDelta {
  total: number;
  fighterA: number;
  fighterB: number;
  methods: Record<string, number>;
  rounds: Record<string, number>;
}

function addBucket(
  target: Record<string, number>,
  key: string,
  amount: number,
) {
  target[key] = (target[key] ?? 0) + amount;
  if (target[key] === 0) delete target[key];
}

function applyPickDelta(
  delta: CounterDelta,
  pick: PredictionPick,
  fighterAId: string,
  amount: 1 | -1,
) {
  if (pick.winnerFighterId === fighterAId) delta.fighterA += amount;
  else delta.fighterB += amount;
  addBucket(delta.methods, pick.method, amount);
  const detail = detailBucket(pick);
  if (detail) addBucket(delta.rounds, detail, amount);
}

function incrementMap(values: Record<string, number>) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      FieldValue.increment(value),
    ]),
  );
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function sumMap(target: Record<string, number>, value: unknown) {
  const source = record(value);
  for (const [key, amount] of Object.entries(source)) {
    target[key] = (target[key] ?? 0) + numberValue(amount);
  }
}

export async function aggregatePredictionShards(
  firestore: Firestore,
  fightId: string,
): Promise<PredictionSummary> {
  const fightRef = firestore.collection("fights").doc(fightId);
  return firestore.runTransaction(async (transaction) => {
    const [fight, shards] = await Promise.all([
      transaction.get(fightRef),
      transaction.get(fightRef.collection("predictionShards")),
    ]);
    if (!fight.exists)
      throw new ApiError("Fight was not found", 404, "fight_not_found");
    const summary: PredictionSummary = {
      total: 0,
      fighterA: 0,
      fighterB: 0,
      methods: {},
      rounds: {},
      lastAggregatedAt: Timestamp.now().toDate().toISOString(),
    };
    for (const shard of shards.docs) {
      const data: unknown = shard.data();
      const shardData = record(data);
      summary.total += numberValue(shardData.total);
      summary.fighterA += numberValue(shardData.fighterA);
      summary.fighterB += numberValue(shardData.fighterB);
      sumMap(summary.methods, shardData.methods);
      sumMap(summary.rounds, shardData.rounds);
    }
    transaction.set(
      fightRef,
      {
        predictionSummary: {
          ...summary,
          lastAggregatedAt: Timestamp.fromDate(
            new Date(summary.lastAggregatedAt ?? Date.now()),
          ),
        },
      },
      { merge: true },
    );
    return summary;
  });
}

export async function submitPredictionTransaction(
  firestore: Firestore,
  input: {
    fightId: string;
    uid: string;
    pick: unknown;
    requestId: string;
  },
): Promise<SubmissionResult> {
  const fightRef = firestore.collection("fights").doc(input.fightId);
  const predictionId = `${input.fightId}_${input.uid}`;
  const predictionRef = firestore.collection("predictions").doc(predictionId);
  const revisionRef = predictionRef
    .collection("revisions")
    .doc(input.requestId);
  const now = Timestamp.now();
  let created = false;
  let idempotent = false;

  await firestore.runTransaction(async (transaction) => {
    const [fightSnapshot, existingPrediction, existingRevision] =
      await Promise.all([
        transaction.get(fightRef),
        transaction.get(predictionRef),
        transaction.get(revisionRef),
      ]);
    if (!fightSnapshot.exists)
      throw new ApiError("Fight was not found", 404, "fight_not_found");
    const existingValue: unknown = existingPrediction.data();
    const existing = record(existingValue);
    if (existingRevision.exists) {
      if (existing.lastRequestId === input.requestId) {
        idempotent = true;
        return;
      }
      throw new ApiError(
        "That prediction request was already used",
        409,
        "request_conflict",
      );
    }
    if (existingPrediction.exists) {
      throw new ApiError(
        "This prediction is already locked and cannot be changed",
        409,
        "prediction_already_locked",
      );
    }
    const fightValue: unknown = fightSnapshot.data();
    const fight = record(fightValue);
    const serverState = assertPredictionSubmissionOpen(fight, now.toMillis());
    const fighterAId = fight.fighterAId;
    const fighterBId = fight.fighterBId;
    const eventId = fight.eventId;
    const scheduledRounds = fight.scheduledRounds;
    if (
      typeof fighterAId !== "string" ||
      typeof fighterBId !== "string" ||
      typeof eventId !== "string" ||
      (scheduledRounds !== 3 && scheduledRounds !== 5)
    ) {
      throw new ApiError(
        "Fight prediction data is incomplete",
        409,
        "fight_invalid",
      );
    }
    const validated = validatePredictionForFight(input.pick, {
      fighterAId,
      fighterBId,
      scheduledRounds,
    });
    if (!validated.success) {
      throw new ApiError(validated.message, 400, "invalid_prediction");
    }
    created = true;
    const storedPick = pickForStorage(validated.data);
    transaction.create(predictionRef, {
      id: predictionId,
      fightId: input.fightId,
      eventId,
      uid: input.uid,
      pick: storedPick,
      status: "locked",
      submittedAt: now,
      updatedAt: now,
      lockedAt: now,
      providerStatusAtSubmission: serverState.fightStatus,
      lateReviewFlag: false,
      predictionVersion: 1,
      lastRequestId: input.requestId,
    });
    transaction.create(revisionRef, {
      requestId: input.requestId,
      reason: "user_create",
      oldPick: null,
      newPick: storedPick,
      predictionVersion: 1,
      createdAt: now,
    });

    const delta: CounterDelta = {
      total: 1,
      fighterA: 0,
      fighterB: 0,
      methods: {},
      rounds: {},
    };
    applyPickDelta(delta, validated.data, fighterAId, 1);
    const shardRef = fightRef
      .collection("predictionShards")
      .doc(predictionShardId(input.uid));
    transaction.set(
      shardRef,
      {
        shardId: shardRef.id,
        total: FieldValue.increment(delta.total),
        fighterA: FieldValue.increment(delta.fighterA),
        fighterB: FieldValue.increment(delta.fighterB),
        ...(Object.keys(delta.methods).length > 0
          ? { methods: incrementMap(delta.methods) }
          : {}),
        ...(Object.keys(delta.rounds).length > 0
          ? { rounds: incrementMap(delta.rounds) }
          : {}),
        updatedAt: now,
      },
      { merge: true },
    );
  });

  const summary = await aggregatePredictionShards(firestore, input.fightId);
  const saved = await predictionRef.get();
  if (!saved.exists)
    throw new ApiError("Prediction was not saved", 500, "prediction_missing");
  const prediction = safePrediction(saved);
  return {
    prediction,
    summary,
    created,
    idempotent,
  };
}

export async function getPredictionExperience(
  firestore: Firestore,
  fightId: string,
  uid: string,
) {
  const [fightSnapshot, predictionSnapshot] = await Promise.all([
    firestore.collection("fights").doc(fightId).get(),
    firestore.collection("predictions").doc(`${fightId}_${uid}`).get(),
  ]);
  if (!fightSnapshot.exists)
    throw new ApiError("Fight was not found", 404, "fight_not_found");
  const fightValue: unknown = fightSnapshot.data();
  const fight = record(fightValue);
  let fightAcceptsSubmissions = true;
  try {
    assertPredictionSubmissionOpen(fight, Date.now());
  } catch {
    fightAcceptsSubmissions = false;
  }
  const canSubmit = fightAcceptsSubmissions && !predictionSnapshot.exists;
  const rawSummary = record(fight.predictionSummary);
  const summary: PredictionSummary = {
    total: numberValue(rawSummary.total),
    fighterA: numberValue(rawSummary.fighterA),
    fighterB: numberValue(rawSummary.fighterB),
    methods: {},
    rounds: {},
    ...(timestampIso(rawSummary.lastAggregatedAt)
      ? {
          lastAggregatedAt:
            timestampIso(rawSummary.lastAggregatedAt) ?? undefined,
        }
      : {}),
  };
  sumMap(summary.methods, rawSummary.methods);
  sumMap(summary.rounds, rawSummary.rounds);
  return {
    prediction: predictionSnapshot.exists
      ? safePrediction(predictionSnapshot)
      : null,
    summary,
    canSubmit,
    reveal:
      predictionSnapshot.exists ||
      fight.predictionStatus !== "open" ||
      !canSubmit,
  };
}
