export type PredictionPanelMode = "form" | "locked" | "saved";

export function getPredictionPanelMode(
  hasSavedPrediction: boolean,
  canSubmit: boolean,
): PredictionPanelMode {
  if (hasSavedPrediction) return "saved";
  return canSubmit ? "form" : "locked";
}

export function isPredictionSubmissionDisabled({
  busy,
  canSubmit,
  winnerFighterId,
}: {
  busy: boolean;
  canSubmit: boolean;
  winnerFighterId: string;
}) {
  return busy || !canSubmit || !winnerFighterId;
}
