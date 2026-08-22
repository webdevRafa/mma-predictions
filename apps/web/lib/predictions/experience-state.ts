export type PredictionPanelMode = "form" | "locked" | "saved";

export function getPredictionPanelMode(
  hasSavedPrediction: boolean,
  canSubmit: boolean,
): PredictionPanelMode {
  if (hasSavedPrediction) return "saved";
  return canSubmit ? "form" : "locked";
}
