import type { PredictionPick } from "../types/domain.ts";
import { predictionPickSchema } from "../schemas/domain.ts";

export interface PredictionFightContext {
  fighterAId: string;
  fighterBId: string;
  scheduledRounds: 3 | 5;
}

export type PredictionValidationResult =
  { success: true; data: PredictionPick } | { success: false; message: string };

export function validatePredictionForFight(
  value: unknown,
  fight: PredictionFightContext,
): PredictionValidationResult {
  const parsed = predictionPickSchema.safeParse(value);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Prediction is invalid",
    };
  }
  if (
    parsed.data.winnerFighterId !== fight.fighterAId &&
    parsed.data.winnerFighterId !== fight.fighterBId
  ) {
    return { success: false, message: "Winner must be in this matchup" };
  }
  if (
    typeof parsed.data.detail === "number" &&
    parsed.data.detail > fight.scheduledRounds
  ) {
    return {
      success: false,
      message: `Finish round must be between 1 and ${fight.scheduledRounds}`,
    };
  }
  return { success: true, data: parsed.data };
}
