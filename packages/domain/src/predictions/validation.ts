import type { PredictionPick } from "../types/domain.ts";
import { predictionPickSchema } from "../schemas/domain.ts";

export interface PredictionFightContext {
  fighterAId: string;
  fighterBId: string;
  scheduledRounds: 3 | 5;
}

export type PredictionValidationResult =
  { success: true; data: PredictionPick } | { success: false; message: string };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

/** Reads legacy stored picks without weakening strict validation for new input. */
export function parseStoredPredictionPick(
  value: unknown,
): PredictionPick | null {
  const source = record(value);
  const parsed = predictionPickSchema.safeParse({
    winnerFighterId: source.winnerFighterId,
    method: source.method,
    ...(source.detail !== undefined ? { detail: source.detail } : {}),
  });
  return parsed.success ? parsed.data : null;
}

export function validatePredictionForFight(
  value: unknown,
  fight: PredictionFightContext,
): PredictionValidationResult {
  const parsed = predictionPickSchema.safeParse(value);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const field = firstIssue?.path[0];
    if (field === "winnerFighterId") {
      return {
        success: false,
        message: "Pick a winner before locking in your prediction",
      };
    }
    return {
      success: false,
      message: firstIssue?.message ?? "Prediction is invalid",
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
