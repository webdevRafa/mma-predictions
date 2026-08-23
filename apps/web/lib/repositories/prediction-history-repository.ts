import type { PredictionHistory } from "@/features/profiles/prediction-history-types";

export interface PredictionHistoryRepository {
  getPrivateHistory(uid: string): Promise<PredictionHistory>;
  getPublicHistory(uid: string): Promise<PredictionHistory>;
}
