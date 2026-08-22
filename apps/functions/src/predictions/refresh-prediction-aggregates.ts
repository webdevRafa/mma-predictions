import type { PredictionSummary } from "@fightlobby/domain";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";

import { getAdminServices } from "../lib/firebase/admin.js";

interface FighterBreakdown {
  fighterA: Record<string, number>;
  fighterB: Record<string, number>;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function emptyBreakdown(): FighterBreakdown {
  return { fighterA: {}, fighterB: {} };
}

function sumMap(target: Record<string, number>, value: unknown) {
  for (const [key, amount] of Object.entries(record(value))) {
    target[key] = (target[key] ?? 0) + numberValue(amount);
  }
}

function sumBreakdown(target: FighterBreakdown, value: unknown) {
  const source = record(value);
  sumMap(target.fighterA, source.fighterA);
  sumMap(target.fighterB, source.fighterB);
}

export async function refreshPredictionAggregateCore(
  firestore: Firestore,
  fightId: string,
) {
  const jobRef = firestore.collection("predictionAggregateJobs").doc(fightId);
  const fightRef = firestore.collection("fights").doc(fightId);

  return firestore.runTransaction(async (transaction) => {
    const [job, fight, shards] = await Promise.all([
      transaction.get(jobRef),
      transaction.get(fightRef),
      transaction.get(fightRef.collection("predictionShards")),
    ]);
    if (!job.exists) return null;
    if (!fight.exists) {
      transaction.delete(jobRef);
      return null;
    }

    const methodsByFighter = emptyBreakdown();
    const roundsByFighter = emptyBreakdown();
    const summary: PredictionSummary = {
      total: 0,
      fighterA: 0,
      fighterB: 0,
      methods: {},
      rounds: {},
      methodsByFighter,
      roundsByFighter,
      lastAggregatedAt: Timestamp.now().toDate().toISOString(),
    };

    for (const shard of shards.docs) {
      const data = record(shard.data());
      summary.total += numberValue(data.total);
      summary.fighterA += numberValue(data.fighterA);
      summary.fighterB += numberValue(data.fighterB);
      sumMap(summary.methods, data.methods);
      sumMap(summary.rounds, data.rounds);
      sumBreakdown(methodsByFighter, data.methodsByFighter);
      sumBreakdown(roundsByFighter, data.roundsByFighter);
    }

    transaction.set(
      fightRef,
      {
        predictionSummary: {
          ...summary,
          lastAggregatedAt: Timestamp.now(),
        },
      },
      { merge: true },
    );
    transaction.delete(jobRef);
    return summary;
  });
}

export async function refreshPendingPredictionAggregatesCore(
  firestore: Firestore,
) {
  const jobs = await firestore
    .collection("predictionAggregateJobs")
    .orderBy("requestedAt", "asc")
    .limit(100)
    .get();
  const results = await Promise.all(
    jobs.docs.map((job) => refreshPredictionAggregateCore(firestore, job.id)),
  );
  return { queued: jobs.size, refreshed: results.filter(Boolean).length };
}

export const refreshPendingPredictionAggregates = onSchedule(
  {
    schedule: "* * * * *",
    timeZone: "Etc/UTC",
    timeoutSeconds: 300,
    memory: "256MiB",
  },
  async () => {
    await refreshPendingPredictionAggregatesCore(getAdminServices().firestore);
  },
);
