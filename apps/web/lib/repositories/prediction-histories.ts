import "server-only";

import { getFirebaseAdmin } from "@/lib/firebase/admin";

import { FirestorePredictionHistoryRepository } from "./firestore-prediction-history-repository";
import { FixturePredictionHistoryRepository } from "./fixture-prediction-history-repository";
import type { PredictionHistoryRepository } from "./prediction-history-repository";

let predictionHistoryRepository: PredictionHistoryRepository | undefined;

export function getPredictionHistoryRepository() {
  if (predictionHistoryRepository) return predictionHistoryRepository;
  predictionHistoryRepository =
    process.env.FIGHTLOBBY_DATA_SOURCE === "firestore"
      ? new FirestorePredictionHistoryRepository(getFirebaseAdmin().firestore)
      : new FixturePredictionHistoryRepository();
  return predictionHistoryRepository;
}
