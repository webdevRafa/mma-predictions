import "server-only";

import { cache } from "react";

import { getPredictionHistoryRepository } from "@/lib/repositories/prediction-histories";

export const getPrivatePredictionHistory = cache((uid: string) =>
  getPredictionHistoryRepository().getPrivateHistory(uid),
);

export const getPublicPredictionHistory = cache((uid: string) =>
  getPredictionHistoryRepository().getPublicHistory(uid),
);
